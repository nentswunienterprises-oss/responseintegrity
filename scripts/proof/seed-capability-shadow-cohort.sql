-- Response Integrity permanent Proof DB fixture
-- Capability Engine Sprint 19 synthetic shadow cohort
--
-- This file is deliberately non-production. Every identity uses proof-shadow-*
-- and no real student, parent, Specialist, credential, payment, or file data is used.
--
-- Expected persisted comparison conditions:
-- A: Battle Test ready + Capability ready -> expected agree_ready
-- B: Battle Test ready + localized Capability critical fail -> expected integrity_disagreement
-- C: partial Capability evidence only -> expected missing_comparison_evidence
-- D: Battle Test not ready + Capability ready -> expected capability_only_ready
--
-- IMPORTANT: The private assessment configs below are sufficient for persisted
-- Sprint 19 shadow-concordance validation only. Their competency_blueprint is
-- intentionally empty and no private assessment items are loaded here. Do NOT
-- use this fixture to claim assessment-form E2E readiness. Release-grade banks
-- require the real 30/40-item coverage rules and CAPABILITY_FORM_SECRET.

BEGIN;

INSERT INTO public.users (id,email,first_name,last_name,role,name,verified)
VALUES
 ('proof-shadow-td','proof-shadow-td@responseintegrity.test','Proof','Reviewer','td','Proof Reviewer',true),
 ('proof-shadow-tutor-a','proof-shadow-a@responseintegrity.test','Proof','Alpha','tutor','Proof Alpha',true),
 ('proof-shadow-tutor-b','proof-shadow-b@responseintegrity.test','Proof','Bravo','tutor','Proof Bravo',true),
 ('proof-shadow-tutor-c','proof-shadow-c@responseintegrity.test','Proof','Charlie','tutor','Proof Charlie',true),
 ('proof-shadow-tutor-d','proof-shadow-d@responseintegrity.test','Proof','Delta','tutor','Proof Delta',true)
ON CONFLICT (id) DO UPDATE SET
 email=EXCLUDED.email,
 first_name=EXCLUDED.first_name,
 last_name=EXCLUDED.last_name,
 role=EXCLUDED.role,
 name=EXCLUDED.name,
 verified=EXCLUDED.verified;

INSERT INTO public.pods (id,pod_name,pod_type,phase,td_id,status,vehicle)
VALUES ('proof-shadow-pod','Proof Shadow Cohort','training','foundation','proof-shadow-td','active','4_seater')
ON CONFLICT (id) DO UPDATE SET pod_name=EXCLUDED.pod_name, td_id=EXCLUDED.td_id, status=EXCLUDED.status;

INSERT INTO public.tutor_assignments (id,tutor_id,pod_id,student_count,certification_status,operational_mode)
VALUES
 ('proof-shadow-assignment-a','proof-shadow-tutor-a','proof-shadow-pod',1,'passed','training'),
 ('proof-shadow-assignment-b','proof-shadow-tutor-b','proof-shadow-pod',1,'passed','training'),
 ('proof-shadow-assignment-c','proof-shadow-tutor-c','proof-shadow-pod',1,'passed','training'),
 ('proof-shadow-assignment-d','proof-shadow-tutor-d','proof-shadow-pod',1,'passed','training')
ON CONFLICT (id) DO UPDATE SET
 tutor_id=EXCLUDED.tutor_id,
 pod_id=EXCLUDED.pod_id,
 certification_status=EXCLUDED.certification_status,
 operational_mode=EXCLUDED.operational_mode;

