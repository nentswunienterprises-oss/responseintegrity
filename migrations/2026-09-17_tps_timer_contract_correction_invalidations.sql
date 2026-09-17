BEGIN;

CREATE TABLE IF NOT EXISTS public.capability_tps_timer_contract_invalidations (
  invalidation_id text PRIMARY KEY,
  contract_id text NOT NULL REFERENCES public.capability_tps_timer_contracts(contract_id) ON DELETE RESTRICT,
  correction_id text NOT NULL REFERENCES public.response_integrity_evidence_corrections(correction_id) ON DELETE RESTRICT,
  student_id varchar(64) NOT NULL,
  topic text NOT NULL,
  topic_key text NOT NULL,
  conditioning_epoch_key text NOT NULL,
  reason text NOT NULL,
  invalidated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contract_id, correction_id)
);

CREATE INDEX IF NOT EXISTS idx_tps_contract_invalidations_lookup
  ON public.capability_tps_timer_contract_invalidations(student_id, topic_key, conditioning_epoch_key, invalidated_at DESC);

ALTER TABLE public.capability_tps_timer_contract_invalidations ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_capability_tps_timer_contract_invalidations_immutable
  ON public.capability_tps_timer_contract_invalidations;
CREATE TRIGGER trg_capability_tps_timer_contract_invalidations_immutable
  BEFORE UPDATE OR DELETE ON public.capability_tps_timer_contract_invalidations
  FOR EACH ROW EXECUTE FUNCTION public.prevent_response_integrity_correction_event_mutation();

COMMIT;
