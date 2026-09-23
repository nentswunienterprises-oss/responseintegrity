-- Align the students table with runtime code that orders and updates by updated_at.
-- Additive only: existing rows are backfilled by the default.

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone NOT NULL DEFAULT now();

UPDATE public.students
SET updated_at = COALESCE(updated_at, created_at, now());

NOTIFY pgrst, 'reload schema';
