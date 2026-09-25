-- Sandbox V1R4: one persistent simulated trajectory per synthetic Sandbox student.
-- Historical assignment-level V1R3 trajectories remain audit history but are retired.

ALTER TABLE public.specialist_sandbox_trajectories
  ADD COLUMN IF NOT EXISTS student_id varchar REFERENCES public.students(id) ON DELETE CASCADE;

UPDATE public.specialist_sandbox_trajectories
SET status = 'retired',
    updated_at = now()
WHERE student_id IS NULL
  AND status = 'active';

DROP INDEX IF EXISTS public.idx_sandbox_one_active_trajectory;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sandbox_one_active_student_trajectory
ON public.specialist_sandbox_trajectories (
  tutor_assignment_id,
  student_id,
  bank_key,
  bank_version
)
WHERE status = 'active'
  AND student_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sandbox_trajectory_student
ON public.specialist_sandbox_trajectories (student_id, status);

ALTER TABLE public.specialist_sandbox_rep_events
  ADD COLUMN IF NOT EXISTS student_id varchar REFERENCES public.students(id) ON DELETE CASCADE;

ALTER TABLE public.specialist_sandbox_session_evaluations
  ADD COLUMN IF NOT EXISTS student_id varchar REFERENCES public.students(id) ON DELETE CASCADE;

ALTER TABLE public.specialist_sandbox_capability_evidence
  ADD COLUMN IF NOT EXISTS student_id varchar REFERENCES public.students(id) ON DELETE CASCADE;

ALTER TABLE public.specialist_sandbox_rediagnosis_runs
  ADD COLUMN IF NOT EXISTS student_id varchar REFERENCES public.students(id) ON DELETE CASCADE;

ALTER TABLE public.specialist_sandbox_rediagnosis_turns
  ADD COLUMN IF NOT EXISTS student_id varchar REFERENCES public.students(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_sandbox_rep_events_student
ON public.specialist_sandbox_rep_events (student_id, event_sequence);

CREATE INDEX IF NOT EXISTS idx_sandbox_session_evaluations_student
ON public.specialist_sandbox_session_evaluations (student_id, session_number);

CREATE INDEX IF NOT EXISTS idx_sandbox_capability_evidence_student
ON public.specialist_sandbox_capability_evidence (
  student_id,
  capability_id,
  sequence_number
);

CREATE INDEX IF NOT EXISTS idx_sandbox_rediagnosis_runs_student
ON public.specialist_sandbox_rediagnosis_runs (student_id, created_at);

COMMENT ON COLUMN public.specialist_sandbox_trajectories.student_id IS
'The concrete synthetic Sandbox student account whose hidden simulated RI state this trajectory represents. New active trajectories are student-scoped.';

COMMENT ON COLUMN public.specialist_sandbox_rep_events.student_id IS
'Synthetic Sandbox student account that owns this rep event.';

COMMENT ON COLUMN public.specialist_sandbox_session_evaluations.student_id IS
'Synthetic Sandbox student account that owns this completed simulated session.';

COMMENT ON COLUMN public.specialist_sandbox_capability_evidence.student_id IS
'Synthetic Sandbox student whose simulated opportunity produced this Specialist capability evidence.';
