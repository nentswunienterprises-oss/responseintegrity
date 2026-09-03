-- Align the Specialist pathway, Sandbox exit, intensive Trial window, and
-- package-led commercial model with the approved Response Integrity contract.
-- Additive only: legacy paid records remain mapped to the 8-session package.

-- ---------------------------------------------------------------------------
-- 8 / 12 / 16 monthly package contract
-- ---------------------------------------------------------------------------

ALTER TABLE onboarding_proposals
  ADD COLUMN IF NOT EXISTS package_key varchar(24) NOT NULL DEFAULT 'monthly_8',
  ADD COLUMN IF NOT EXISTS package_sessions integer NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS planned_sessions_per_week integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS package_amount numeric(10, 2) NOT NULL DEFAULT 1600.00,
  ADD COLUMN IF NOT EXISTS specialist_per_session_amount numeric(10, 2) NOT NULL DEFAULT 130.00,
  ADD COLUMN IF NOT EXISTS platform_per_session_amount numeric(10, 2) NOT NULL DEFAULT 70.00;

ALTER TABLE parent_enrollments
  ADD COLUMN IF NOT EXISTS package_key varchar(24) NOT NULL DEFAULT 'monthly_8',
  ADD COLUMN IF NOT EXISTS package_sessions integer NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS planned_sessions_per_week integer NOT NULL DEFAULT 2;

