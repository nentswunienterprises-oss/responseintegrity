BEGIN;
SET LOCAL lock_timeout = '5s';
-- Retain original receipts. Re-review of a current form appends a receipt.
-- No learning state, observation, score or privilege changes.
ALTER TABLE public.specialist_sandbox_preparation_events
  DROP CONSTRAINT specialist_sandbox_preparatio_trajectory_id_session_number__key;
ALTER TABLE public.specialist_sandbox_preparation_events
  ADD CONSTRAINT sandbox_preparation_plan_identity
  UNIQUE (trajectory_id, session_number, topic_key, event_form_id, condition_contract_sha256);
COMMIT;
