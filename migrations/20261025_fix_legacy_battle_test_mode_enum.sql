-- Keep the legacy battle-test mode column on the canonical operational enum.
-- The earlier applicant-mode migration could leave this column attached to
-- tutor_certification_mode_old when the table alteration was run before the
-- enum was recreated. That makes COALESCE(mode, operational_mode) fail with
-- an enum-type mismatch in Specialist Development Record reads.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tutor_battle_test_statuses'
      AND column_name = 'mode'
      AND udt_name = 'tutor_certification_mode_old'
  ) THEN
    ALTER TABLE public.tutor_battle_test_statuses
      ALTER COLUMN mode DROP DEFAULT;

    ALTER TABLE public.tutor_battle_test_statuses
      ALTER COLUMN mode TYPE tutor_operational_mode
      USING mode::text::tutor_operational_mode;

    ALTER TABLE public.tutor_battle_test_statuses
      ALTER COLUMN mode SET DEFAULT 'training'::tutor_operational_mode;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'tutor_battle_test_statuses'
      AND a.attname = 'mode'
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND a.atttypid = to_regtype('tutor_certification_mode_old')
  ) THEN
    DROP TYPE IF EXISTS tutor_certification_mode_old;
  END IF;
END $$;
