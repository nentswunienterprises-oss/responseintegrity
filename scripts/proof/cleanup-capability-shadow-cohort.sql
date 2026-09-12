-- Remove only the synthetic Capability shadow cohort created by
-- scripts/proof/seed-capability-shadow-cohort.sql.
--
-- This deliberately avoids deleting an assessment config if it has since been
-- upgraded into a real private bank (non-empty competency blueprint or items).

BEGIN;

DELETE FROM public.tutor_certification_decisions
WHERE id LIKE 'proof-shadow-decision-%'
   OR idempotency_key LIKE 'proof-shadow-decision-key-%';

DELETE FROM public.tutor_trial_reviews
WHERE placement_id IN (
  SELECT id FROM public.tutor_trial_placements
  WHERE case_id LIKE 'proof-shadow-trial-%'
);

DELETE FROM public.tutor_trial_placements
WHERE case_id LIKE 'proof-shadow-trial-%';

DELETE FROM public.tutor_trial_cases
WHERE id LIKE 'proof-shadow-trial-%';

DELETE FROM public.specialist_capability_oral_defenses
WHERE id LIKE 'proof-shadow-oral-%'
   OR tutor_assignment_id LIKE 'proof-shadow-assignment-%';

DELETE FROM public.specialist_capability_practical_reviews
WHERE evidence_id IN (
  SELECT id
  FROM public.specialist_capability_practical_evidence
  WHERE id LIKE 'proof-shadow-practical-%'
     OR tutor_assignment_id LIKE 'proof-shadow-assignment-%'
);

DELETE FROM public.specialist_capability_practical_evidence
WHERE id LIKE 'proof-shadow-practical-%'
   OR tutor_assignment_id LIKE 'proof-shadow-assignment-%';

DELETE FROM public.specialist_capability_sandbox_simulation_attempts
WHERE tutor_assignment_id LIKE 'proof-shadow-assignment-%';

DELETE FROM public.specialist_capability_assessment_attempts
WHERE id LIKE 'proof-shadow-cap-%'
   OR tutor_assignment_id LIKE 'proof-shadow-assignment-%';

DELETE FROM public.battle_test_rep_logs
WHERE run_id LIKE 'proof-shadow-battle-%';

DELETE FROM public.battle_test_runs
WHERE id LIKE 'proof-shadow-battle-%'
   OR tutor_assignment_id LIKE 'proof-shadow-assignment-%';

DELETE FROM public.tutor_assignments
WHERE id LIKE 'proof-shadow-assignment-%';

DELETE FROM public.pods
WHERE id = 'proof-shadow-pod';

DELETE FROM public.users
WHERE id IN (
  'proof-shadow-td',
  'proof-shadow-tutor-a',
  'proof-shadow-tutor-b',
  'proof-shadow-tutor-c',
  'proof-shadow-tutor-d'
);

DELETE FROM private.specialist_capability_assessment_configs config
WHERE config.bank_version = 1
  AND config.competency_blueprint = '[]'::jsonb
  AND config.assessment_key IN (
    'clarity_mastery_v1',
    'structured_execution_mastery_v1',
    'controlled_discomfort_mastery_v1',
    'time_pressure_stability_mastery_v1',
    'topic_conditioning_mastery_v1',
    'intro_session_structure_mastery_v1',
    'logging_system_mastery_v1',
    'session_flow_control_mastery_v1',
    'drill_library_mastery_v1',
    'handover_verification_mastery_v1',
    'tools_required_mastery_v1',
    'transformation_phases_retrieval_v1',
    'session_infrastructure_retrieval_v1',
    'transformation_state_transfer_v1',
    'session_operation_transfer_v1',
    'continuity_delivery_transfer_v1'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM private.specialist_capability_assessment_items item
    WHERE item.assessment_key = config.assessment_key
      AND item.bank_version = config.bank_version
  );

COMMIT;