INSERT INTO private.specialist_capability_assessment_configs
(assessment_key,bank_version,title,assessment_deep_dive_key,evidence_kind,pass_threshold_percent,form_size,max_attempts,retry_cooldown_hours,competency_blueprint,active)
VALUES
 ('clarity_mastery_v1',1,'Clarity Mastery Check','clarity','mastery',96,15,3,0,'[]'::jsonb,true),
 ('structured_execution_mastery_v1',1,'Structured Execution Mastery Check','structured_execution','mastery',96,15,3,0,'[]'::jsonb,true),
 ('controlled_discomfort_mastery_v1',1,'Controlled Discomfort Mastery Check','controlled_discomfort','mastery',96,15,3,0,'[]'::jsonb,true),
 ('time_pressure_stability_mastery_v1',1,'Time Pressure Stability Mastery Check','time_pressure_stability','mastery',96,15,3,0,'[]'::jsonb,true),
 ('topic_conditioning_mastery_v1',1,'Topic Conditioning Mastery Check','topic_conditioning','mastery',96,15,3,0,'[]'::jsonb,true),
 ('intro_session_structure_mastery_v1',1,'Intro Session Structure Mastery Check','intro_session_structure','mastery',96,15,3,0,'[]'::jsonb,true),
 ('logging_system_mastery_v1',1,'Logging System Mastery Check','logging_system','mastery',96,15,3,0,'[]'::jsonb,true),
 ('session_flow_control_mastery_v1',1,'Session Flow Control Mastery Check','session_flow_control','mastery',96,15,3,0,'[]'::jsonb,true),
 ('drill_library_mastery_v1',1,'Drill Library Mastery Check','drill_library','mastery',96,15,3,0,'[]'::jsonb,true),
 ('handover_verification_mastery_v1',1,'Handover Verification Mastery Check','handover_verification','mastery',96,15,3,0,'[]'::jsonb,true),
 ('tools_required_mastery_v1',1,'Tools Required Mastery Check','tools_required','mastery',96,15,3,0,'[]'::jsonb,true),
 ('transformation_phases_retrieval_v1',1,'Transformation Phases Delayed Retrieval','mixed','retrieval',96,20,3,24,'[]'::jsonb,true),
 ('session_infrastructure_retrieval_v1',1,'Session Infrastructure Delayed Retrieval','mixed','retrieval',96,20,3,24,'[]'::jsonb,true),
 ('transformation_state_transfer_v1',1,'Transformation State Interleaved Transfer','mixed','transfer',96,20,3,24,'[]'::jsonb,true),
 ('session_operation_transfer_v1',1,'Session Operation Interleaved Transfer','mixed','transfer',96,20,3,24,'[]'::jsonb,true),
 ('continuity_delivery_transfer_v1',1,'Continuity and Delivery Integrity Transfer','mixed','transfer',96,20,3,24,'[]'::jsonb,true)
ON CONFLICT (assessment_key,bank_version) DO UPDATE SET
 title=EXCLUDED.title,
 assessment_deep_dive_key=EXCLUDED.assessment_deep_dive_key,
 evidence_kind=EXCLUDED.evidence_kind,
 pass_threshold_percent=EXCLUDED.pass_threshold_percent,
 form_size=EXCLUDED.form_size,
 max_attempts=EXCLUDED.max_attempts,
 retry_cooldown_hours=EXCLUDED.retry_cooldown_hours,
 competency_blueprint=EXCLUDED.competency_blueprint,
 active=EXCLUDED.active;

