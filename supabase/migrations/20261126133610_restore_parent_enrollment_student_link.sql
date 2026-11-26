BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.parent_enrollments
  ADD COLUMN IF NOT EXISTS assigned_student_id varchar;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'parent_enrollments_assigned_student_id_fkey'
      AND conrelid = 'public.parent_enrollments'::regclass
  ) THEN
    ALTER TABLE public.parent_enrollments
      ADD CONSTRAINT parent_enrollments_assigned_student_id_fkey
      FOREIGN KEY (assigned_student_id)
      REFERENCES public.students(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS parent_enrollments_assigned_student_id_idx
  ON public.parent_enrollments (assigned_student_id);

-- Restore the latest existing student link for each enrollment.
UPDATE public.parent_enrollments AS e
SET assigned_student_id = (
  SELECT s.id
  FROM public.students AS s
  WHERE s.parent_enrollment_id = e.id
  ORDER BY s.updated_at DESC, s.created_at DESC, s.id ASC
  LIMIT 1
)
WHERE e.assigned_student_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.students AS s
    WHERE s.parent_enrollment_id = e.id
  );

NOTIFY pgrst, 'reload schema';
COMMIT;
