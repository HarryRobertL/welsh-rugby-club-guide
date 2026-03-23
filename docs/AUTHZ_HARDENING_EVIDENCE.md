# Authorization Hardening Evidence

File: `docs/AUTHZ_HARDENING_EVIDENCE.md`

## Scope

Hardening for:

- `public.users` self-update privilege escalation prevention
- `public.pending_claims` requester restrictions
- admin-only review workflow via `public.review_pending_claim`
- recursion fix for RLS policy checks on `pending_claims`

## Migrations

- `supabase/migrations/20260212110000_authz_hardening_claims_and_roles.sql`
- `supabase/migrations/20260212124000_authz_hardening_recursion_fix.sql`

## Verification Script

- `supabase/snippets/authorization_hardening_checks.sql`
- Confirmed run result: success (no unhandled exceptions, transaction rolls back by design).

## Screenshot Evidence

- Successful verification run:
  - `assets/Screenshot_2026-02-12_at_16.26.06-eadc614c-8702-4164-91f9-20bd48151f3a.png`

## SQL Executed for Recursion Hotfix

The following SQL was executed to resolve RLS recursion and then captured in migration `20260212124000_authz_hardening_recursion_fix.sql`:

```sql
create or replace function public.current_app_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u.role::text
  from public.users u
  where u.id = auth.uid();
$$;

revoke all on function public.current_app_user_role() from public;
grant execute on function public.current_app_user_role() to authenticated;

drop policy if exists "Users can update own row" on public.users;
create policy "Users can update own row"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function public.enforce_user_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.id and coalesce(public.current_app_user_role(), '') <> 'league_admin' then
    if new.role is distinct from old.role
       or new.club_id is distinct from old.club_id
       or new.created_at is distinct from old.created_at then
      raise exception 'Not allowed to update privileged user fields'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_user_privileged_fields on public.users;
create trigger trg_enforce_user_privileged_fields
before update on public.users
for each row
execute function public.enforce_user_privileged_fields();

drop policy if exists "Users can update their club claims" on public.pending_claims;
create policy "Users can update their club claims"
  on public.pending_claims for update
  using (
    auth.uid() = user_id
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
  )
  with check (
    auth.uid() = user_id
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
  );
```

## Acceptance Checklist

- [x] Supporter direct `users.role` self-promotion blocked
- [x] Supporter claim submit works and does not directly grant role
- [x] League admin approve updates role and claim review state
- [x] League admin reject updates claim review state without role promotion
- [x] Supporter cannot mutate claim status/review fields
- [x] Reviewed claim cannot be re-reviewed

## Quick DB Verification Queries

Use after manual claim-review actions in environment (outside rollback-based script):

```sql
-- Verify current role/club assignments for test users
select id, role, club_id
from public.users
where id in (
  '9d46bbed-a0f2-429a-8c97-bba3a2632c56', -- league admin
  'bb4be041-ea5b-4ddd-b6a4-e0e2fce3b51b', -- supporter 1
  'd3e3056e-a156-4aea-b3cc-94a0df296154'  -- supporter 2
);

-- Verify claim review audit fields are set only by reviewer
select id, user_id, club_id, status, reviewed_by, reviewed_at, created_at
from public.pending_claims
where user_id in (
  'bb4be041-ea5b-4ddd-b6a4-e0e2fce3b51b',
  'd3e3056e-a156-4aea-b3cc-94a0df296154'
)
order by created_at desc;
```
