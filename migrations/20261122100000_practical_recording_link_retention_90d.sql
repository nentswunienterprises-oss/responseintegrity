-- Retain the privately accessible link to an original Practical recording for
-- 90 days from submission, then remove the link while keeping the decision and
-- evidence-integrity metadata append-only. External host copies are outside RI
-- control and must also be deleted/revoked by their owner at the deadline.

ALTER TABLE public.specialist_capability_practical_evidence
  ADD COLUMN IF NOT EXISTS recording_link_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS recording_link_retired_at timestamptz,
  ADD COLUMN IF NOT EXISTS recording_retention_days smallint NOT NULL DEFAULT 90;

-- Temporarily remove the append-only trigger only within this migration so the
-- expiry can be backfilled for existing rows; restore the strict policy below.
DROP TRIGGER IF EXISTS trg_practical_submission_immutable ON public.specialist_capability_practical_evidence;

UPDATE public.specialist_capability_practical_evidence
   SET recording_link_expires_at = submitted_at + interval '90 days'
 WHERE recording_link_expires_at IS NULL;

ALTER TABLE public.specialist_capability_practical_evidence
  ALTER COLUMN recording_link_expires_at SET DEFAULT (now() + interval '90 days'),
  ALTER COLUMN recording_link_expires_at SET NOT NULL,
  ALTER COLUMN artifact_url DROP NOT NULL;

ALTER TABLE public.specialist_capability_practical_evidence
  ADD CONSTRAINT specialist_practical_recording_retention_90d
  CHECK (recording_retention_days = 90),
  ADD CONSTRAINT specialist_practical_recording_retired_state
  CHECK ((artifact_url IS NULL) = (recording_link_retired_at IS NOT NULL));

CREATE OR REPLACE FUNCTION private.guard_practical_submission_immutable_or_expired_link_retirement()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  IF TG_OP='UPDATE'
     AND current_setting('response_integrity.practical_media_retention', true)='true'
     AND OLD.artifact_url IS NOT NULL
     AND NEW.artifact_url IS NULL
     AND OLD.recording_link_expires_at <= statement_timestamp()
     AND NEW.recording_link_retired_at IS NOT NULL
     AND (to_jsonb(NEW)-'artifact_url'-'recording_link_retired_at')
       = (to_jsonb(OLD)-'artifact_url'-'recording_link_retired_at')
  THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Practical evidence is immutable; only the protected 90-day link-retention job may retire an expired link';
END; $$;
REVOKE ALL ON FUNCTION private.guard_practical_submission_immutable_or_expired_link_retirement() FROM PUBLIC,anon,authenticated;

CREATE TRIGGER trg_practical_submission_immutable
  BEFORE UPDATE OR DELETE ON public.specialist_capability_practical_evidence
  FOR EACH ROW EXECUTE FUNCTION private.guard_practical_submission_immutable_or_expired_link_retirement();

CREATE OR REPLACE FUNCTION private.retire_expired_practical_recording_links()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE retired_count integer;
BEGIN
  PERFORM set_config('response_integrity.practical_media_retention','true',true);
  UPDATE public.specialist_capability_practical_evidence
     SET artifact_url=NULL,recording_link_retired_at=statement_timestamp()
   WHERE artifact_url IS NOT NULL
     AND recording_link_expires_at <= statement_timestamp();
  GET DIAGNOSTICS retired_count = ROW_COUNT;
  RETURN retired_count;
END; $$;
REVOKE ALL ON FUNCTION private.retire_expired_practical_recording_links() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.retire_expired_practical_recording_links() TO service_role;

-- Supabase's supported Postgres scheduler runs the protected function daily.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
SELECT cron.schedule(
  'ri-practical-recording-link-retention-90d',
  '0 3 * * *',
  'SELECT private.retire_expired_practical_recording_links()'
);