WITH phases(phase_key,title) AS (
  VALUES
    ('clarity','Clarity Deep Dive'),
    ('structured_execution','Structured Execution Deep Dive'),
    ('controlled_discomfort','Controlled Discomfort Deep Dive'),
    ('time_pressure_stability','Time Pressure Stability Deep Dive'),
    ('topic_conditioning','Topic Conditioning Deep Dive'),
    ('intro_session_structure','Intro Session Structure'),
    ('logging_system','Logging System'),
    ('session_flow_control','Session Flow Control'),
    ('drill_library','Drill Library'),
    ('handover_verification','Handover Verification'),
    ('tools_required','Tools Required')
), run_specs(id,assignment_id,tutor_id,pct,state,completed_at) AS (
  VALUES
    ('proof-shadow-battle-a-1','proof-shadow-assignment-a','proof-shadow-tutor-a',100.0::real,'locked'::battle_test_state,timestamp '2026-09-09 10:00:00'),
    ('proof-shadow-battle-a-2','proof-shadow-assignment-a','proof-shadow-tutor-a',100.0::real,'locked'::battle_test_state,timestamp '2026-09-10 10:00:00'),
    ('proof-shadow-battle-a-3','proof-shadow-assignment-a','proof-shadow-tutor-a',100.0::real,'locked'::battle_test_state,timestamp '2026-09-11 10:00:00'),
    ('proof-shadow-battle-b-1','proof-shadow-assignment-b','proof-shadow-tutor-b',100.0::real,'locked'::battle_test_state,timestamp '2026-09-09 11:00:00'),
    ('proof-shadow-battle-b-2','proof-shadow-assignment-b','proof-shadow-tutor-b',100.0::real,'locked'::battle_test_state,timestamp '2026-09-10 11:00:00'),
    ('proof-shadow-battle-b-3','proof-shadow-assignment-b','proof-shadow-tutor-b',100.0::real,'locked'::battle_test_state,timestamp '2026-09-11 11:00:00'),
    ('proof-shadow-battle-c-1','proof-shadow-assignment-c','proof-shadow-tutor-c',92.0::real,'watchlist'::battle_test_state,timestamp '2026-09-11 12:00:00'),
    ('proof-shadow-battle-d-1','proof-shadow-assignment-d','proof-shadow-tutor-d',88.0::real,'fail'::battle_test_state,timestamp '2026-09-11 13:00:00')
)
INSERT INTO public.battle_test_runs
(id,pod_id,subject_type,subject_user_id,tutor_assignment_id,created_by_user_id,template_key,selected_phase_keys,phase_scores,weak_phases,critical_fail_reasons,total_questions,answered_questions,total_points,possible_points,alignment_percent,state,has_critical_fail,action_required,completed_at,created_at)
SELECT r.id,'proof-shadow-pod','tutor',r.tutor_id,r.assignment_id,'proof-shadow-td','proof-shadow-cohort-v1',
       (SELECT jsonb_agg(p.phase_key ORDER BY p.phase_key) FROM phases p),
       (SELECT jsonb_agg(jsonb_build_object('phaseKey',p.phase_key,'title',p.title,'percent',r.pct) ORDER BY p.phase_key) FROM phases p),
       CASE WHEN r.pct < 90 THEN (SELECT jsonb_agg(p.phase_key ORDER BY p.phase_key) FROM phases p) ELSE '[]'::jsonb END,
       '[]'::jsonb,165,165,r.pct,100,r.pct,r.state,false,
       CASE WHEN r.pct < 96 THEN 'Proof fixture: continue development before readiness.' ELSE NULL END,
       r.completed_at,r.completed_at
FROM run_specs r
ON CONFLICT (id) DO UPDATE SET
 phase_scores=EXCLUDED.phase_scores,
 weak_phases=EXCLUDED.weak_phases,
 total_points=EXCLUDED.total_points,
 alignment_percent=EXCLUDED.alignment_percent,
 state=EXCLUDED.state,
 completed_at=EXCLUDED.completed_at;

