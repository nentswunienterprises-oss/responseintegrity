-- Supabase default privileges may pre-grant ALL to service_role for new public tables.
-- Restrict to the privileges used by the server-side intake and reviewer paths.
REVOKE ALL ON TABLE public.issue_reports FROM service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.issue_reports TO service_role;
REVOKE ALL ON TABLE public.issue_report_status_events FROM service_role;
GRANT SELECT, INSERT ON TABLE public.issue_report_status_events TO service_role;
