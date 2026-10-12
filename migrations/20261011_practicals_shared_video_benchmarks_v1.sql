-- Founder-approved Practicals video benchmark v1, 11 October 2026.
-- Additive, fail-closed. No live Specialist/family/TD status is changed.
-- One fixed three-case benchmark per proof, per attempt; videos are primary
-- performance evidence. Exact case lineage and TD judgments are append-only.

CREATE TABLE public.specialist_practical_benchmark_runs (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tutor_assignment_id varchar NOT NULL REFERENCES public.tutor_assignments(id),
  tutor_id varchar NOT NULL REFERENCES public.users(id),
  proof_key varchar NOT NULL CHECK (proof_key IN ('prepare','execute','evidence')),
  proof_version integer NOT NULL CHECK (proof_version>0),
  bank_version integer NOT NULL CHECK (bank_version=1),
  attempt_number integer NOT NULL CHECK (attempt_number>0),
  preflight_attested boolean NOT NULL CHECK (preflight_attested=true),
  recording_started_before_reveal_attested boolean NOT NULL CHECK (recording_started_before_reveal_attested=true),
  status varchar NOT NULL DEFAULT 'active' CHECK (status IN ('active','complete','abandoned')),
  active_case_index integer NOT NULL DEFAULT 1 CHECK (active_case_index BETWEEN 1 AND 4),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (tutor_assignment_id,proof_key,proof_version,attempt_number)
);
ALTER TABLE public.specialist_practical_benchmark_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.specialist_practical_benchmark_runs FROM PUBLIC,anon,authenticated;
CREATE INDEX idx_practical_benchmark_owner
  ON public.specialist_practical_benchmark_runs(tutor_id,tutor_assignment_id,proof_key);

CREATE TABLE public.specialist_practical_benchmark_case_reveals (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  run_id varchar NOT NULL REFERENCES public.specialist_practical_benchmark_runs(id),
  case_sequence integer NOT NULL CHECK(case_sequence BETWEEN 1 AND 3),
  case_key varchar NOT NULL,
  case_version integer NOT NULL CHECK(case_version>0),
  case_snapshot jsonb NOT NULL,
  revealed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(run_id,case_sequence),
  UNIQUE(run_id,case_key)
);
ALTER TABLE public.specialist_practical_benchmark_case_reveals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.specialist_practical_benchmark_case_reveals FROM PUBLIC,anon,authenticated;
CREATE INDEX idx_practical_benchmark_case_run ON public.specialist_practical_benchmark_case_reveals(run_id,case_sequence);


-- Every case step is an actual server-owned operation in an isolated Practicals
-- workspace, never a production student/Sandbox/Trial state mutation.
CREATE TABLE public.specialist_practical_case_actions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  run_id varchar NOT NULL REFERENCES public.specialist_practical_benchmark_runs(id),
  case_sequence integer NOT NULL CHECK (case_sequence BETWEEN 1 AND 3),
  step_number integer NOT NULL CHECK (step_number > 0),
  operation_key varchar NOT NULL CHECK (operation_key IN ('configure','respond','begin_rep','rep','adaptive','decide')),
  recorded_payload jsonb NOT NULL,
  system_snapshot jsonb NOT NULL,
  risk_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (run_id,case_sequence) REFERENCES public.specialist_practical_benchmark_case_reveals(run_id,case_sequence),
  UNIQUE(run_id,case_sequence,step_number)
);
ALTER TABLE public.specialist_practical_case_actions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.specialist_practical_case_actions FROM PUBLIC,anon,authenticated;
CREATE INDEX idx_practical_case_actions_trace
  ON public.specialist_practical_case_actions(run_id,case_sequence,step_number);

