-- #178: protected Production DB Promotion only. No data/ownership changes.
-- Direct browser table access is denied; existing privileged server grants survive.
DO $contain$
DECLARE
  reviewed text[] := ARRAY['academic_profiles',
    'affiliate_applications',
    'affiliate_onboarding_acceptance_events',
    'affiliate_onboarding_acceptances',
    'affiliate_onboarding_clause_acknowledgements',
    'assignments',
    'battle_test_rep_logs',
    'battle_test_runs',
    'broadcast_reads',
    'broadcasts',
    'commitment_logs',
    'coo_brain_library_items',
    'egp_crew_members',
    'egp_crews',
    'executive_command_tasks',
    'executive_profiles',
    'executive_role_appointments',
    'executive_task_proofs',
    'executive_task_time_logs',
    'executive_weekly_records',
    'intro_session_drills',
    'membership_months',
    'notifications',
    'onboarding_proposals',
    'parent_reports',
    'parents',
    'payment_transactions',
    'pods',
    'push_subscriptions',
    'reflections',
    'scheduled_sessions',
    'session_billing_events',
    'sessions',
    'struggle_targets',
    'student_commitments',
    'student_communication_messages',
    'student_communication_threads',
    'student_reflections',
    'student_sessions',
    'student_users',
    'students',
    'td_applications',
    'td_onboarding_acceptance_events',
    'td_onboarding_acceptances',
    'td_onboarding_clause_acknowledgements',
    'topic_conditioning_activations',
    'training_session_runs',
    'tutor_applications',
    'tutor_assignments',
    'tutor_battle_test_deep_dive_progress',
    'tutor_battle_test_statuses',
    'tutor_certification_decisions',
    'tutor_onboarding_acceptance_events',
    'tutor_onboarding_acceptances',
    'tutor_onboarding_clause_acknowledgements',
    'tutor_trial_cases',
    'tutor_trial_placements',
    'tutor_trial_reviews',
    'tutoring_sessions',
    'users',
    'verification_docs',
    'weekly_check_ins'];
  permissive_reviewed text[] := ARRAY['early_intervention_requests','leadership_pilot_requests','school_campaigns'];
  relation text;
  column_name text;
  unexpected text; BEGIN
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname) INTO unexpected
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('r','p')
    AND NOT c.relrowsecurity AND NOT (c.relname=ANY(reviewed));
  IF unexpected IS NOT NULL THEN
    RAISE EXCEPTION 'P0 catalog drift: unreviewed no-RLS tables: %', unexpected;
  END IF;
  FOREACH relation IN ARRAY reviewed LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=relation AND c.relkind IN ('r','p')) THEN
      RAISE EXCEPTION 'P0 catalog drift: missing reviewed table %', relation;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=relation) THEN
      RAISE EXCEPTION 'P0 catalog drift: review policies on % before promotion', relation;
    END IF;
  END LOOP;
  FOREACH relation IN ARRAY permissive_reviewed LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=relation AND c.relkind IN ('r','p') AND c.relrowsecurity) THEN
      RAISE EXCEPTION 'P0 catalog drift: missing reviewed RLS table %', relation;
    END IF;
  END LOOP;
  -- Validation completes before the first mutation. Runner owns the transaction.
  FOREACH relation IN ARRAY (reviewed || permissive_reviewed) LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC, anon, authenticated',relation);
    FOR column_name IN SELECT a.attname FROM pg_attribute a
      WHERE a.attrelid=format('public.%I',relation)::regclass AND a.attnum>0 AND NOT a.attisdropped
    LOOP
      EXECUTE format('REVOKE ALL PRIVILEGES (%I) ON TABLE public.%I FROM PUBLIC, anon, authenticated',column_name,relation);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',relation);
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p') AND NOT c.relrowsecurity) THEN
    RAISE EXCEPTION 'P0 postcondition: public no-RLS table remains';
  END IF;
END
$contain$;
