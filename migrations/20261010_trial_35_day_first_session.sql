-- Response Integrity: Trial delivery window authority (10 October 2026)
-- Approved contract: two distinct families, nine qualifying sessions each,
-- 35 calendar days from the FIRST COMPLETED TRIAL SESSION (not family placement).
-- This is a narrow additive migration. No historical Trial cases are present
-- in The Hub at the acceptance baseline. Do not mark a Specialist certified.

ALTER TABLE public.tutor_trial_cases
  ADD COLUMN IF NOT EXISTS window_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS window_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS extension_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS extension_reason text,
  ADD COLUMN IF NOT EXISTS extension_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS extension_approved_by_user_id varchar REFERENCES public.users(id);

-- Window chronology must remain internally consistent; an ordinary window
-- always lasts exactly 35 calendar days, including after a correction to
-- the first completed session's authoritative scheduled timestamp.
ALTER TABLE public.tutor_trial_cases
  ADD CONSTRAINT tutor_trial_window_35_day_contract CHECK (
    (window_started_at IS NULL AND window_ends_at IS NULL)
    OR (window_started_at IS NOT NULL
        AND window_ends_at = window_started_at + INTERVAL '35 days')
  );

ALTER TABLE public.tutor_trial_cases
  ADD CONSTRAINT tutor_trial_extension_approval_contract CHECK (
    (extension_ends_at IS NULL
      AND extension_reason IS NULL
      AND extension_approved_at IS NULL
      AND extension_approved_by_user_id IS NULL)
    OR (
      window_ends_at IS NOT NULL
      AND extension_ends_at > window_ends_at
      AND length(trim(extension_reason)) > 0
      AND extension_approved_at IS NOT NULL
      AND extension_approved_by_user_id IS NOT NULL
    )
  );

-- A Trial clock begins when the first real scheduled session is marked
-- completed for a current Trial placement. Placing family 2 never starts it.
-- "scheduled_time" is UTC stored in an existing timestamp-without-time-zone
-- column. We use that delivery timestamp rather than the completion-entry
-- timestamp so delayed logging does not extend the normal deadline.
CREATE OR REPLACE FUNCTION public.capture_tutor_trial_first_session_v2()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
DECLARE
  first_delivered_at timestamptz; BEGIN
  IF NEW.status IS DISTINCT FROM 'completed'
     OR NEW.scheduled_time IS NULL
     OR NEW.student_id IS NULL
     OR NEW.tutor_id IS NULL THEN
    RETURN NEW;
  END IF;

  first_delivered_at := NEW.scheduled_time AT TIME ZONE 'UTC';

  UPDATE public.tutor_trial_cases AS trial_case
  SET
    window_started_at =
      LEAST(COALESCE(trial_case.window_started_at, first_delivered_at), first_delivered_at),
    window_ends_at =
      LEAST(COALESCE(trial_case.window_started_at, first_delivered_at), first_delivered_at)
      + INTERVAL '35 days',
    updated_at = now()
  FROM public.tutor_trial_placements AS placement
  WHERE placement.case_id = trial_case.id
    AND placement.status IN ('active', 'completed')
    AND placement.student_id = NEW.student_id::text
    AND trial_case.tutor_id = NEW.tutor_id
    AND trial_case.status IN ('active', 'reviewable', 'remediation_required')
    AND first_delivered_at >= placement.started_at
    AND (
      trial_case.window_started_at IS NULL
      OR first_delivered_at < trial_case.window_started_at
    );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.capture_tutor_trial_first_session_v2() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_capture_tutor_trial_first_session_v2 ON public.scheduled_sessions;
CREATE TRIGGER trg_capture_tutor_trial_first_session_v2
AFTER INSERT OR UPDATE OF status, scheduled_time, student_id, tutor_id
ON public.scheduled_sessions
FOR EACH ROW EXECUTE FUNCTION public.capture_tutor_trial_first_session_v2();

-- No UPDATE on Trial status or certification decision is made here.
-- The server's COO extension route is the only permitted ordinary
-- extension entry; existing application/role controls remain in force.