WITH assessments(assessment_key,assessment_deep_dive_key,evidence_kind,covered,total_questions) AS (
  VALUES
    ('clarity_mastery_v1','clarity','mastery',jsonb_build_array('clarity'),15),
    ('structured_execution_mastery_v1','structured_execution','mastery',jsonb_build_array('structured_execution'),15),
    ('controlled_discomfort_mastery_v1','controlled_discomfort','mastery',jsonb_build_array('controlled_discomfort'),15),
    ('time_pressure_stability_mastery_v1','time_pressure_stability','mastery',jsonb_build_array('time_pressure_stability'),15),
    ('topic_conditioning_mastery_v1','topic_conditioning','mastery',jsonb_build_array('topic_conditioning'),15),
    ('intro_session_structure_mastery_v1','intro_session_structure','mastery',jsonb_build_array('intro_session_structure'),15),
    ('logging_system_mastery_v1','logging_system','mastery',jsonb_build_array('logging_system'),15),
    ('session_flow_control_mastery_v1','session_flow_control','mastery',jsonb_build_array('session_flow_control'),15),
    ('drill_library_mastery_v1','drill_library','mastery',jsonb_build_array('drill_library'),15),
    ('handover_verification_mastery_v1','handover_verification','mastery',jsonb_build_array('handover_verification'),15),
    ('tools_required_mastery_v1','tools_required','mastery',jsonb_build_array('tools_required'),15),
    ('transformation_phases_retrieval_v1','mixed','retrieval',jsonb_build_array('topic_conditioning','clarity','structured_execution','controlled_discomfort','time_pressure_stability'),20),
    ('session_infrastructure_retrieval_v1','mixed','retrieval',jsonb_build_array('intro_session_structure','logging_system','session_flow_control','drill_library','handover_verification','tools_required'),20),
    ('transformation_state_transfer_v1','mixed','transfer',jsonb_build_array('topic_conditioning','clarity','structured_execution','controlled_discomfort','time_pressure_stability'),20),
    ('session_operation_transfer_v1','mixed','transfer',jsonb_build_array('intro_session_structure','logging_system','session_flow_control','drill_library'),20),
    ('continuity_delivery_transfer_v1','mixed','transfer',jsonb_build_array('handover_verification','tools_required','logging_system','session_flow_control'),20)
), specialists(label,assignment_id,tutor_id) AS (
  VALUES
    ('a','proof-shadow-assignment-a','proof-shadow-tutor-a'),
    ('b','proof-shadow-assignment-b','proof-shadow-tutor-b'),
    ('d','proof-shadow-assignment-d','proof-shadow-tutor-d')
)
INSERT INTO public.specialist_capability_assessment_attempts
(id,tutor_assignment_id,tutor_id,assessment_key,bank_version,attempt_number,form_id,form_item_keys,assessment_deep_dive_key,evidence_kind,covered_deep_dive_keys,pass_threshold_percent,total_questions,correct_questions,percent,has_critical_fail,critical_fail_question_keys,passed,responses,question_results,completed_at,created_at)
SELECT
  'proof-shadow-cap-'||s.label||'-'||a.assessment_key,
  s.assignment_id,s.tutor_id,a.assessment_key,1,1,
  'proof-form-'||s.label||'-'||a.assessment_key,
  jsonb_build_array('proof-fixture'),
  a.assessment_deep_dive_key,a.evidence_kind,a.covered,96,a.total_questions,
  CASE WHEN s.label='b' AND a.assessment_key='logging_system_mastery_v1' THEN a.total_questions-1 ELSE a.total_questions END,
  CASE WHEN s.label='b' AND a.assessment_key='logging_system_mastery_v1' THEN 93.33 ELSE 100 END,
  (s.label='b' AND a.assessment_key='logging_system_mastery_v1'),
  CASE WHEN s.label='b' AND a.assessment_key='logging_system_mastery_v1' THEN jsonb_build_array('proof-critical-logging') ELSE '[]'::jsonb END,
  NOT (s.label='b' AND a.assessment_key='logging_system_mastery_v1'),
  '[]'::jsonb,
  CASE WHEN s.label='b' AND a.assessment_key='logging_system_mastery_v1'
       THEN jsonb_build_array(jsonb_build_object('questionKey','proof-critical-logging','deepDiveKey','logging_system','criticalFail',true))
       ELSE '[]'::jsonb END,
  timestamp with time zone '2026-09-11 14:00:00+02',timestamp with time zone '2026-09-11 14:00:00+02'
FROM assessments a CROSS JOIN specialists s
ON CONFLICT (tutor_assignment_id,assessment_key,attempt_number) DO UPDATE SET
  bank_version=EXCLUDED.bank_version,
  form_id=EXCLUDED.form_id,
  covered_deep_dive_keys=EXCLUDED.covered_deep_dive_keys,
  correct_questions=EXCLUDED.correct_questions,
  percent=EXCLUDED.percent,
  has_critical_fail=EXCLUDED.has_critical_fail,
  critical_fail_question_keys=EXCLUDED.critical_fail_question_keys,
  passed=EXCLUDED.passed,
  question_results=EXCLUDED.question_results,
  completed_at=EXCLUDED.completed_at;

