-- Store scheduled session starts as real instants.
-- Existing scheduled_time values are local wall-clock timestamps; timezone is
-- the authoritative IANA zone for interpreting them. The old 90-minute
-- scheduled_end values were written as UTC wall-clock values in 213/214
-- Production rows. Correct only rows matching that legacy pattern; preserve
-- the one already-correct local instant and all non-matching historical data.
LOCK TABLE public.scheduled_sessions IN ACCESS EXCLUSIVE MODE;

-- The trigger's UPDATE OF column list depends on scheduled_time's current type.
-- Drop it before altering the column, then restore the exact event contract below.
DROP TRIGGER IF EXISTS trg_capture_tutor_trial_first_session_v2 ON public.scheduled_sessions;

-- This view projects scheduled_time directly, so PostgreSQL will not permit
-- changing the underlying column type while the view exists. Recreate it
-- with the same projection and joins after the type conversion.
DROP VIEW public.scheduled_sessions_with_names;

UPDATE public.scheduled_sessions
   SET scheduled_end =
     (scheduled_end AT TIME ZONE 'UTC')
       AT TIME ZONE COALESCE(NULLIF(timezone, ''), 'Africa/Johannesburg')
 WHERE scheduled_end IS NOT NULL
   AND scheduled_end =
     ((scheduled_time + INTERVAL '90 minutes') AT TIME ZONE 'UTC');

ALTER TABLE public.scheduled_sessions
  ALTER COLUMN scheduled_time TYPE timestamptz
  USING scheduled_time AT TIME ZONE COALESCE(NULLIF(timezone, ''), 'Africa/Johannesburg');

CREATE VIEW public.scheduled_sessions_with_names
WITH (security_invoker = true)
AS
 SELECT
    ss.*,
    p.full_name AS parent_full_name,
    pu.email AS parent_email,
    t.full_name AS tutor_full_name,
    t.email AS tutor_email
   FROM public.scheduled_sessions ss
     LEFT JOIN public.parents p ON ss.parent_id::text = p.id::text
     LEFT JOIN public.users pu ON p.user_id::text = pu.id::text
     LEFT JOIN public.tutor_applications t ON ss.tutor_id::text = t.id::text;

-- The view is server-only. Preserve the SEC178 posture: no direct client
-- access, and retain the existing privileged server-role read path.
REVOKE ALL PRIVILEGES ON TABLE public.scheduled_sessions_with_names
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.scheduled_sessions_with_names TO service_role;

CREATE OR REPLACE FUNCTION public.capture_tutor_trial_first_session_v2()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  first_delivered_at timestamptz; BEGIN
  IF NEW.status IS DISTINCT FROM 'completed'
     OR NEW.type IS DISTINCT FROM 'training'
     OR NEW.scheduled_time IS NULL
     OR NEW.student_id IS NULL
     OR NEW.tutor_id IS NULL THEN
    RETURN NEW;
  END IF;

  first_delivered_at := NEW.scheduled_time;

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
$function$;

CREATE TRIGGER trg_capture_tutor_trial_first_session_v2
AFTER INSERT OR UPDATE OF status, type, scheduled_time, student_id, tutor_id
ON public.scheduled_sessions
FOR EACH ROW EXECUTE FUNCTION public.capture_tutor_trial_first_session_v2();