CREATE OR REPLACE FUNCTION private.guard_practical_case_action_append()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE
  active_index integer;
  run_status varchar;
  issued jsonb;
  previous_count integer; BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN
    RAISE EXCEPTION 'Practicals operations are immutable';
  END IF;
  SELECT r.active_case_index,r.status INTO active_index,run_status
    FROM public.specialist_practical_benchmark_runs r WHERE r.id=NEW.run_id FOR UPDATE;
  SELECT c.case_snapshot INTO issued
    FROM public.specialist_practical_benchmark_case_reveals c
    WHERE c.run_id=NEW.run_id AND c.case_sequence=NEW.case_sequence;
  SELECT COUNT(*) INTO previous_count FROM public.specialist_practical_case_actions a
    WHERE a.run_id=NEW.run_id AND a.case_sequence=NEW.case_sequence;
  IF active_index IS NULL OR run_status<>'active'
     OR active_index<>NEW.case_sequence
     OR issued IS NULL
     OR jsonb_typeof(issued->'workflowSteps') IS DISTINCT FROM 'array'
     OR NEW.step_number<>previous_count+1
     OR NEW.step_number>jsonb_array_length(issued->'workflowSteps')
     OR NEW.operation_key IS DISTINCT FROM
          issued->'workflowSteps'->(NEW.step_number-1)->>'kind'
     OR NEW.system_snapshot IS DISTINCT FROM
          issued->'workflowSteps'->(NEW.step_number-1)
  THEN RAISE EXCEPTION 'Practicals operation is missing, out of sequence, or mismatched to its issued case'; END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.guard_practical_case_action_append() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trg_practical_case_actions_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.specialist_practical_case_actions
  FOR EACH ROW EXECUTE FUNCTION private.guard_practical_case_action_append();


