-- Restore the server-only, security-invoker contract for the scheduled
-- sessions projection. This is intentionally limited to the existing view;
-- it does not alter the underlying scheduled-session data or table policies.

ALTER VIEW public.scheduled_sessions_with_names
  SET (security_invoker = true);

REVOKE ALL PRIVILEGES
  ON TABLE public.scheduled_sessions_with_names
  FROM PUBLIC, anon, authenticated;

GRANT SELECT
  ON TABLE public.scheduled_sessions_with_names
  TO service_role;
