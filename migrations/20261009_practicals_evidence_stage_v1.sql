-- Stage-scoped practical evidence, adapted from the unmerged Capability Engine Sprint 14.
-- No live identity may graduate through this migration alone.

CREATE TABLE IF NOT EXISTS public.specialist_capability_practical_evidence (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tutor_assignment_id varchar NOT NULL REFERENCES public.tutor_assignments(id),
  tutor_id varchar NOT NULL REFERENCES public.users(id),
  proof_key varchar NOT NULL CHECK (proof_key IN ('prepare', 'execute', 'evidence')),
  proof_version integer NOT NULL CHECK (proof_version > 0),
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  artifact_url text NOT NULL,
  artifact_type varchar NOT NULL CHECK (artifact_type IN ('screen_voice', 'screen_video', 'video')),
  declaration jsonb NOT NULL,
  competency_links jsonb NOT NULL,
  no_real_student_data_confirmed boolean NOT NULL CHECK (no_real_student_data_confirmed = true),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tutor_assignment_id, proof_key, proof_version, attempt_number)
);

ALTER TABLE public.specialist_capability_practical_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.specialist_capability_practical_evidence FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.specialist_capability_practical_reviews (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  evidence_id varchar NOT NULL UNIQUE REFERENCES public.specialist_capability_practical_evidence(id),
  reviewer_id varchar NOT NULL REFERENCES public.users(id),
  reviewer_role varchar NOT NULL,
  outcome varchar NOT NULL CHECK (outcome IN ('approved', 'repeat_required', 'integrity_review')),
  reason_code varchar,
  feedback text,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.specialist_capability_practical_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.specialist_capability_practical_reviews FROM PUBLIC, anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_capability_practical_tutor
  ON public.specialist_capability_practical_evidence (tutor_assignment_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_capability_practical_reviewed_at
  ON public.specialist_capability_practical_reviews (reviewed_at DESC);


ALTER TABLE public.specialist_capability_practical_evidence ADD COLUMN IF NOT EXISTS rubric_version integer;
ALTER TABLE public.specialist_capability_practical_evidence ADD COLUMN IF NOT EXISTS rubric_snapshot jsonb;
ALTER TABLE public.specialist_capability_practical_reviews ADD COLUMN IF NOT EXISTS rubric_version integer;
ALTER TABLE public.specialist_capability_practical_reviews ADD COLUMN IF NOT EXISTS outcome_rule_version integer;
ALTER TABLE public.specialist_capability_practical_reviews ADD COLUMN IF NOT EXISTS criterion_judgments jsonb;
ALTER TABLE public.specialist_capability_practical_reviews ADD COLUMN IF NOT EXISTS clear_count integer;
ALTER TABLE public.specialist_capability_practical_reviews ADD COLUMN IF NOT EXISTS partial_count integer;
ALTER TABLE public.specialist_capability_practical_reviews ADD COLUMN IF NOT EXISTS fail_count integer;
ALTER TABLE public.specialist_capability_practical_reviews ADD COLUMN IF NOT EXISTS critical_fail_count integer;
ALTER TABLE public.specialist_capability_practical_reviews ADD COLUMN IF NOT EXISTS critical_fail_criterion_keys jsonb;

-- Legacy Sandbox exit approval table is required by the current TD endpoint, not as an automatic Trial transition.
CREATE TABLE IF NOT EXISTS public.tutor_sandbox_mock_assessments (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tutor_id varchar NOT NULL REFERENCES public.users(id),
  tutor_assignment_id varchar NOT NULL REFERENCES public.tutor_assignments(id),
  decision varchar(32) NOT NULL CHECK (decision IN ('passed', 'remediation_required')),
  checklist jsonb NOT NULL,
  evidence_note text NOT NULL CHECK (length(trim(evidence_note)) > 0),
  assessed_by_user_id varchar NOT NULL REFERENCES public.users(id),
  assessed_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tutor_sandbox_mock_assignment ON public.tutor_sandbox_mock_assessments(tutor_assignment_id, assessed_at DESC);
ALTER TABLE public.tutor_sandbox_mock_assessments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.tutor_sandbox_mock_assessments FROM PUBLIC, anon, authenticated;
-- Existing sandboxReadiness uses a server-owned Supabase client for this table.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tutor_sandbox_mock_assessments TO service_role;

-- Declarative completion evidence; not Trial permission. TD approval is deliberately not automatic.
CREATE TABLE IF NOT EXISTS public.specialist_practical_completion_decisions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tutor_assignment_id varchar NOT NULL REFERENCES public.tutor_assignments(id),
  tutor_id varchar NOT NULL REFERENCES public.users(id),
  td_user_id varchar NOT NULL REFERENCES public.users(id),
  decision varchar NOT NULL CHECK(decision IN ('approved', 'remediation_required')),
  proof_evidence_ids jsonb NOT NULL,
  evidence_note text NOT NULL CHECK(length(trim(evidence_note)) >= 30),
  decided_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.specialist_practical_completion_decisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.specialist_practical_completion_decisions FROM PUBLIC, anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_practical_decisions_assignment ON public.specialist_practical_completion_decisions (tutor_assignment_id,decided_at DESC);


-- Execute v2 has a private, server-assigned adaptive plan and an append-only public
-- transcript. Specialist routes project only the current turn, never future outcomes.
CREATE TABLE IF NOT EXISTS public.specialist_practical_execute_challenges (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tutor_assignment_id varchar NOT NULL REFERENCES public.tutor_assignments(id),
  tutor_id varchar NOT NULL REFERENCES public.users(id),
  challenge_version integer NOT NULL CHECK(challenge_version > 0),
  attempt_number integer NOT NULL CHECK(attempt_number > 0),
  status varchar NOT NULL CHECK(status IN ('active','complete')),
  active_turn integer NOT NULL CHECK(active_turn BETWEEN 1 AND 4),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE(tutor_assignment_id,challenge_version,attempt_number)
);
ALTER TABLE public.specialist_practical_execute_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.specialist_practical_execute_challenges FROM PUBLIC,anon,authenticated;
CREATE INDEX IF NOT EXISTS idx_practical_execute_owner ON public.specialist_practical_execute_challenges(tutor_id,tutor_assignment_id,attempt_number);

CREATE TABLE IF NOT EXISTS private.specialist_practical_execute_challenge_truth (
  challenge_id varchar PRIMARY KEY REFERENCES public.specialist_practical_execute_challenges(id),
  plan jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.specialist_practical_execute_challenge_truth ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.specialist_practical_execute_challenge_truth FROM PUBLIC,anon,authenticated;

CREATE TABLE IF NOT EXISTS public.specialist_practical_execute_turns (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  challenge_id varchar NOT NULL REFERENCES public.specialist_practical_execute_challenges(id),
  turn_number integer NOT NULL CHECK(turn_number BETWEEN 1 AND 3),
  event_snapshot jsonb NOT NULL,
  specialist_response jsonb NOT NULL,
  risk_flags jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(challenge_id,turn_number)
);
ALTER TABLE public.specialist_practical_execute_turns ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.specialist_practical_execute_turns FROM PUBLIC,anon,authenticated;

-- Evidence cannot claim a live Execute v2 proof without an exact challenge link.
ALTER TABLE public.specialist_capability_practical_evidence
  ADD COLUMN IF NOT EXISTS execute_challenge_id varchar
    REFERENCES public.specialist_practical_execute_challenges(id);
ALTER TABLE public.specialist_capability_practical_evidence
  ADD CONSTRAINT specialist_practical_execute_v2_link_required
  CHECK (proof_key <> 'execute' OR proof_version < 2 OR execute_challenge_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS uq_practical_execute_link
  ON public.specialist_capability_practical_evidence(execute_challenge_id)
  WHERE execute_challenge_id IS NOT NULL;

CREATE OR REPLACE FUNCTION private.validate_execute_evidence_link()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$ BEGIN
  IF NEW.proof_key = 'execute' AND NEW.proof_version >= 2 THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.specialist_practical_execute_challenges c
      WHERE c.id = NEW.execute_challenge_id
        AND c.tutor_assignment_id = NEW.tutor_assignment_id
        AND c.tutor_id = NEW.tutor_id
        AND c.attempt_number = NEW.attempt_number
        AND c.status = 'complete'
        AND c.active_turn = 4
        AND (SELECT COUNT(*) FROM public.specialist_practical_execute_turns t WHERE t.challenge_id = c.id) = 3
    ) THEN
      RAISE EXCEPTION 'Execute v2 requires exactly three persisted, matching challenge turns';
    END IF;
  ELSIF NEW.execute_challenge_id IS NOT NULL THEN
    RAISE EXCEPTION 'Only Execute may reference an Execute challenge';
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.validate_execute_evidence_link() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_validate_practical_execute_link ON public.specialist_capability_practical_evidence;
CREATE TRIGGER trg_validate_practical_execute_link
  BEFORE INSERT ON public.specialist_capability_practical_evidence
  FOR EACH ROW EXECUTE FUNCTION private.validate_execute_evidence_link();

CREATE OR REPLACE FUNCTION private.reject_practical_execute_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$ BEGIN RAISE EXCEPTION 'Practicals scenario truth and executed turns are immutable'; END; $$;
REVOKE ALL ON FUNCTION private.reject_practical_execute_mutation() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_execute_turn_immutable ON public.specialist_practical_execute_turns;
CREATE TRIGGER trg_execute_turn_immutable
  BEFORE UPDATE OR DELETE ON public.specialist_practical_execute_turns
  FOR EACH ROW EXECUTE FUNCTION private.reject_practical_execute_mutation();
DROP TRIGGER IF EXISTS trg_execute_truth_immutable ON private.specialist_practical_execute_challenge_truth;
CREATE TRIGGER trg_execute_truth_immutable
  BEFORE UPDATE OR DELETE ON private.specialist_practical_execute_challenge_truth
  FOR EACH ROW EXECUTE FUNCTION private.reject_practical_execute_mutation();

-- The review, submission and final completion ledger must be append-only.
-- Removing an assignment or user must not silently erase qualification proof.
DROP TRIGGER IF EXISTS trg_practical_submission_immutable ON public.specialist_capability_practical_evidence;
CREATE TRIGGER trg_practical_submission_immutable
  BEFORE UPDATE OR DELETE ON public.specialist_capability_practical_evidence
  FOR EACH ROW EXECUTE FUNCTION private.reject_practical_execute_mutation();
DROP TRIGGER IF EXISTS trg_practical_review_immutable ON public.specialist_capability_practical_reviews;
CREATE TRIGGER trg_practical_review_immutable
  BEFORE UPDATE OR DELETE ON public.specialist_capability_practical_reviews
  FOR EACH ROW EXECUTE FUNCTION private.reject_practical_execute_mutation();
DROP TRIGGER IF EXISTS trg_practical_completion_immutable ON public.specialist_practical_completion_decisions;
CREATE TRIGGER trg_practical_completion_immutable
  BEFORE UPDATE OR DELETE ON public.specialist_practical_completion_decisions
  FOR EACH ROW EXECUTE FUNCTION private.reject_practical_execute_mutation();

CREATE OR REPLACE FUNCTION private.guard_practical_execute_challenge_transition()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$ BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Execute challenges cannot be deleted or reset';
  END IF;
  IF OLD.status <> 'active'
     OR NEW.id IS DISTINCT FROM OLD.id
     OR NEW.tutor_assignment_id IS DISTINCT FROM OLD.tutor_assignment_id
     OR NEW.tutor_id IS DISTINCT FROM OLD.tutor_id
     OR NEW.challenge_version IS DISTINCT FROM OLD.challenge_version
     OR NEW.attempt_number IS DISTINCT FROM OLD.attempt_number
     OR NEW.started_at IS DISTINCT FROM OLD.started_at
     OR NEW.active_turn <> OLD.active_turn + 1
     OR NEW.active_turn > 4
     OR (NEW.active_turn = 4 AND (NEW.status <> 'complete' OR NEW.completed_at IS NULL))
     OR (NEW.active_turn < 4 AND (NEW.status <> 'active' OR NEW.completed_at IS NOT NULL))
  THEN
    RAISE EXCEPTION 'Execute challenge must advance one recorded turn, never reset';
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.guard_practical_execute_challenge_transition() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_practical_execute_challenge_guard ON public.specialist_practical_execute_challenges;
CREATE TRIGGER trg_practical_execute_challenge_guard
  BEFORE UPDATE OR DELETE ON public.specialist_practical_execute_challenges
  FOR EACH ROW EXECUTE FUNCTION private.guard_practical_execute_challenge_transition();

-- An Execute v2 TD decision must retain the reviewer's affirmative video/trace concordance declaration.
ALTER TABLE public.specialist_capability_practical_reviews
  ADD COLUMN IF NOT EXISTS execute_trace_video_verified boolean NOT NULL DEFAULT false;
