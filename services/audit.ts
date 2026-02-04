import { supabase } from '../lib/supabase';

export type AdminActionType =
  | 'lineup_published'
  | 'score_update'
  | 'event_undo'
  | 'match_full_time';

/**
 * Log an admin action with optional before/after snapshots. Used for lineup publish, score changes, undo, full time.
 * File: services/audit.ts
 */
export async function logAdminAction(
  actorId: string,
  actionType: AdminActionType,
  tableName: string,
  recordId: string,
  options?: { old_data?: Record<string, unknown>; new_data?: Record<string, unknown> }
): Promise<{ error: Error | null }> {
  const action = options?.old_data != null && options?.new_data != null ? 'update' : options?.new_data != null ? 'insert' : 'delete';
  const { error } = await (supabase.from('audit_log') as any).insert({
    table_name: tableName,
    record_id: recordId,
    action,
    action_type: actionType,
    old_data: options?.old_data ?? null,
    new_data: options?.new_data ?? null,
    actor_id: actorId,
  });
  return { error: error as Error | null };
}
