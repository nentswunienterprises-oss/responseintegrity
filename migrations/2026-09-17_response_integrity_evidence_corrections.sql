-- Response Integrity post-submission evidence corrections.
-- Submitted drill/evidence rows remain immutable. Corrections, reviews, and replay outcomes are
-- append-only events layered over the original evidence lineage.

CREATE TABLE IF NOT EXISTS public.response_integrity_evidence_corrections (
  correction_id text PRIMARY KEY,
  correction_kind varchar(32) NOT NULL CHECK (
    correction_kind IN ('observation_option', 'actual_support_used')
  ),
  source_evidence_id text REFERENCES public.response_integrity_evidence_ledger(evidence_id) ON DELETE CASCADE,
  source_drill_id varchar(64) NOT NULL REFERENCES public.intro_session_drills(id) ON DELETE CASCADE,
  student_id varchar(64) NOT NULL,
  tutor_id varchar(64) NOT NULL,
  topic text NOT NULL,
  block_order integer NOT NULL CHECK (block_order > 0),
  set_id text NOT NULL,
  set_order integer NOT NULL CHECK (set_order > 0),
  rep_id text NOT NULL,
  rep_number integer NOT NULL CHECK (rep_number > 0),
  dimension_id text,
  field_key text,
  drill_type varchar(20) NOT NULL CHECK (drill_type IN ('diagnosis', 'training', 'verification')),
  phase varchar(40) NOT NULL CHECK (
    phase IN ('Clarity', 'Structured Execution', 'Controlled Discomfort', 'Time Pressure Stability')
  ),
  drill_schema_id text NOT NULL,
  drill_schema_version integer NOT NULL,
  drill_definition_hash text NOT NULL,
  original_option_id text,
  original_raw_option text,
  original_normalized_level varchar(10) CHECK (
    original_normalized_level IS NULL OR original_normalized_level IN ('weak', 'partial', 'clear')
  ),
  proposed_option_id text,
  proposed_raw_option text,
  proposed_normalized_level varchar(10) CHECK (
    proposed_normalized_level IS NULL OR proposed_normalized_level IN ('weak', 'partial', 'clear')
  ),
  original_actual_support_used varchar(32) CHECK (
    original_actual_support_used IS NULL OR original_actual_support_used IN (
      'none', 'response_control_cue', 'first_step_math_support', 'beyond_permitted_boundary'
    )
  ),
  proposed_actual_support_used varchar(32) CHECK (
    proposed_actual_support_used IS NULL OR proposed_actual_support_used IN (
      'none', 'response_control_cue', 'first_step_math_support', 'beyond_permitted_boundary'
    )
  ),
  reason_code text NOT NULL,
  reason_text text NOT NULL CHECK (length(trim(reason_text)) > 0),
  raised_by_user_id varchar(64) NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  raised_by_role varchar(20) NOT NULL CHECK (raised_by_role IN ('tutor', 'td', 'coo')),
  supersedes_correction_id text REFERENCES public.response_integrity_evidence_corrections(correction_id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (
      correction_kind = 'observation_option'
      AND source_evidence_id IS NOT NULL
      AND dimension_id IS NOT NULL
      AND field_key IS NOT NULL
      AND original_option_id IS NOT NULL
      AND original_raw_option IS NOT NULL
      AND original_normalized_level IS NOT NULL
      AND proposed_option_id IS NOT NULL
      AND proposed_raw_option IS NOT NULL
      AND proposed_normalized_level IS NOT NULL
      AND original_actual_support_used IS NULL
      AND proposed_actual_support_used IS NULL
    )
    OR
    (
      correction_kind = 'actual_support_used'
      AND original_actual_support_used IS NOT NULL
      AND proposed_actual_support_used IS NOT NULL
      AND original_option_id IS NULL
      AND original_raw_option IS NULL
      AND original_normalized_level IS NULL
      AND proposed_option_id IS NULL
      AND proposed_raw_option IS NULL
      AND proposed_normalized_level IS NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_ri_evidence_corrections_source
  ON public.response_integrity_evidence_corrections (source_evidence_id, created_at)
  WHERE source_evidence_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ri_evidence_corrections_source_rep
  ON public.response_integrity_evidence_corrections (source_drill_id, block_order, set_id, rep_id, created_at);

CREATE INDEX IF NOT EXISTS idx_ri_evidence_corrections_student_topic
  ON public.response_integrity_evidence_corrections (student_id, topic, created_at);

CREATE TABLE IF NOT EXISTS public.response_integrity_evidence_correction_reviews (
  review_id text PRIMARY KEY,
  correction_id text NOT NULL UNIQUE REFERENCES public.response_integrity_evidence_corrections(correction_id) ON DELETE CASCADE,
  outcome varchar(12) NOT NULL CHECK (outcome IN ('approved', 'rejected')),
  reviewed_by_user_id varchar(64) NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  reviewed_by_role varchar(12) NOT NULL CHECK (reviewed_by_role IN ('td', 'coo')),
  review_note text,
  reviewed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ri_evidence_correction_reviews_reviewer
  ON public.response_integrity_evidence_correction_reviews (reviewed_by_user_id, reviewed_at);

CREATE TABLE IF NOT EXISTS public.response_integrity_topic_replay_runs (
  replay_id text PRIMARY KEY,
  correction_id text NOT NULL UNIQUE REFERENCES public.response_integrity_evidence_corrections(correction_id) ON DELETE CASCADE,
  student_id varchar(64) NOT NULL,
  topic text NOT NULL,
  replay_version integer NOT NULL DEFAULT 1 CHECK (replay_version > 0),
  replay_from_source_drill_id varchar(64) NOT NULL REFERENCES public.intro_session_drills(id) ON DELETE CASCADE,
  starting_phase varchar(40) CHECK (
    starting_phase IS NULL OR starting_phase IN ('Clarity', 'Structured Execution', 'Controlled Discomfort', 'Time Pressure Stability')
  ),
  starting_stability varchar(20) CHECK (
    starting_stability IS NULL OR starting_stability IN ('Low', 'Medium', 'High', 'High Maintenance')
  ),
  resulting_phase varchar(40) NOT NULL CHECK (
    resulting_phase IN ('Clarity', 'Structured Execution', 'Controlled Discomfort', 'Time Pressure Stability')
  ),
  resulting_stability varchar(20) NOT NULL CHECK (
    resulting_stability IN ('Low', 'Medium', 'High', 'High Maintenance')
  ),
  replayed_event_count integer NOT NULL CHECK (replayed_event_count >= 0),
  skipped_event_count integer NOT NULL DEFAULT 0 CHECK (skipped_event_count >= 0),
  replay_lineage jsonb NOT NULL,
  replayed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ri_topic_replay_student_topic
  ON public.response_integrity_topic_replay_runs (student_id, topic, replayed_at);

CREATE TABLE IF NOT EXISTS public.response_integrity_report_supersessions (
  supersession_id text PRIMARY KEY,
  correction_id text NOT NULL REFERENCES public.response_integrity_evidence_corrections(correction_id) ON DELETE CASCADE,
  superseded_report_id varchar NOT NULL REFERENCES public.parent_reports(id) ON DELETE CASCADE,
  replacement_report_id varchar REFERENCES public.parent_reports(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (correction_id, superseded_report_id)
);

CREATE INDEX IF NOT EXISTS idx_ri_report_supersessions_report
  ON public.response_integrity_report_supersessions (superseded_report_id);

CREATE OR REPLACE FUNCTION public.prevent_response_integrity_correction_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Response Integrity evidence correction events are immutable';
END;
$$;

DROP TRIGGER IF EXISTS trg_ri_evidence_corrections_immutable
  ON public.response_integrity_evidence_corrections;
CREATE TRIGGER trg_ri_evidence_corrections_immutable
BEFORE UPDATE OR DELETE ON public.response_integrity_evidence_corrections
FOR EACH ROW EXECUTE FUNCTION public.prevent_response_integrity_correction_event_mutation();

DROP TRIGGER IF EXISTS trg_ri_evidence_correction_reviews_immutable
  ON public.response_integrity_evidence_correction_reviews;
CREATE TRIGGER trg_ri_evidence_correction_reviews_immutable
BEFORE UPDATE OR DELETE ON public.response_integrity_evidence_correction_reviews
FOR EACH ROW EXECUTE FUNCTION public.prevent_response_integrity_correction_event_mutation();

DROP TRIGGER IF EXISTS trg_ri_topic_replay_runs_immutable
  ON public.response_integrity_topic_replay_runs;
CREATE TRIGGER trg_ri_topic_replay_runs_immutable
BEFORE UPDATE OR DELETE ON public.response_integrity_topic_replay_runs
FOR EACH ROW EXECUTE FUNCTION public.prevent_response_integrity_correction_event_mutation();

DROP TRIGGER IF EXISTS trg_ri_report_supersessions_immutable
  ON public.response_integrity_report_supersessions;
CREATE TRIGGER trg_ri_report_supersessions_immutable
BEFORE UPDATE OR DELETE ON public.response_integrity_report_supersessions
FOR EACH ROW EXECUTE FUNCTION public.prevent_response_integrity_correction_event_mutation();

-- Internal operational evidence. Direct browser access is intentionally denied; authenticated
-- application routes use the server-side service role after enforcing tutor/TD/COO scope.
ALTER TABLE public.response_integrity_evidence_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.response_integrity_evidence_correction_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.response_integrity_topic_replay_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.response_integrity_report_supersessions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.response_integrity_evidence_corrections IS
  'Immutable post-submission correction requests against exact Response Integrity scored or rep-operational source facts.';
COMMENT ON TABLE public.response_integrity_evidence_correction_reviews IS
  'Immutable TD/COO approval or rejection events. A requester cannot approve their own correction.';
COMMENT ON TABLE public.response_integrity_topic_replay_runs IS
  'Immutable deterministic topic-state replay lineage generated after an approved evidence correction.';
COMMENT ON TABLE public.response_integrity_report_supersessions IS
  'Append-only lineage linking deterministic reports superseded because approved evidence changed.';
