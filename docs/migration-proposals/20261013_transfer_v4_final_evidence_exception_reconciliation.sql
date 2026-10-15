-- Proof-only follow-up: supersede inactive operating_system_transfer_v2 v3 with v4
-- before any activation. The published v1 and historical attempts stay immutable.
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('ri_20261013_exception_bank_staging',0));
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM private.specialist_capability_assessment_configs WHERE assessment_key='operating_system_transfer_v2' AND bank_version=3 AND active=false)
 THEN RAISE EXCEPTION 'Expected unactivated review bank v3 not found'; END IF;
 IF EXISTS (SELECT 1 FROM private.specialist_capability_assessment_configs WHERE assessment_key='operating_system_transfer_v2' AND bank_version=4)
 THEN RAISE EXCEPTION 'v4 already exists; refuse overwrite'; END IF;
 IF EXISTS (SELECT 1 FROM public.specialist_capability_assessment_attempts WHERE assessment_key='operating_system_transfer_v2' AND bank_version=3)
 THEN RAISE EXCEPTION 'v3 already has attempts'; END IF;
END $$;
INSERT INTO private.specialist_capability_assessment_configs(assessment_key,bank_version,title,assessment_deep_dive_key,evidence_kind,pass_threshold_percent,form_size,max_attempts,retry_cooldown_hours,competency_blueprint,active,created_at,retired_at,review_mode)
SELECT assessment_key,4,title,assessment_deep_dive_key,evidence_kind,pass_threshold_percent,form_size,max_attempts,retry_cooldown_hours,competency_blueprint,false,NOW(),NULL,false FROM private.specialist_capability_assessment_configs WHERE assessment_key='operating_system_transfer_v2' AND bank_version=3;
INSERT INTO private.specialist_capability_assessment_items(assessment_key,bank_version,item_key,competency_key,deep_dive_key,prompt,question_kind,options,correct_option_keys,critical_fail_option_keys,critical_boundary_keys,explanation,active,created_at,option_feedback)
SELECT assessment_key,4,item_key,competency_key,deep_dive_key,prompt,question_kind,options,correct_option_keys,critical_fail_option_keys,critical_boundary_keys,explanation,active,NOW(),option_feedback
FROM private.specialist_capability_assessment_items WHERE assessment_key='operating_system_transfer_v2' AND bank_version=3;
UPDATE private.specialist_capability_assessment_items
 SET prompt='A later verbal explanation describes the correct step sequence, but the original evidence does not establish independent execution of those steps. Which records preserve integrity?',
 options='[{"key":"a","label":"Keep the original unestablished step-order evidence missing and record any later explanation separately."},{"key":"b","label":"Backfill independent step order from the later explanation because the described method matches the expected sequence."},{"key":"c","label":"Use only genuinely observed execution to judge the original opportunity and preserve its evidentiary limits."},{"key":"d","label":"Mark the missing independent steps weak because absence of direct evidence should count against the learner."},{"key":"e","label":"Ask the student to recreate the steps and substitute that new response for the original observation."}]'::jsonb,
 option_feedback='{"b":"A later explanation does not establish independent execution during the earlier opportunity.","d":"Missing evidence is not a directly observed breakdown in step control.","e":"A new comparable attempt is a new event and cannot replace what the earlier attempt established."}'::jsonb,
 explanation='The original capability claim must be based on the response directly observed under its prescribed condition. A later explanation can be logged as distinct information but cannot manufacture the unestablished original steps. Not observed is an evidence-recording status, not a routine student scenario.'
 WHERE assessment_key='operating_system_transfer_v2' AND bank_version=4 AND item_key='ost_errors_01';
DO $$
BEGIN
 IF (SELECT count(*) FROM private.specialist_capability_assessment_items WHERE assessment_key='operating_system_transfer_v2' AND bank_version=4)<>64
 THEN RAISE EXCEPTION 'v4 bank count changed'; END IF;
 IF (SELECT count(*) FROM private.specialist_capability_assessment_items WHERE assessment_key='operating_system_transfer_v2' AND bank_version=4 AND item_key='ost_errors_01' AND prompt LIKE 'A later verbal explanation%')<>1
 THEN RAISE EXCEPTION 'v4 correction missing'; END IF;
END $$;
COMMIT;