ALTER TABLE membership_months
  ADD COLUMN IF NOT EXISTS package_key varchar(24) NOT NULL DEFAULT 'monthly_8',
  ADD COLUMN IF NOT EXISTS planned_sessions_per_week integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS session_price numeric(10, 2) NOT NULL DEFAULT 200.00,
  ADD COLUMN IF NOT EXISTS specialist_per_session_amount numeric(10, 2) NOT NULL DEFAULT 130.00,
  ADD COLUMN IF NOT EXISTS platform_per_session_amount numeric(10, 2) NOT NULL DEFAULT 70.00,
  ADD COLUMN IF NOT EXISTS specialist_earned_amount numeric(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS specialist_payable_amount numeric(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payout_status varchar(24) NOT NULL DEFAULT 'accruing';

ALTER TABLE payment_transactions
  ADD COLUMN IF NOT EXISTS package_key varchar(24) NOT NULL DEFAULT 'monthly_8',
  ADD COLUMN IF NOT EXISTS package_sessions integer NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS planned_sessions_per_week integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS session_price numeric(10, 2) NOT NULL DEFAULT 200.00;

DO $$
BEGIN
  ALTER TABLE onboarding_proposals
    ADD CONSTRAINT onboarding_proposals_package_contract_check
    CHECK (
      (package_key = 'monthly_8' AND package_sessions = 8 AND planned_sessions_per_week = 2 AND package_amount = 1600.00)
      OR (package_key = 'monthly_12' AND package_sessions = 12 AND planned_sessions_per_week = 3 AND package_amount = 2400.00)
      OR (package_key = 'monthly_16' AND package_sessions = 16 AND planned_sessions_per_week = 4 AND package_amount = 3200.00)
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE parent_enrollments
    ADD CONSTRAINT parent_enrollments_package_contract_check
    CHECK (
      (package_key = 'monthly_8' AND package_sessions = 8 AND planned_sessions_per_week = 2)
      OR (package_key = 'monthly_12' AND package_sessions = 12 AND planned_sessions_per_week = 3)
      OR (package_key = 'monthly_16' AND package_sessions = 16 AND planned_sessions_per_week = 4)
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE membership_months
    ADD CONSTRAINT membership_months_package_contract_check
    CHECK (
      (package_key = 'monthly_8' AND session_quota = 8 AND planned_sessions_per_week = 2)
      OR (package_key = 'monthly_12' AND session_quota = 12 AND planned_sessions_per_week = 3)
      OR (package_key = 'monthly_16' AND session_quota = 16 AND planned_sessions_per_week = 4)
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE membership_months
    ADD CONSTRAINT membership_months_payout_status_check
    CHECK (payout_status IN ('accruing', 'evidence_blocked', 'payable', 'paid', 'withheld'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS specialist_package_payouts (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_month_id uuid NOT NULL UNIQUE REFERENCES membership_months(id),
  tutor_id varchar NOT NULL REFERENCES users(id),
  parent_id varchar NOT NULL,
  student_id varchar NOT NULL REFERENCES students(id),
  enrollment_id varchar,
  package_key varchar(24) NOT NULL CHECK (package_key IN ('monthly_8', 'monthly_12', 'monthly_16')),
  required_session_count integer NOT NULL CHECK (required_session_count IN (8, 12, 16)),
  eligible_session_count integer NOT NULL DEFAULT 0 CHECK (eligible_session_count >= 0),
  consumed_session_count integer NOT NULL DEFAULT 0 CHECK (consumed_session_count >= 0),
  accrued_amount numeric(10, 2) NOT NULL DEFAULT 0,
  payable_amount numeric(10, 2) NOT NULL DEFAULT 0,
  status varchar(24) NOT NULL DEFAULT 'accruing'
    CHECK (status IN ('accruing', 'evidence_blocked', 'payable', 'paid', 'withheld')),
  package_completed_at timestamptz,
  paid_at timestamptz,
  evidence_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_specialist_package_payouts_tutor_status
  ON specialist_package_payouts (tutor_id, status, updated_at DESC);

-- ---------------------------------------------------------------------------
-- Fixed 75-day Specialist Development Pathway, with documented extension to 90
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS specialist_development_pathways (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id varchar NOT NULL REFERENCES users(id),
  application_id varchar REFERENCES tutor_applications(id),
  tutor_assignment_id varchar REFERENCES tutor_assignments(id),
  status varchar(24) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'expired', 'exited')),
  started_at timestamptz NOT NULL,
  standard_ends_at timestamptz NOT NULL,
  maximum_ends_at timestamptz NOT NULL,
  extension_approved_at timestamptz,
  extension_approved_by_user_id varchar REFERENCES users(id),
  extension_reason text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (standard_ends_at = started_at + interval '75 days'),
  CHECK (maximum_ends_at = started_at + interval '90 days'),
  CHECK (
    (extension_approved_at IS NULL AND extension_approved_by_user_id IS NULL AND extension_reason IS NULL)
    OR (
      extension_approved_at IS NOT NULL
      AND extension_approved_by_user_id IS NOT NULL
      AND length(trim(extension_reason)) > 0
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_specialist_development_pathway_application
  ON specialist_development_pathways (application_id)
  WHERE application_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_specialist_development_pathway_open_tutor
  ON specialist_development_pathways (tutor_id)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_specialist_development_pathways_assignment
  ON specialist_development_pathways (tutor_assignment_id);

INSERT INTO specialist_development_pathways (
  tutor_id,
  application_id,
  status,
  started_at,
  standard_ends_at,
  maximum_ends_at
)
SELECT
  approved.user_id,
  approved.id,
  'active',
  approved.reviewed_at,
  approved.reviewed_at + interval '75 days',
  approved.reviewed_at + interval '90 days'
FROM (
  SELECT DISTINCT ON (user_id) id, user_id, reviewed_at
  FROM tutor_applications
  WHERE status = 'approved' AND reviewed_at IS NOT NULL
  ORDER BY user_id, reviewed_at DESC
) approved
WHERE NOT EXISTS (
  SELECT 1 FROM specialist_development_pathways pathway
  WHERE pathway.application_id = approved.id
     OR (pathway.tutor_id = approved.user_id AND pathway.status = 'active')
);

-- ---------------------------------------------------------------------------
-- Sandbox Mock Readiness Gate (an assessment inside Sandbox, not a new mode)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tutor_sandbox_mock_assessments (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id varchar NOT NULL REFERENCES users(id),
  tutor_assignment_id varchar NOT NULL REFERENCES tutor_assignments(id),
  decision varchar(32) NOT NULL CHECK (decision IN ('passed', 'remediation_required')),
  checklist jsonb NOT NULL,
  evidence_note text NOT NULL CHECK (length(trim(evidence_note)) > 0),
  assessed_by_user_id varchar NOT NULL REFERENCES users(id),
  assessed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tutor_sandbox_mock_assignment
  ON tutor_sandbox_mock_assessments (tutor_assignment_id, assessed_at DESC);

CREATE OR REPLACE FUNCTION record_tutor_sandbox_mock_assessment(
  p_tutor_id varchar,
  p_tutor_assignment_id varchar,
  p_decision varchar,
  p_checklist jsonb,
  p_evidence_note text,
  p_assessed_by_user_id varchar
)
RETURNS varchar
LANGUAGE plpgsql
AS $$
DECLARE
  current_mode tutor_operational_mode;
  assessment_id varchar := gen_random_uuid();
  checklist_complete boolean;
BEGIN
  IF p_decision NOT IN ('passed', 'remediation_required') THEN
    RAISE EXCEPTION 'Invalid Sandbox Mock decision';
  END IF;
  IF length(trim(coalesce(p_evidence_note, ''))) = 0 THEN
    RAISE EXCEPTION 'Sandbox Mock evidence is required';
  END IF;

  SELECT operational_mode INTO current_mode
  FROM tutor_assignments
  WHERE id = p_tutor_assignment_id AND tutor_id = p_tutor_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Specialist assignment not found';
  END IF;
  IF current_mode <> 'sandbox' THEN
    RAISE EXCEPTION 'Sandbox Mock can be decided only while the Specialist is in Sandbox';
  END IF;

  checklist_complete :=
    p_checklist @> '{"system_direction_followed": true}'::jsonb
    AND p_checklist @> '{"phase_constraints_preserved": true}'::jsonb
    AND p_checklist @> '{"evidence_captured": true}'::jsonb
    AND p_checklist @> '{"student_response_managed": true}'::jsonb
    AND p_checklist @> '{"system_result_respected": true}'::jsonb;

  IF p_decision = 'passed' AND NOT checklist_complete THEN
    RAISE EXCEPTION 'Every Sandbox Mock readiness criterion must pass before Trial opens';
  END IF;

  INSERT INTO tutor_sandbox_mock_assessments (
    id,
    tutor_id,
    tutor_assignment_id,
    decision,
    checklist,
    evidence_note,
    assessed_by_user_id
  ) VALUES (
    assessment_id,
    p_tutor_id,
    p_tutor_assignment_id,
    p_decision,
    p_checklist,
    trim(p_evidence_note),
    p_assessed_by_user_id
  );

  IF p_decision = 'passed' THEN
    UPDATE tutor_assignments
    SET operational_mode = 'trial'
    WHERE id = p_tutor_assignment_id;

    UPDATE tutor_battle_test_statuses
    SET mode = 'trial', updated_at = now(), last_synced_at = now()
    WHERE tutor_assignment_id = p_tutor_assignment_id;

    UPDATE tutor_portable_certification_snapshots
    SET mode = 'trial', updated_at = now(), last_synced_at = now()
    WHERE tutor_id = p_tutor_id;

    UPDATE specialist_development_pathways
    SET tutor_assignment_id = p_tutor_assignment_id, updated_at = now()
    WHERE tutor_id = p_tutor_id AND status = 'active';
  END IF;

  RETURN assessment_id;
END;
$$;

REVOKE ALL ON FUNCTION record_tutor_sandbox_mock_assessment(varchar, varchar, varchar, jsonb, text, varchar) FROM PUBLIC;
REVOKE ALL ON FUNCTION record_tutor_sandbox_mock_assessment(varchar, varchar, varchar, jsonb, text, varchar) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION record_tutor_sandbox_mock_assessment(varchar, varchar, varchar, jsonb, text, varchar) TO service_role;

-- ---------------------------------------------------------------------------
-- Intensive Trial: 2 families x 9 qualifying sessions inside a 14-day window
-- ---------------------------------------------------------------------------

ALTER TABLE tutor_trial_cases
  ADD COLUMN IF NOT EXISTS window_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS window_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS extension_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS extension_reason text,
  ADD COLUMN IF NOT EXISTS extension_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS extension_approved_by_user_id varchar REFERENCES users(id);

DO $$
BEGIN
  ALTER TABLE tutor_trial_cases
    ADD CONSTRAINT tutor_trial_case_window_check
    CHECK (
      (window_started_at IS NULL AND window_ends_at IS NULL)
      OR window_ends_at = window_started_at + interval '14 days'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE tutor_trial_cases
    ADD CONSTRAINT tutor_trial_case_extension_check
    CHECK (
      (extension_ends_at IS NULL AND extension_reason IS NULL AND extension_approved_at IS NULL AND extension_approved_by_user_id IS NULL)
      OR (
        extension_ends_at > window_ends_at
        AND length(trim(extension_reason)) > 0
        AND extension_approved_at IS NOT NULL
        AND extension_approved_by_user_id IS NOT NULL
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION start_tutor_trial_window_after_second_family()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  active_placement_count integer;
BEGIN
  IF NEW.status NOT IN ('active', 'completed') THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO active_placement_count
  FROM tutor_trial_placements
  WHERE case_id = NEW.case_id
    AND status IN ('active', 'completed');

  IF active_placement_count = 2 THEN
    UPDATE tutor_trial_cases
    SET
      window_started_at = coalesce(window_started_at, now()),
      window_ends_at = coalesce(window_ends_at, now() + interval '14 days'),
      updated_at = now()
    WHERE id = NEW.case_id
      AND window_started_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_start_tutor_trial_window ON tutor_trial_placements;
CREATE TRIGGER trg_start_tutor_trial_window
AFTER INSERT OR UPDATE OF case_id, status ON tutor_trial_placements
FOR EACH ROW EXECUTE FUNCTION start_tutor_trial_window_after_second_family();

WITH existing_windows AS (
  SELECT
    trial_case.id AS case_id,
    max(placement.started_at) AS window_started_at
  FROM tutor_trial_cases trial_case
  JOIN tutor_trial_placements placement ON placement.case_id = trial_case.id
  WHERE placement.status IN ('active', 'completed')
  GROUP BY trial_case.id
  HAVING count(*) = 2
)
UPDATE tutor_trial_cases trial_case
SET
  window_started_at = existing_windows.window_started_at,
  window_ends_at = existing_windows.window_started_at + interval '14 days',
  updated_at = now()
FROM existing_windows
WHERE trial_case.id = existing_windows.case_id
  AND trial_case.window_started_at IS NULL;

CREATE OR REPLACE FUNCTION complete_specialist_pathway_after_certification()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'certified' AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE specialist_development_pathways
    SET status = 'completed', completed_at = coalesce(completed_at, now()), updated_at = now()
    WHERE tutor_id = NEW.tutor_id AND status = 'active';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_complete_specialist_pathway ON tutor_trial_cases;
CREATE TRIGGER trg_complete_specialist_pathway
AFTER UPDATE OF status ON tutor_trial_cases
FOR EACH ROW EXECUTE FUNCTION complete_specialist_pathway_after_certification();

-- Recovery/rollback:
-- 1. Export the pathway, Sandbox Mock, Trial extension, and payout audit rows.
-- 2. Revert application code before removing new columns or tables.
-- 3. Drop triggers/functions, then new tables and columns only after confirming
--    that no active package, Trial, or payout process depends on them.