WITH assessments(assessment_key,assessment_deep_dive_key,evidence_kind,covered,total_questions) AS (
  VALUES
    ('clarity_mastery_v1','clarity','mastery',jsonb_build_array('clarity'),15),
    ('structured_execution_mastery_v1','structured_execution','mastery',jsonb_build_array('structured_execution'),15)
)
INSERT INTO public.specialist_capability_assessment_attempts
(id,tutor_assignment_id,tutor_id,assessment_key,bank_version,attempt_number,form_id,form_item_keys,assessment_deep_dive_key,evidence_kind,covered_deep_dive_keys,pass_threshold_percent,total_questions,correct_questions,percent,has_critical_fail,critical_fail_question_keys,passed,responses,question_results,completed_at,created_at)
SELECT
  'proof-shadow-cap-c-'||a.assessment_key,'proof-shadow-assignment-c','proof-shadow-tutor-c',a.assessment_key,1,1,
  'proof-form-c-'||a.assessment_key,jsonb_build_array('proof-fixture'),a.assessment_deep_dive_key,a.evidence_kind,a.covered,96,
  a.total_questions,a.total_questions,100,false,'[]'::jsonb,true,'[]'::jsonb,'[]'::jsonb,
  timestamp with time zone '2026-09-11 14:30:00+02',timestamp with time zone '2026-09-11 14:30:00+02'
FROM assessments a
ON CONFLICT (tutor_assignment_id,assessment_key,attempt_number) DO UPDATE SET
 passed=true, percent=100, completed_at=EXCLUDED.completed_at;

WITH specialists(label,assignment_id,tutor_id) AS (
  VALUES
    ('a','proof-shadow-assignment-a','proof-shadow-tutor-a'),
    ('b','proof-shadow-assignment-b','proof-shadow-tutor-b'),
    ('d','proof-shadow-assignment-d','proof-shadow-tutor-d')
), proofs(proof_key,artifact_type,competency_links,judgments) AS (
  VALUES
    ('prepare','screen_voice',
      jsonb_build_array(jsonb_build_object('deepDiveKey','clarity','competencyKey','system.authority')),
      jsonb_build_array(
        jsonb_build_object('criterionKey','case_state_fidelity','judgment','clear','evidenceNote',null),
        jsonb_build_object('criterionKey','system_selected_plan','judgment','clear','evidenceNote',null),
        jsonb_build_object('criterionKey','condition_preparation','judgment','clear','evidenceNote',null),
        jsonb_build_object('criterionKey','observation_targets','judgment','clear','evidenceNote',null),
        jsonb_build_object('criterionKey','observability_preflight','judgment','clear','evidenceNote',null),
        jsonb_build_object('criterionKey','authority_and_escalation','judgment','clear','evidenceNote',null)
      )),
    ('execute','screen_video',
      jsonb_build_array(jsonb_build_object('deepDiveKey','structured_execution','competencyKey','structured_execution.independent_execution')),
      jsonb_build_array(
        jsonb_build_object('criterionKey','opening_and_condition','judgment','clear','evidenceNote',null),
        jsonb_build_object('criterionKey','instruction_support_boundary','judgment','clear','evidenceNote',null),
        jsonb_build_object('criterionKey','difficulty_without_rescue','judgment','clear','evidenceNote',null),
        jsonb_build_object('criterionKey','assistance_evidence_fidelity','judgment','clear','evidenceNote',null),
        jsonb_build_object('criterionKey','system_flow_fidelity','judgment','clear','evidenceNote',null),
        jsonb_build_object('criterionKey','close_record_escalate','judgment','clear','evidenceNote',null)
      )),
    ('evidence','screen_voice',
      jsonb_build_array(jsonb_build_object('deepDiveKey','logging_system','competencyKey','evidence.logging_integrity')),
      jsonb_build_array(
        jsonb_build_object('criterionKey','observation_vs_inference','judgment','clear','evidenceNote',null),
        jsonb_build_object('criterionKey','raw_behavior_fidelity','judgment','clear','evidenceNote',null),
        jsonb_build_object('criterionKey','assistance_contamination','judgment','clear','evidenceNote',null),
        jsonb_build_object('criterionKey','rep_lineage_and_history','judgment','clear','evidenceNote',null),
        jsonb_build_object('criterionKey','missing_evidence_recovery','judgment','clear','evidenceNote',null),
        jsonb_build_object('criterionKey','claim_and_system_authority','judgment','clear','evidenceNote',null)
      ))
), inserted AS (
  INSERT INTO public.specialist_capability_practical_evidence
    (id,tutor_assignment_id,tutor_id,proof_key,proof_version,attempt_number,artifact_url,artifact_type,declaration,competency_links,no_real_student_data_confirmed,rubric_version,rubric_snapshot,submitted_at,created_at)
  SELECT
    'proof-shadow-practical-'||s.label||'-'||p.proof_key,
    s.assignment_id,s.tutor_id,p.proof_key,1,1,
    'proof://synthetic/'||s.label||'/'||p.proof_key,
    p.artifact_type,
    jsonb_build_object('fixture','proof-shadow','synthetic',true),
    p.competency_links,true,1,
    jsonb_build_object('fixture','proof-shadow','version',1,'outcomeRuleVersion',1),
    timestamp with time zone '2026-09-11 15:00:00+02',timestamp with time zone '2026-09-11 15:00:00+02'
  FROM specialists s CROSS JOIN proofs p
  ON CONFLICT (tutor_assignment_id,proof_key,proof_version,attempt_number) DO UPDATE SET
    artifact_url=EXCLUDED.artifact_url,
    artifact_type=EXCLUDED.artifact_type,
    declaration=EXCLUDED.declaration,
    competency_links=EXCLUDED.competency_links,
    no_real_student_data_confirmed=true,
    rubric_version=1,
    rubric_snapshot=EXCLUDED.rubric_snapshot,
    submitted_at=EXCLUDED.submitted_at
  RETURNING id, proof_key
)
INSERT INTO public.specialist_capability_practical_reviews
  (id,evidence_id,reviewer_id,reviewer_role,outcome,reason_code,feedback,rubric_version,outcome_rule_version,criterion_judgments,clear_count,partial_count,fail_count,critical_fail_count,critical_fail_criterion_keys,reviewed_at,created_at)
