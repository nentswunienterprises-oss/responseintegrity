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
  status varchar NOT NULL DEFAULT 'active' CHECK (status IN ('active','complete')),
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
  required_video boolean;
  minimum_seconds integer;
  maximum_seconds integer;
BEGIN
  required_video := (NEW.proof_key IN ('prepare','evidence') AND NEW.proof_version>=2)
    OR (NEW.proof_key='execute' AND NEW.proof_version>=3);
  IF NOT required_video THEN RETURN NEW; END IF;
  minimum_seconds := CASE WHEN NEW.proof_key='execute' THEN 720 ELSE 600 END;
  maximum_seconds := CASE WHEN NEW.proof_key='execute' THEN 1320 ELSE 1080 END;

  IF NEW.benchmark_run_id IS NULL
    OR NEW.recording_duration_seconds IS NULL
    OR NEW.recording_duration_seconds NOT BETWEEN minimum_seconds AND maximum_seconds
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
  THEN RAISE EXCEPTION 'Submission requires the three issued benchmark cases and continuous, range-compliant recording'; END IF;
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
  run_id varchar;
  first_flag boolean;
BEGIN
  SELECT e.proof_key,e.proof_version,e.benchmark_run_id
  INTO proof,version,run_id
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
            WHERE e.run_id=run_id AND e.case_key=c->>'caseKey'))
  THEN RAISE EXCEPTION 'TD must record observed video conduct for all three exact benchmark cases'; END IF;

  first_flag := coalesce((NEW.recording_verification->>'flaggedCutOrManipulation')::boolean,false);
  IF first_flag AND NEW.outcome<>'integrity_review'
    THEN RAISE EXCEPTION 'Suspected recording manipulation requires integrity review'; END IF;
  IF NEW.outcome='approved' AND (
       (SELECT count(*) FROM jsonb_array_elements(NEW.benchmark_case_reviews) c
         WHERE c->>'judgment' <> 'clear')>0
       OR NEW.recording_verification->>'recordingContinuous' <> 'true'
       OR NEW.recording_verification->>'recordingBeginsBeforeReveal' <> 'true'
       OR NEW.recording_verification->>'allThreeCasesVisible' <> 'true'
       OR NEW.recording_verification->>'environmentAndToolsVisible' <> 'true'
       OR NEW.recording_verification->>'specialistScreenFaceVoiceObservable' <> 'true'
       OR NEW.recording_verification->>'flaggedCutOrManipulation' <> 'false'
       OR NEW.recording_verification->>'flaggedTechnicalInterruption' <> 'false')
    THEN RAISE EXCEPTION 'An incomplete or interrupted benchmark recording cannot be approved'; END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.validate_practical_benchmark_review() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_practical_benchmark_review ON public.specialist_capability_practical_reviews;
CREATE TRIGGER trg_practical_benchmark_review
  BEFORE INSERT ON public.specialist_capability_practical_reviews
  FOR EACH ROW EXECUTE FUNCTION private.validate_practical_benchmark_review();

