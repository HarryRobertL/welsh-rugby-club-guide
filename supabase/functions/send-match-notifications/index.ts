// Supabase Edge Function: send push notifications for match events (lineup published, score change, full time).
// Respects user notification preferences. TODO: quiet hours — skip when current time (in user TZ) is within quiet_hours_start/end.
import { createClient } from 'npm:@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

type EventType = 'lineup_published' | 'score_change' | 'full_time';

type RequestBody = {
  event: EventType;
  fixture_id: string;
  match_id?: string;
  score_home?: number;
  score_away?: number;
  home_team_name?: string;
  away_team_name?: string;
  team_name?: string;
};

type UserPrefRow = {
  id: string;
  notify_lineup_published: boolean;
  notify_score_change: boolean;
  notify_full_time: boolean;
};

type PushTokenRow = { token: string };

function buildMessage(event: EventType, body: RequestBody): { title: string; body: string } {
  const home = body.home_team_name ?? 'Home';
  const away = body.away_team_name ?? 'Away';
  const score = body.score_home != null && body.score_away != null ? `${body.score_home}–${body.score_away}` : null;
  switch (event) {
    case 'lineup_published':
      return {
        title: 'Team sheet published',
        body: body.team_name ? `${body.team_name} lineup is in` : `${home} v ${away}: team sheet published`,
      };
    case 'score_change':
      return {
        title: score ? `${home} ${score} ${away}` : 'Score update',
        body: score ? `Score: ${score}` : 'Match score has changed',
      };
    case 'full_time':
      return {
        title: 'Full time',
        body: score ? `${home} ${score} ${away}` : `${home} v ${away} — match finished`,
      };
    default:
      return { title: 'Match update', body: `${home} v ${away}` };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*' } });
  }
  try {
    const body = (await req.json()) as RequestBody;
    const { event, fixture_id } = body;
    if (!event || !fixture_id) {
      return new Response(JSON.stringify({ error: 'event and fixture_id required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (!['lineup_published', 'score_change', 'full_time'].includes(event)) {
      return new Response(JSON.stringify({ error: 'invalid event' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: fixture } = await supabase
      .from('fixtures')
      .select('home_team_id, away_team_id')
      .eq('id', fixture_id)
      .single();
    const home_team_id = (fixture as { home_team_id?: string } | null)?.home_team_id;
    const away_team_id = (fixture as { away_team_id?: string } | null)?.away_team_id;

    const userIdsSet = new Set<string>();
    const { data: favFixture } = await supabase
      .from('favourites')
      .select('user_id')
      .eq('entity_type', 'fixture')
      .eq('entity_id', fixture_id);
    (favFixture ?? []).forEach((r: { user_id: string }) => userIdsSet.add(r.user_id));
    if (home_team_id) {
      const { data: favHome } = await supabase
        .from('favourites')
        .select('user_id')
        .eq('entity_type', 'team')
        .eq('entity_id', home_team_id);
      (favHome ?? []).forEach((r: { user_id: string }) => userIdsSet.add(r.user_id));
    }
    if (away_team_id && away_team_id !== home_team_id) {
      const { data: favAway } = await supabase
        .from('favourites')
        .select('user_id')
        .eq('entity_type', 'team')
        .eq('entity_id', away_team_id);
      (favAway ?? []).forEach((r: { user_id: string }) => userIdsSet.add(r.user_id));
    }
    const userIds = Array.from(userIdsSet);
    if (userIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const prefColumn =
      event === 'lineup_published'
        ? 'notify_lineup_published'
        : event === 'score_change'
          ? 'notify_score_change'
          : 'notify_full_time';
    const { data: users } = await supabase
      .from('users')
      .select('id')
      .in('id', userIds)
      .eq(prefColumn, true) as { data: UserPrefRow[] | null };
    const allowedUserIds = (users ?? []).map((u) => u.id);
    if (allowedUserIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // TODO: quiet hours — filter allowedUserIds by user timezone and quiet_hours_start/end; skip if current time in window

    const { data: tokens } = await supabase
      .from('push_tokens')
      .select('token')
      .in('user_id', allowedUserIds) as { data: PushTokenRow[] | null };
    const expoTokens = (tokens ?? []).map((t) => t.token).filter(Boolean);
    if (expoTokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { title: messageTitle, body: messageBody } = buildMessage(event, body);
    const messages = expoTokens.map((to) => ({
      to,
      title: messageTitle,
      body: messageBody,
      data: { fixture_id, match_id: body.match_id, event },
      channelId: 'match-updates',
    }));

    const expoRes = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
    if (!expoRes.ok) {
      const errText = await expoRes.text();
      console.error('Expo push error', expoRes.status, errText);
      return new Response(JSON.stringify({ error: 'Expo push failed' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ sent: messages.length }),
      { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