-- A broken original recording is never overwritten or silently restarted.
-- A new attempt requires a recorded decision by the assigned TD.
CREATE TABLE public.specialist_practical_recording_recovery_requests (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  run_id varchar NOT NULL UNIQUE REFERENCES public.specialist_practical_benchmark_runs(id),
  reason varchar NOT NULL CHECK (reason IN
    ('recording_interrupted','recording_unusable','accessibility_failure')),
  incident_note text NOT NULL CHECK (length(btrim(incident_note)) BETWEEN 30 AND 3000),
  requested_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.specialist_practical_recording_recovery_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.specialist_practical_recording_recovery_requests FROM PUBLIC,anon,authenticated;

CREATE TABLE public.specialist_practical_recording_recovery_decisions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  request_id varchar NOT NULL UNIQUE REFERENCES public.specialist_practical_recording_recovery_requests(id),
  reviewer_id varchar NOT NULL REFERENCES public.users(id),
  decision varchar NOT NULL CHECK (decision IN ('approve_repeat','deny','integrity_review')),
  rationale text NOT NULL CHECK (length(btrim(rationale)) BETWEEN 30 AND 3000),
  decided_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.specialist_practical_recording_recovery_decisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.specialist_practical_recording_recovery_decisions FROM PUBLIC,anon,authenticated;

CREATE TRIGGER trg_practical_recovery_request_immutable
  BEFORE UPDATE OR DELETE ON public.specialist_practical_recording_recovery_requests
  FOR EACH ROW EXECUTE FUNCTION private.reject_practical_execute_mutation();
CREATE TRIGGER trg_practical_recovery_decision_immutable
  BEFORE UPDATE OR DELETE ON public.specialist_practical_recording_recovery_decisions
  FOR EACH ROW EXECUTE FUNCTION private.reject_practical_execute_mutation();
CREATE INDEX idx_practical_recovery_reviewer
  ON public.specialist_practical_recording_recovery_requests(run_id,requested_at);

-- Current protocol revisions become mandatory. Old proof records remain
-- historical, but cannot stand in for the new issued benchmark/video.
ALTER TABLE public.specialist_capability_practical_evidence
  ADD COLUMN benchmark_run_id varchar REFERENCES public.specialist_practical_benchmark_runs(id);
ALTER TABLE public.specialist_capability_practical_evidence
  ADD COLUMN recording_duration_seconds integer;
ALTER TABLE public.specialist_capability_practical_evidence
  ADD COLUMN recording_started_before_reveal_attested boolean;
ALTER TABLE public.specialist_capability_practical_evidence
  ADD COLUMN continuous_unedited_attested boolean;
ALTER TABLE public.specialist_capability_practical_evidence
  ADD COLUMN setup_tools_demonstrated_attested boolean;
CREATE UNIQUE INDEX uq_practical_benchmark_submission_run
  ON public.specialist_capability_practical_evidence(benchmark_run_id)
  WHERE benchmark_run_id IS NOT NULL;

ALTER TABLE public.specialist_capability_practical_reviews
  ADD COLUMN benchmark_case_reviews jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.specialist_capability_practical_reviews
  ADD COLUMN recording_verification jsonb NOT NULL DEFAULT '{}'::jsonb;

-- A case snapshot cannot be modified after reveal. These are evidence items,
-- never an editable training exercise or a way to select easier cases.
DROP TRIGGER IF EXISTS trg_practical_benchmark_reveal_immutable
  ON public.specialist_practical_benchmark_case_reveals;
CREATE TRIGGER trg_practical_benchmark_reveal_immutable
  BEFORE UPDATE OR DELETE ON public.specialist_practical_benchmark_case_reveals
  FOR EACH ROW EXECUTE FUNCTION private.reject_practical_execute_mutation();

CREATE OR REPLACE FUNCTION private.guard_practical_benchmark_run_progress()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$ BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Practicals benchmark cannot be erased or restarted'; END IF;
  -- Only the assigned TD's immutable, approved recovery permits retirement.
  -- The attempt's case index, original actions and timestamps are retained.
  IF OLD.status='active' AND NEW.status='abandoned'
     AND NEW.active_case_index=OLD.active_case_index
     AND NEW.completed_at IS NOT NULL
     AND NEW.id=OLD.id
     AND NEW.tutor_assignment_id=OLD.tutor_assignment_id
     AND NEW.tutor_id=OLD.tutor_id
     AND NEW.proof_key=OLD.proof_key
     AND NEW.proof_version=OLD.proof_version
     AND NEW.bank_version=OLD.bank_version
     AND NEW.attempt_number=OLD.attempt_number
     AND NEW.preflight_attested=OLD.preflight_attested
     AND NEW.recording_started_before_reveal_attested=OLD.recording_started_before_reveal_attested
     AND NEW.started_at=OLD.started_at
     AND EXISTS (
       SELECT 1
       FROM public.specialist_practical_recording_recovery_requests req
       JOIN public.specialist_practical_recording_recovery_decisions dec
         ON dec.request_id=req.id AND dec.decision='approve_repeat'
       JOIN public.tutor_assignments ta ON ta.id=OLD.tutor_assignment_id
       JOIN public.pods p ON p.id=ta.pod_id
       WHERE req.run_id=OLD.id AND p.td_id=dec.reviewer_id
     )
  THEN RETURN NEW; END IF;
  IF OLD.status <> 'active' OR NEW.status NOT IN ('active','complete')
     OR NEW.id IS DISTINCT FROM OLD.id
     OR NEW.tutor_assignment_id IS DISTINCT FROM OLD.tutor_assignment_id
     OR NEW.tutor_id IS DISTINCT FROM OLD.tutor_id
     OR NEW.proof_key IS DISTINCT FROM OLD.proof_key
     OR NEW.proof_version IS DISTINCT FROM OLD.proof_version
     OR NEW.bank_version IS DISTINCT FROM OLD.bank_version
     OR NEW.attempt_number IS DISTINCT FROM OLD.attempt_number
     OR NEW.preflight_attested IS DISTINCT FROM OLD.preflight_attested
     OR NEW.recording_started_before_reveal_attested IS DISTINCT FROM OLD.recording_started_before_reveal_attested
     OR NEW.started_at IS DISTINCT FROM OLD.started_at
     OR NEW.active_case_index <> OLD.active_case_index+1
     OR (NEW.active_case_index=4 AND (NEW.status <> 'complete' OR NEW.completed_at IS NULL))
     OR (NEW.active_case_index<4 AND (NEW.status <> 'active' OR NEW.completed_at IS NOT NULL))
     OR (SELECT count(*) FROM public.specialist_practical_benchmark_case_reveals e
           WHERE e.run_id=OLD.id) <> LEAST(NEW.active_case_index,3)
     OR NOT EXISTS (
        SELECT 1 FROM public.specialist_practical_benchmark_case_reveals issued
        WHERE issued.run_id=OLD.id AND issued.case_sequence=OLD.active_case_index
          AND jsonb_typeof(issued.case_snapshot->'workflowSteps')='array'
          AND jsonb_array_length(issued.case_snapshot->'workflowSteps')>0
          AND (SELECT COUNT(*) FROM public.specialist_practical_case_actions a
                WHERE a.run_id=OLD.id AND a.case_sequence=OLD.active_case_index)
              = jsonb_array_length(issued.case_snapshot->'workflowSteps')
     )
  THEN RAISE EXCEPTION 'Benchmark must reveal every case once, in order, without a reset'; END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.guard_practical_benchmark_run_progress() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_practical_benchmark_run_guard ON public.specialist_practical_benchmark_runs;
CREATE TRIGGER trg_practical_benchmark_run_guard
  BEFORE UPDATE OR DELETE ON public.specialist_practical_benchmark_runs
  FOR EACH ROW EXECUTE FUNCTION private.guard_practical_benchmark_run_progress();

CREATE OR REPLACE FUNCTION private.validate_practical_benchmark_submission()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
DECLARE
  required_video boolean; BEGIN
  required_video := (NEW.proof_key IN ('prepare','evidence') AND NEW.proof_version>=2)
    OR (NEW.proof_key='execute' AND NEW.proof_version>=3);
  IF NOT required_video THEN RETURN NEW; END IF;
  IF NEW.benchmark_run_id IS NULL
    OR NEW.recording_duration_seconds IS NULL
    OR NEW.recording_duration_seconds <= 0
    OR NEW.recording_started_before_reveal_attested IS DISTINCT FROM true
    OR NEW.continuous_unedited_attested IS DISTINCT FROM true
    OR NEW.setup_tools_demonstrated_attested IS DISTINCT FROM true
    OR NOT EXISTS (
      SELECT 1 FROM public.specialist_practical_benchmark_runs r
      WHERE r.id=NEW.benchmark_run_id
        AND r.tutor_assignment_id=NEW.tutor_assignment_id
        AND r.tutor_id=NEW.tutor_id
        AND r.proof_key=NEW.proof_key
        AND r.proof_version=NEW.proof_version
        AND r.attempt_number=NEW.attempt_number
        AND r.bank_version=1
        AND r.status='complete'
        AND r.active_case_index=4
        AND (SELECT count(*) FROM public.specialist_practical_benchmark_case_reveals e
             WHERE e.run_id=r.id AND e.case_version=r.bank_version)=3)
  THEN RAISE EXCEPTION 'Submission requires three executed benchmark cases and a complete continuous recording'; END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.validate_practical_benchmark_submission() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_practical_benchmark_submission ON public.specialist_capability_practical_evidence;
CREATE TRIGGER trg_practical_benchmark_submission
  BEFORE INSERT ON public.specialist_capability_practical_evidence
  FOR EACH ROW EXECUTE FUNCTION private.validate_practical_benchmark_submission();

CREATE OR REPLACE FUNCTION private.validate_practical_benchmark_review()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
DECLARE
  proof varchar;
  version integer;
  linked_benchmark_run_id varchar;
  declared_seconds integer;
  observed_seconds integer;
  first_flag boolean; BEGIN
  SELECT e.proof_key,e.proof_version,e.benchmark_run_id,e.recording_duration_seconds
  INTO proof,version,linked_benchmark_run_id,declared_seconds
  FROM public.specialist_capability_practical_evidence e WHERE e.id=NEW.evidence_id;
  IF NOT ((proof IN ('prepare','evidence') AND version>=2)
       OR (proof='execute' AND version>=3)) THEN RETURN NEW; END IF;

  IF jsonb_typeof(NEW.benchmark_case_reviews) <> 'array'
     OR jsonb_array_length(NEW.benchmark_case_reviews) <> 3
     OR (SELECT count(DISTINCT c->>'caseKey')
           FROM jsonb_array_elements(NEW.benchmark_case_reviews) c) <> 3
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(NEW.benchmark_case_reviews) c
       WHERE (c->>'judgment') NOT IN ('clear','partial','fail')
          OR length(trim(coalesce(c->>'observedEvidence',''))) < 30
          OR NOT EXISTS (
            SELECT 1 FROM public.specialist_practical_benchmark_case_reveals e
            WHERE e.run_id=linked_benchmark_run_id AND e.case_key=c->>'caseKey'))
  THEN RAISE EXCEPTION 'TD must record observed video conduct for all three exact benchmark cases'; END IF;

  first_flag := coalesce((NEW.recording_verification->>'flaggedCutOrManipulation')::boolean,false);
  IF first_flag AND NEW.outcome<>'integrity_review'
    THEN RAISE EXCEPTION 'Suspected recording manipulation requires integrity review'; END IF;

  IF NEW.outcome='approved' THEN
    IF coalesce(NEW.recording_verification->>'observedDurationSeconds','') !~ '^[0-9]+$'
      THEN RAISE EXCEPTION 'TD must verify numerical full-video duration'; END IF;
    observed_seconds:=(NEW.recording_verification->>'observedDurationSeconds')::integer;
    IF observed_seconds <= 0 OR abs(observed_seconds-declared_seconds)>10
      THEN RAISE EXCEPTION 'TD-observed duration must be positive and agree with the full original recording'; END IF;
  END IF;
  -- No TD signoff may override immutable mismatches in actual operations.
  IF NEW.outcome='approved' AND EXISTS (
    SELECT 1 FROM public.specialist_practical_case_actions a
    WHERE a.run_id=linked_benchmark_run_id
      AND jsonb_typeof(a.risk_flags)='array'
      AND jsonb_array_length(a.risk_flags)>0
  ) THEN
    RAISE EXCEPTION 'Practicals approval cannot override saved operating contradictions';
  END IF;
  IF NEW.outcome='approved' AND (
       (SELECT count(*) FROM jsonb_array_elements(NEW.benchmark_case_reviews) c
         WHERE c->>'judgment' <> 'clear')>0
       OR NEW.recording_verification->>'recordingContinuous' IS DISTINCT FROM 'true'
       OR NEW.recording_verification->>'recordingBeginsBeforeReveal' IS DISTINCT FROM 'true'
       OR NEW.recording_verification->>'allThreeCasesVisible' IS DISTINCT FROM 'true'
       OR NEW.recording_verification->>'environmentAndToolsVisible' IS DISTINCT FROM 'true'
       OR NEW.recording_verification->>'specialistScreenFaceVoiceObservable' IS DISTINCT FROM 'true'
       OR NEW.recording_verification->>'flaggedCutOrManipulation' IS DISTINCT FROM 'false'
       OR NEW.recording_verification->>'flaggedTechnicalInterruption' IS DISTINCT FROM 'false')
    THEN RAISE EXCEPTION 'An incomplete or interrupted benchmark recording cannot be approved'; END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.validate_practical_benchmark_review() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_practical_benchmark_review ON public.specialist_capability_practical_reviews;
CREATE TRIGGER trg_practical_benchmark_review
  BEFORE INSERT ON public.specialist_capability_practical_reviews
  FOR EACH ROW EXECUTE FUNCTION private.validate_practical_benchmark_review();