SELECT
  'review-'||e.id,e.id,'proof-shadow-td','td','approved','rubric_clear',
  'Synthetic proof fixture: all current rubric criteria clear.',1,1,p.judgments,6,0,0,0,'[]'::jsonb,
  timestamp with time zone '2026-09-11 15:10:00+02',timestamp with time zone '2026-09-11 15:10:00+02'
FROM inserted e JOIN proofs p ON p.proof_key=e.proof_key
ON CONFLICT (evidence_id) DO UPDATE SET
  reviewer_id=EXCLUDED.reviewer_id,
  reviewer_role=EXCLUDED.reviewer_role,
  outcome=EXCLUDED.outcome,
  reason_code=EXCLUDED.reason_code,
  feedback=EXCLUDED.feedback,
  rubric_version=EXCLUDED.rubric_version,
  outcome_rule_version=EXCLUDED.outcome_rule_version,
  criterion_judgments=EXCLUDED.criterion_judgments,
  clear_count=EXCLUDED.clear_count,
  partial_count=0,
  fail_count=0,
  critical_fail_count=0,
  critical_fail_criterion_keys='[]'::jsonb,
  reviewed_at=EXCLUDED.reviewed_at;

WITH specialists(label,assignment_id,tutor_id) AS (
  VALUES
    ('a','proof-shadow-assignment-a','proof-shadow-tutor-a'),
    ('b','proof-shadow-assignment-b','proof-shadow-tutor-b'),
    ('d','proof-shadow-assignment-d','proof-shadow-tutor-d')
)
INSERT INTO public.specialist_capability_oral_defenses
  (id,tutor_assignment_id,tutor_id,defense_version,attempt_number,reviewer_id,reviewer_role,brief_snapshot,probes,clear_count,partial_count,fail_count,integrity_concern_count,outcome,feedback,sandbox_scenario_confirmed,completed_at,created_at)
