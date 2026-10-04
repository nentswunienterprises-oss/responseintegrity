-- Restore the Specialist Development Pathway authority required by the
-- longitudinal Specialist Development record and existing Trial governance.
--
-- This is intentionally narrower than the historical
-- 2026-09-02_align_specialist_pathway_and_packages.sql migration. Production
-- must not replay that older multi-domain migration because later package and
-- Trial policy has evolved independently.

CREATE TABLE IF NOT EXISTS public.specialist_development_pathways (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id varchar NOT NULL REFERENCES public.users(id),
  application_id varchar REFERENCES public.tutor_applications(id),
  tutor_assignment_id varchar REFERENCES public.tutor_assignments(id),
  status varchar(24) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'expired', 'exited')),
  started_at timestamptz NOT NULL,
  standard_ends_at timestamptz NOT NULL,
  maximum_ends_at timestamptz NOT NULL,
  extension_approved_at timestamptz,
  extension_approved_by_user_id varchar REFERENCES public.users(id),
  extension_reason text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (standard_ends_at = started_at + interval '75 days'),
  CHECK (maximum_ends_at = started_at + interval '90 days'),
  CHECK (
    (
      extension_approved_at IS NULL
      AND extension_approved_by_user_id IS NULL
      AND extension_reason IS NULL
    )
    OR (
      extension_approved_at IS NOT NULL
      AND extension_approved_by_user_id IS NOT NULL
      AND length(trim(extension_reason)) > 0
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_specialist_development_pathway_application
  ON public.specialist_development_pathways (application_id)
  WHERE application_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_specialist_development_pathway_open_tutor
  ON public.specialist_development_pathways (tutor_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_specialist_development_pathways_assignment
  ON public.specialist_development_pathways (tutor_assignment_id);

ALTER TABLE public.specialist_development_pathways ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.specialist_development_pathways FROM PUBLIC;
REVOKE ALL ON TABLE public.specialist_development_pathways FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.specialist_development_pathways
  TO service_role;

-- Backfill only Specialists whose latest approved application still falls
-- inside the maximum 90-day development window. Older legacy approvals are
-- deliberately not converted into newly-expired active pathway records.
WITH latest_approved AS (
  SELECT DISTINCT ON (application.user_id)
    application.id,
    application.user_id,
    application.reviewed_at
  FROM public.tutor_applications application
  WHERE application.status = 'approved'
    AND application.reviewed_at IS NOT NULL
    AND application.reviewed_at > now() - interval '90 days'
  ORDER BY application.user_id, application.reviewed_at DESC
),
latest_assignment AS (
  SELECT DISTINCT ON (assignment.tutor_id)
    assignment.tutor_id,
    assignment.id AS tutor_assignment_id
  FROM public.tutor_assignments assignment
  ORDER BY assignment.tutor_id, assignment.created_at DESC
)
INSERT INTO public.specialist_development_pathways (
  tutor_id,
  application_id,
  tutor_assignment_id,
  status,
  started_at,
  standard_ends_at,
  maximum_ends_at
)
SELECT
  approved.user_id,
  approved.id,
  assignment.tutor_assignment_id,
  'active',
  approved.reviewed_at,
  approved.reviewed_at + interval '75 days',
  approved.reviewed_at + interval '90 days'
FROM latest_approved approved
LEFT JOIN latest_assignment assignment
  ON assignment.tutor_id = approved.user_id
WHERE NOT EXISTS (
  SELECT 1
  FROM public.specialist_development_pathways pathway
  WHERE pathway.application_id = approved.id
     OR (
       pathway.tutor_id = approved.user_id
       AND pathway.status = 'active'
     )
);

NOTIFY pgrst, 'reload schema';
