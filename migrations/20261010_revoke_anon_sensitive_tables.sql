-- Response Integrity: contain anonymous data API access to sensitive legacy relations.
-- Production: apply ONLY via protected Production DB Promotion plan -> approval -> apply -> ledger verification.
-- Does not modify data, authenticated/service_role privileges, or activate RLS policies.
-- Requires app compatibility and isolated permission regression proof before protected apply.
REVOKE ALL PRIVILEGES ON TABLE
  public.users,
  public.parents,
  public.students,
  public.tutor_applications,
  public.tutor_assignments,
  public.scheduled_sessions,
  public.payment_transactions,
  public.tutor_trial_cases
FROM PUBLIC, anon;
