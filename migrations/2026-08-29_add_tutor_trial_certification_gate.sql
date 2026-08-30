-- First-class tutor Trial lifecycle and certification evidence gate.
-- This migration is additive. It does not infer historical Trial evidence and it
-- does not demote existing Certified Live tutors.

ALTER TYPE tutor_certification_mode ADD VALUE IF NOT EXISTS 'trial' BEFORE 'certified_live';
ALTER TYPE tutor_operational_mode ADD VALUE IF NOT EXISTS 'applicant' BEFORE 'training';
ALTER TYPE tutor_operational_mode ADD VALUE IF NOT EXISTS 'sandbox' AFTER 'training';
ALTER TYPE tutor_operational_mode ADD VALUE IF NOT EXISTS 'trial' BEFORE 'certified_live';
ALTER TYPE tutor_operational_mode ADD VALUE IF NOT EXISTS 'watchlist' AFTER 'certified_live';
ALTER TYPE tutor_operational_mode ADD VALUE IF NOT EXISTS 'suspended' AFTER 'watchlist';

ALTER TABLE parent_enrollments
  ADD COLUMN IF NOT EXISTS assignment_lane varchar(16) NOT NULL DEFAULT 'commercial';

UPDATE parent_enrollments
SET assignment_lane = 'sandbox'
WHERE is_sandbox_account = true
  AND assignment_lane = 'commercial';

DO $$
BEGIN
  ALTER TABLE parent_enrollments
    ADD CONSTRAINT parent_enrollments_assignment_lane_check
    CHECK (assignment_lane IN ('commercial', 'sandbox', 'trial'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS tutor_trial_cases (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id varchar NOT NULL REFERENCES users(id),
  tutor_assignment_id varchar NOT NULL REFERENCES tutor_assignments(id),
  status varchar(32) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'reviewable', 'certified', 'remediation_required', 'unsuccessful')),
  risk_state varchar(24) NOT NULL DEFAULT 'clear'
    CHECK (risk_state IN ('clear', 'watchlist', 'remediation', 'suspended')),
  risk_note text,
  started_at timestamptz NOT NULL DEFAULT now(),
  reviewable_at timestamptz,
  closed_at timestamptz,
  created_by_user_id varchar REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tutor_trial_cases_open_tutor
  ON tutor_trial_cases (tutor_id)
  WHERE status IN ('active', 'reviewable', 'remediation_required');
CREATE INDEX IF NOT EXISTS idx_tutor_trial_cases_assignment
  ON tutor_trial_cases (tutor_assignment_id);

CREATE TABLE IF NOT EXISTS tutor_trial_placements (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id varchar NOT NULL REFERENCES tutor_trial_cases(id),
  enrollment_id uuid NOT NULL REFERENCES parent_enrollments(id),
  parent_id varchar NOT NULL,
  student_id varchar NOT NULL REFERENCES students(id),
  family_key varchar NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'ended')),
  required_session_count integer NOT NULL DEFAULT 9 CHECK (required_session_count = 9),
  feedback_state varchar(24) NOT NULL DEFAULT 'pending'
    CHECK (feedback_state IN ('pending', 'received', 'declined')),
  feedback_note text,
  feedback_recorded_at timestamptz,
  testimonial_permission varchar(24) NOT NULL DEFAULT 'not_requested'
    CHECK (testimonial_permission IN ('not_requested', 'granted', 'declined')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_by_user_id varchar REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, family_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tutor_trial_placements_open_enrollment
  ON tutor_trial_placements (enrollment_id)
  WHERE status IN ('active', 'completed');
CREATE INDEX IF NOT EXISTS idx_tutor_trial_placements_case
  ON tutor_trial_placements (case_id);
CREATE INDEX IF NOT EXISTS idx_tutor_trial_placements_student
  ON tutor_trial_placements (student_id);

CREATE OR REPLACE FUNCTION enforce_tutor_trial_placement_limit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  placement_count integer;
BEGIN
  IF NEW.status NOT IN ('active', 'completed') THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(NEW.case_id));
  SELECT count(*)
  INTO placement_count
  FROM tutor_trial_placements
  WHERE case_id = NEW.case_id
    AND status IN ('active', 'completed')
    AND id <> NEW.id;

  IF placement_count >= 2 THEN
    RAISE EXCEPTION 'A tutor Trial case cannot contain more than two family placements';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tutor_trial_placement_limit ON tutor_trial_placements;
CREATE TRIGGER trg_tutor_trial_placement_limit
BEFORE INSERT OR UPDATE OF case_id, status ON tutor_trial_placements
FOR EACH ROW EXECUTE FUNCTION enforce_tutor_trial_placement_limit();

