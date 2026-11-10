-- A terminal qualification decision is not permitted until all four standard sections have evidence.
BEGIN;
CREATE OR REPLACE FUNCTION public.guard_qualification_completion() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE section_key text; section_value jsonb;
BEGIN
  IF OLD.qualification_completed_at IS NULL AND NEW.qualification_completed_at IS NOT NULL THEN
    IF NEW.qualification_assessment IS NULL THEN
      RAISE EXCEPTION 'Complete the four-part parent qualification assessment before deciding';
    END IF;
    FOREACH section_key IN ARRAY ARRAY['parentExperience','supportPreferences','riExplanation','commercialReadiness'] LOOP
      section_value := NEW.qualification_assessment -> section_key;
      IF section_value IS NULL OR jsonb_typeof(section_value) <> 'object'
        OR (
          NULLIF(trim(COALESCE(section_value ->> 'parentAccount','')), '') IS NULL
          AND NULLIF(trim(COALESCE(section_value ->> 'evidence','')), '') IS NULL
          AND NULLIF(trim(COALESCE(section_value ->> 'interviewerObservation','')), '') IS NULL
        ) THEN
        RAISE EXCEPTION 'Qualification section % requires recorded evidence', section_key;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_qualification_completion ON public.parent_enrollments;
CREATE TRIGGER guard_qualification_completion
BEFORE UPDATE ON public.parent_enrollments
FOR EACH ROW EXECUTE FUNCTION public.guard_qualification_completion();
COMMIT;
