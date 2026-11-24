-- Applied remotely as migration 20261124121918.
-- Lock down author approval, submission states, and profile role escalation.

DROP POLICY IF EXISTS "Authors can create own profile" ON public.author_profiles;
CREATE POLICY "Authors can create own pending profile"
  ON public.author_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND status = 'pending'
  );

DROP POLICY IF EXISTS "Authors can update own profile" ON public.author_profiles;

DROP POLICY IF EXISTS "Approved authors can submit articles" ON public.author_submissions;
CREATE POLICY "Approved authors can submit draft or pending articles"
  ON public.author_submissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    status IN ('draft', 'pending')
    AND EXISTS (
      SELECT 1
      FROM public.author_profiles
      WHERE author_profiles.id = author_submissions.author_id
        AND author_profiles.user_id = (SELECT auth.uid())
        AND author_profiles.status = 'approved'
    )
  );

CREATE OR REPLACE FUNCTION public.guard_profile_role_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  caller_is_admin boolean;
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND role = 'admin'
    )
    INTO caller_is_admin;

    IF NOT COALESCE(caller_is_admin, false) THEN
      RAISE EXCEPTION 'Only administrators may change profile roles.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.guard_profile_role_update() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS guard_profile_role_update ON public.profiles;
CREATE TRIGGER guard_profile_role_update
  BEFORE UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_role_update();