SELECT
  'proof-shadow-oral-'||s.label,
  s.assignment_id,s.tutor_id,2,1,'proof-shadow-td','td',
  jsonb_build_object(
    'fixture','proof-shadow','synthetic',true,
    'probes',jsonb_build_array(
      jsonb_build_object('focusKey','system.authority','deepDiveKey','clarity','rubric',jsonb_build_object('criticalOnFail',true,'criticalBoundaryLinks','[]'::jsonb)),
      jsonb_build_object('focusKey','evidence.contamination','deepDiveKey','clarity','rubric',jsonb_build_object('criticalOnFail',true,'criticalBoundaryLinks','[]'::jsonb)),
      jsonb_build_object('focusKey','discernment.escalation_boundary','deepDiveKey','structured_execution','rubric',jsonb_build_object('criticalOnFail',true,'criticalBoundaryLinks','[]'::jsonb))
    )
  ),
  jsonb_build_array(
    jsonb_build_object('focusKey','system.authority','deepDiveKey','clarity','scenarioSummary','Synthetic authority scenario','observedResponseSummary','Preserved system authority and escalated appropriately.','judgment','clear'),
    jsonb_build_object('focusKey','evidence.contamination','deepDiveKey','clarity','scenarioSummary','Synthetic contamination scenario','observedResponseSummary','Separated assisted performance from independent evidence.','judgment','clear'),
    jsonb_build_object('focusKey','discernment.escalation_boundary','deepDiveKey','structured_execution','scenarioSummary','Synthetic escalation scenario','observedResponseSummary','Preserved safe boundary and escalated rather than inventing protocol.','judgment','clear')
  ),
  3,0,0,0,'approved','Synthetic proof fixture: current Oral Defense V2 approved.',true,
  timestamp with time zone '2026-09-11 15:30:00+02',timestamp with time zone '2026-09-11 15:30:00+02'
FROM specialists s
ON CONFLICT (tutor_assignment_id,defense_version,attempt_number) DO UPDATE SET
  reviewer_id=EXCLUDED.reviewer_id,
  reviewer_role=EXCLUDED.reviewer_role,
  brief_snapshot=EXCLUDED.brief_snapshot,
  probes=EXCLUDED.probes,
  clear_count=3,
  partial_count=0,
  fail_count=0,
  integrity_concern_count=0,
  outcome='approved',
  feedback=EXCLUDED.feedback,
  sandbox_scenario_confirmed=true,
  completed_at=EXCLUDED.completed_at;

INSERT INTO public.tutor_trial_cases
  (id,tutor_id,tutor_assignment_id,status,risk_state,risk_note,started_at,reviewable_at,closed_at,created_by_user_id,created_at,updated_at)
VALUES
  ('proof-shadow-trial-a','proof-shadow-tutor-a','proof-shadow-assignment-a','certified','clear',null,'2026-09-01 09:00:00+02','2026-09-11 16:00:00+02','2026-09-11 16:10:00+02','proof-shadow-td','2026-09-01 09:00:00+02','2026-09-11 16:10:00+02'),
  ('proof-shadow-trial-b','proof-shadow-tutor-b','proof-shadow-assignment-b','remediation_required','remediation','Synthetic proof fixture: critical Capability evidence requires remediation.','2026-09-01 09:05:00+02','2026-09-11 16:00:00+02',null,'proof-shadow-td','2026-09-01 09:05:00+02','2026-09-11 16:10:00+02'),
  ('proof-shadow-trial-d','proof-shadow-tutor-d','proof-shadow-assignment-d','reviewable','clear',null,'2026-09-01 09:10:00+02','2026-09-11 16:00:00+02',null,'proof-shadow-td','2026-09-01 09:10:00+02','2026-09-11 16:00:00+02')
ON CONFLICT (id) DO UPDATE SET
 status=EXCLUDED.status,
 risk_state=EXCLUDED.risk_state,
 risk_note=EXCLUDED.risk_note,
 reviewable_at=EXCLUDED.reviewable_at,
 closed_at=EXCLUDED.closed_at,
 updated_at=EXCLUDED.updated_at;

INSERT INTO public.tutor_certification_decisions
  (id,case_id,decision,rationale,idempotency_key,decided_by_user_id,decided_at,created_at)
VALUES
  ('proof-shadow-decision-a','proof-shadow-trial-a','certified','Synthetic proof fixture: positive downstream outcome target.','proof-shadow-decision-key-a','proof-shadow-td','2026-09-11 16:10:00+02','2026-09-11 16:10:00+02'),
  ('proof-shadow-decision-b','proof-shadow-trial-b','remediation_required','Synthetic proof fixture: remediation downstream outcome target.','proof-shadow-decision-key-b','proof-shadow-td','2026-09-11 16:10:00+02','2026-09-11 16:10:00+02')
ON CONFLICT (idempotency_key) DO UPDATE SET
 decision=EXCLUDED.decision,
 rationale=EXCLUDED.rationale,
 decided_by_user_id=EXCLUDED.decided_by_user_id,
 decided_at=EXCLUDED.decided_at;

COMMIT;
