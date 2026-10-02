-- Keep Handover TPS timed-attempt lineage separate from Training attempts
-- while preserving the same inherited student/topic Timer Contract.
ALTER TABLE public.response_integrity_tps_timed_attempts
  DROP CONSTRAINT IF EXISTS response_integrity_tps_timed_attempts_set_id_check;

ALTER TABLE public.response_integrity_tps_timed_attempts
  ADD CONSTRAINT response_integrity_tps_timed_attempts_set_id_check
  CHECK (
    set_id = ANY (
      ARRAY[
        'time_pressure.structure_under_timer'::text,
        'time_pressure.repeated_timed_execution'::text,
        'time_pressure.full_constraint'::text,
        'time_pressure.handover_continuity'::text
      ]
    )
  );