CREATE TABLE IF NOT EXISTS tutor_trial_reviews (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id varchar NOT NULL UNIQUE REFERENCES tutor_trial_placements(id),
  outcome_classification varchar(24) NOT NULL
    CHECK (outcome_classification IN ('positive', 'mixed', 'negative')),
  decision varchar(32) NOT NULL
    CHECK (decision IN ('positive', 'remediation_required', 'unsuccessful')),
  evidence_note text NOT NULL CHECK (length(trim(evidence_note)) > 0),
  reviewed_by_user_id varchar NOT NULL REFERENCES users(id),
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tutor_certification_decisions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id varchar NOT NULL REFERENCES tutor_trial_cases(id),
  decision varchar(32) NOT NULL
    CHECK (decision IN ('certified', 'remediation_required', 'unsuccessful')),
  rationale text NOT NULL CHECK (length(trim(rationale)) > 0),
  idempotency_key varchar NOT NULL UNIQUE,
  decided_by_user_id varchar NOT NULL REFERENCES users(id),
  decided_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tutor_certification_decisions_certified_case
  ON tutor_certification_decisions (case_id)
  WHERE decision = 'certified';
CREATE INDEX IF NOT EXISTS idx_tutor_certification_decisions_case
  ON tutor_certification_decisions (case_id, decided_at DESC);

CREATE OR REPLACE FUNCTION decide_tutor_trial_case(
  p_case_id varchar,
  p_decision varchar,
  p_rationale text,
  p_idempotency_key varchar,
  p_decided_by_user_id varchar
)
RETURNS varchar
LANGUAGE plpgsql
AS $$
DECLARE
  trial_case tutor_trial_cases%ROWTYPE;
  existing_decision_id varchar;
  decision_id varchar := gen_random_uuid();
BEGIN
  IF p_decision NOT IN ('certified', 'remediation_required', 'unsuccessful') THEN
    RAISE EXCEPTION 'Invalid Trial certification decision';
  END IF;
  IF length(trim(coalesce(p_rationale, ''))) = 0 THEN
    RAISE EXCEPTION 'A certification rationale is required';
  END IF;

  SELECT id INTO existing_decision_id
  FROM tutor_certification_decisions
  WHERE idempotency_key = p_idempotency_key;
  IF existing_decision_id IS NOT NULL THEN
    RETURN existing_decision_id;
  END IF;

  SELECT * INTO trial_case
  FROM tutor_trial_cases
  WHERE id = p_case_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trial case not found';
  END IF;
  IF p_decision = 'certified' AND (trial_case.status <> 'reviewable' OR trial_case.risk_state <> 'clear') THEN
    RAISE EXCEPTION 'Trial case is not open for certification approval';
  END IF;
  IF p_decision = 'certified' AND (
    SELECT count(*)
    FROM tutor_trial_placements placement
    JOIN tutor_trial_reviews review ON review.placement_id = placement.id
    WHERE placement.case_id = p_case_id
      AND placement.status IN ('active', 'completed')
      AND review.decision = 'positive'
  ) <> 2 THEN
    RAISE EXCEPTION 'Two positive family outcome reviews are required';
  END IF;
  IF trial_case.status IN ('certified', 'unsuccessful') THEN
    SELECT id INTO existing_decision_id
    FROM tutor_certification_decisions
    WHERE case_id = p_case_id
      AND decision = CASE WHEN trial_case.status = 'certified' THEN 'certified' ELSE 'unsuccessful' END
    ORDER BY decided_at DESC
    LIMIT 1;
    IF existing_decision_id IS NOT NULL THEN
      RETURN existing_decision_id;
    END IF;
  END IF;

  INSERT INTO tutor_certification_decisions (
    id, case_id, decision, rationale, idempotency_key, decided_by_user_id
  ) VALUES (
    decision_id, p_case_id, p_decision, trim(p_rationale), p_idempotency_key, p_decided_by_user_id
  );

  IF p_decision = 'certified' THEN
    UPDATE tutor_trial_cases
    SET status = 'certified', risk_state = 'clear', closed_at = now(), updated_at = now()
    WHERE id = p_case_id;

    UPDATE tutor_battle_test_statuses
    SET mode = 'certified_live', updated_at = now(), last_synced_at = now()
    WHERE tutor_assignment_id = trial_case.tutor_assignment_id;

    UPDATE tutor_assignments
    SET operational_mode = 'certified_live'
    WHERE id = trial_case.tutor_assignment_id;

    UPDATE tutor_portable_certification_snapshots
    SET mode = 'certified_live', updated_at = now(), last_synced_at = now()
    WHERE tutor_id = trial_case.tutor_id;
  ELSIF p_decision = 'remediation_required' THEN
    UPDATE tutor_trial_cases
    SET status = 'remediation_required', risk_state = 'remediation', risk_note = trim(p_rationale), updated_at = now()
    WHERE id = p_case_id;
  ELSE
    UPDATE tutor_trial_cases
    SET status = 'unsuccessful', risk_state = 'remediation', risk_note = trim(p_rationale), closed_at = now(), updated_at = now()
    WHERE id = p_case_id;
  END IF;

  RETURN decision_id;
END;
$$;

REVOKE ALL ON FUNCTION decide_tutor_trial_case(varchar, varchar, text, varchar, varchar) FROM PUBLIC;
REVOKE ALL ON FUNCTION decide_tutor_trial_case(varchar, varchar, text, varchar, varchar) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION decide_tutor_trial_case(varchar, varchar, text, varchar, varchar) TO service_role;

-- Rollback/recovery path (manual, only after exporting Trial audit rows):
-- 1. Restore affected tutor modes to training/certified_live as appropriate.
-- 2. Restore parent_enrollments.assignment_lane to commercial/sandbox.
-- 3. Drop the trigger, function, four Trial tables, and assignment_lane column.
-- PostgreSQL enum values are intentionally retained during rollback because
-- removing enum values requires a destructive type rebuild.