CREATE OR REPLACE FUNCTION public.notify_scheduled_session_changes()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  lesson_label text;
  parent_link text := '/client/parent/updates';
  tutor_link text := '/tutor/updates';
  student_link text := '/client/student/updates'; BEGIN
  lesson_label := upper(coalesce(NEW.type, 'session')) || ' lesson on ' ||
    to_char(
      NEW.scheduled_time AT TIME ZONE COALESCE(NULLIF(NEW.timezone, ''), 'Africa/Johannesburg'),
      'Mon DD at HH24:MI'
    );

  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'pending_tutor_confirmation' THEN
      PERFORM create_notification_row(
        NEW.tutor_id, 'action_required', 'New lesson awaiting confirmation',
        'You have a new ' || lower(coalesce(NEW.type, 'session')) || ' lesson to confirm: ' || lesson_label,
        tutor_link, 'scheduled_session', NEW.id, NEW.parent_id
      );
    ELSIF NEW.status = 'pending_parent_confirmation' THEN
      PERFORM create_notification_row(
        NEW.parent_id, 'action_required', 'Lesson awaiting your confirmation',
        'A ' || lower(coalesce(NEW.type, 'session')) || ' lesson is waiting for your confirmation: ' || lesson_label,
        parent_link, 'scheduled_session', NEW.id, NEW.tutor_id
      );
    ELSIF NEW.status = 'confirmed' THEN
      PERFORM create_notification_row(
        NEW.tutor_id, 'informational', 'Lesson confirmed',
        'Your ' || lower(coalesce(NEW.type, 'session')) || ' lesson has been confirmed: ' || lesson_label,
        tutor_link, 'scheduled_session', NEW.id, NEW.parent_id
      );
      PERFORM create_notification_row(
        NEW.parent_id, 'informational', 'Lesson confirmed',
        'Your ' || lower(coalesce(NEW.type, 'session')) || ' lesson has been confirmed: ' || lesson_label,
        parent_link, 'scheduled_session', NEW.id, NEW.tutor_id
      );
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NEW.status = 'confirmed' THEN
        PERFORM create_notification_row(
          NEW.tutor_id, 'informational', 'Lesson confirmed',
          'Your ' || lower(coalesce(NEW.type, 'session')) || ' lesson has been confirmed: ' || lesson_label,
          tutor_link, 'scheduled_session', NEW.id, NEW.parent_id
        );
        PERFORM create_notification_row(
          NEW.parent_id, 'informational', 'Lesson confirmed',
          'Your ' || lower(coalesce(NEW.type, 'session')) || ' lesson has been confirmed: ' || lesson_label,
          parent_link, 'scheduled_session', NEW.id, NEW.tutor_id
        );
      ELSIF NEW.status = 'completed' THEN
        PERFORM create_notification_row(
          NEW.tutor_id, 'informational', 'Lesson completed',
          'Your ' || lower(coalesce(NEW.type, 'session')) || ' lesson is now marked completed: ' || lesson_label,
          tutor_link, 'scheduled_session', NEW.id, NEW.parent_id
        );
        PERFORM create_notification_row(
          NEW.parent_id, 'informational', 'Lesson completed',
          'Your ' || lower(coalesce(NEW.type, 'session')) || ' lesson is now marked completed: ' || lesson_label,
          parent_link, 'scheduled_session', NEW.id, NEW.tutor_id
        );
      END IF;
    END IF;

    IF NEW.recording_status IS DISTINCT FROM OLD.recording_status THEN
      IF NEW.recording_status = 'recording_required' THEN
        PERFORM create_notification_row(
          NEW.tutor_id, 'action_required', 'Recording required',
          'Upload the recording for ' || lower(coalesce(NEW.type, 'session')) || ': ' || lesson_label,
          tutor_link, 'scheduled_session', NEW.id, NEW.parent_id
        );
      ELSIF NEW.recording_status = 'recording_uploaded' THEN
        PERFORM create_notification_row(
          NEW.tutor_id, 'informational', 'Recording uploaded',
          'Recording received for ' || lower(coalesce(NEW.type, 'session')) || ': ' || lesson_label,
          tutor_link, 'scheduled_session', NEW.id, NEW.parent_id
        );
        PERFORM create_notification_row(
          NEW.parent_id, 'informational', 'Recording uploaded',
          'Recording received for ' || lower(coalesce(NEW.type, 'session')) || ': ' || lesson_label,
          parent_link, 'scheduled_session', NEW.id, NEW.tutor_id
        );
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;
