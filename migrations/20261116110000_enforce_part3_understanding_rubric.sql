-- Keep terminal qualification decisions aligned with the approved single-question Part 3 rubric.
CREATE OR REPLACE FUNCTION public.guard_qualification_completion() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE section_key text; section_value jsonb; criterion_key text; criterion_value jsonb;
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

    section_value := NEW.qualification_assessment -> 'riExplanation';
    IF section_value ->> 'scriptPresented' <> 'true'
      OR section_value ->> 'explanationVersion' <> 'conditioning-mechanism-v2'
      OR section_value ->> 'understandingReviewVersion' <> 'conditioning-understanding-rubric-v1'
      OR NULLIF(trim(COALESCE(section_value #>> '{responses,ri_session_expectation}','')), '') IS NULL
      OR jsonb_typeof(section_value -> 'understandingReview') <> 'object' THEN
      RAISE EXCEPTION 'Part 3 requires the approved explanation, single understanding answer and criterion review';
    END IF;

    FOREACH criterion_key IN ARRAY ARRAY[
      'observe_independent_work',
      'planned_repetitions',
      'evidence_led_training',
      'progressive_challenge',
      'weekly_conditioning'
    ] LOOP
      criterion_value := section_value -> 'understandingReview' -> criterion_key;
      IF criterion_value IS NULL
        OR criterion_value ->> 'disposition' NOT IN ('parent_articulated','specialist_clarified','still_unclear')
        OR (
          criterion_value ->> 'disposition' IN ('specialist_clarified','still_unclear')
          AND NULLIF(trim(COALESCE(criterion_value ->> 'note','')), '') IS NULL
        ) THEN
        RAISE EXCEPTION 'Part 3 criterion % requires a valid assessment and clarification note where applicable', criterion_key;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
