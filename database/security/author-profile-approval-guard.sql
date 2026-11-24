-- EduAxis India: prevent contributors from self-approving author profiles.
-- Apply this migration to the dedicated staging database first, verify it there,
-- and only then include it in the production release process.
--
-- The previous INSERT policy checked ownership but did not constrain status.
-- A caller could therefore send status = 'approved' directly to the Data API.

begin;

drop policy if exists "Authors can create own profile"
  on public.author_profiles;

drop policy if exists "Authors can create own pending profile"
  on public.author_profiles;

create policy "Authors can create own pending profile"
  on public.author_profiles
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
  );

comment on policy "Authors can create own pending profile"
  on public.author_profiles
  is 'New author applications must belong to the signed-in user and start in pending status. Approval remains admin-controlled.';

commit;

-- Verification (run after applying):
-- select policyname, cmd, roles, with_check
-- from pg_policies
-- where schemaname = 'public'
--   and tablename = 'author_profiles'
--   and cmd = 'INSERT';
--
-- Expected: one authenticated INSERT policy whose WITH CHECK contains
-- both user_id = auth.uid() and status = 'pending'.
