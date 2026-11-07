-- Parent report changes invalidate unfinished diagnosis runs without deleting their audit history.
ALTER TABLE public.response_integrity_diagnosis_runs
  DROP CONSTRAINT IF EXISTS response_integrity_diagnosis_runs_status_check;

ALTER TABLE public.response_integrity_diagnosis_runs
  ADD CONSTRAINT response_integrity_diagnosis_runs_status_check
  CHECK (status IN ('in_progress', 'blocked', 'completed', 'superseded'));
