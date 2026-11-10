-- Structured four-part Parent Qualification evidence. Additive only; no historical backfill.
BEGIN;

ALTER TABLE public.parent_enrollments
  ADD COLUMN IF NOT EXISTS qualification_assessment jsonb,
  ADD COLUMN IF NOT EXISTS qualification_assessment_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS qualification_assessment_updated_by varchar(64) REFERENCES public.users(id);

ALTER TABLE public.parent_enrollments
  DROP CONSTRAINT IF EXISTS chk_qualification_assessment_object;
ALTER TABLE public.parent_enrollments
  ADD CONSTRAINT chk_qualification_assessment_object
  CHECK (qualification_assessment IS NULL OR jsonb_typeof(qualification_assessment) = 'object');

CREATE OR REPLACE FUNCTION public.guard_qualification_assessment() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NEW.qualification_assessment IS DISTINCT FROM OLD.qualification_assessment THEN
    IF OLD.demand_flow_version = 0 OR COALESCE(OLD.is_sandbox_account, false) THEN
      RAISE EXCEPTION 'Historical and Sandbox applications cannot receive retrospective qualification evidence';
    END IF;
    IF OLD.qualification_completed_at IS NOT NULL THEN
      RAISE EXCEPTION 'Qualification assessment is locked after the decision';
    END IF;
    IF NEW.qualification_assessment_updated_at IS NULL OR NEW.qualification_assessment_updated_by IS NULL THEN
      RAISE EXCEPTION 'Assessment changes require actor and timestamp evidence';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_qualification_assessment ON public.parent_enrollments;
CREATE TRIGGER guard_qualification_assessment
BEFORE UPDATE ON public.parent_enrollments
FOR EACH ROW EXECUTE FUNCTION public.guard_qualification_assessment();

CREATE OR REPLACE FUNCTION public.save_parent_qualification_assessment(
  p_enrollment_id text,
  p_actor_id text,
  p_assessment jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE e public.parent_enrollments%ROWTYPE; at_time timestamptz := clock_timestamp();
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_actor_id AND role::text IN ('coo','hr','ceo')
  ) THEN RAISE EXCEPTION 'Assessment updates require an authorized staff actor'; END IF;

  IF p_assessment IS NULL OR jsonb_typeof(p_assessment) <> 'object'
     OR (p_assessment - ARRAY['parentExperience','supportPreferences','riExplanation','commercialReadiness']) <> '{}'::jsonb THEN
    RAISE EXCEPTION 'Assessment must contain only the four approved qualification sections';
  END IF;
  IF octet_length(p_assessment::text) > 24000 THEN
    RAISE EXCEPTION 'Qualification assessment exceeds the permitted size';
  END IF;

  SELECT * INTO e FROM public.parent_enrollments
  WHERE id::text = p_enrollment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Enrollment not found'; END IF;
  IF e.demand_flow_version <> 1 OR COALESCE(e.is_sandbox_account, false) THEN
    RAISE EXCEPTION 'Historical and Sandbox applications are not eligible for new qualification evidence';
  END IF;
  IF e.qualification_completed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Qualification assessment is locked after the decision';
  END IF;

  UPDATE public.parent_enrollments
  SET qualification_assessment = p_assessment,
      qualification_assessment_updated_at = at_time,
      qualification_assessment_updated_by = p_actor_id,
      updated_at = at_time
  WHERE id = e.id RETURNING * INTO e;

  RETURN to_jsonb(e);
END $$;

REVOKE ALL ON FUNCTION public.save_parent_qualification_assessment(text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_parent_qualification_assessment(text,text,jsonb) TO service_role;

COMMIT;
