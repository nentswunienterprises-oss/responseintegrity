-- Capability Proof only: copy four inactive bank revisions with precise parity wording fixes.
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('ri_20261013_exception_bank_staging',0));
CREATE TEMP TABLE _ri_quality_edits ON COMMIT DROP AS SELECT * FROM jsonb_to_recordset('[{"assessment_key":"how_the_system_resolves_uncertainty_mastery_v1","item_key":"how_the_system_resolves_uncertainty_f13_base","option_key":"d","label":"To keep practising until every Handover dimension eventually looks strong, regardless of the unresolved evidence question."},{"assessment_key":"how_the_system_resolves_uncertainty_mastery_v1","item_key":"uncertainty_extra_20","option_key":"d","label":"To make the problem easier so the student can produce a successful result, rather than to isolate causal evidence."},{"assessment_key":"how_the_system_resolves_uncertainty_mastery_v1","item_key":"uncertainty_extra_25","option_key":"a","label":"To keep repeating continuity work until every field appears positive, even after the specific question is answered."},{"assessment_key":"how_to_diagnose_mastery_v1","item_key":"how_to_diagnose_extra_11","option_key":"c","label":"A need to prompt the student into naming a method before any neutral recognition judgment can be made."},{"assessment_key":"how_to_diagnose_mastery_v1","item_key":"how_to_diagnose_extra_11","option_key":"e","label":"A Time Pressure Stability weakness based solely on delayed recognition despite the absence of a timer."},{"assessment_key":"how_to_diagnose_mastery_v1","item_key":"how_to_diagnose_f09_base","option_key":"e","label":"No. The next action must follow the resolved evidence question; an unused reserve is not a reason to continue."},{"assessment_key":"how_to_interpret_prompts_mastery_v1","item_key":"interpret_prompts_extra_20","option_key":"b","label":"Because recording after the rep permits reconstructing the behaviour from memory, even without trustworthy direct observation."},{"assessment_key":"how_to_interpret_prompts_mastery_v1","item_key":"interpret_prompts_extra_20","option_key":"d","label":"Because interrupting execution with observation questions gives fresher evidence without altering the response."},{"assessment_key":"how_to_interpret_prompts_mastery_v1","item_key":"interpret_prompts_extra_20","option_key":"e","label":"Because the student should retrospectively answer the Specialist''s evidence questions on their behalf."},{"assessment_key":"how_to_interpret_prompts_mastery_v1","item_key":"how_to_interpret_prompts_f09_base","option_key":"d","label":"After Student Finished; the Specialist must preserve the uninterrupted solve rather than question or coach pace during it."},{"assessment_key":"what_not_to_do_mastery_v1","item_key":"what_not_to_do_extra_12","option_key":"b","label":"The evidence record must include the Specialist''s added pacing intervention, even though the original timer remained active."},{"assessment_key":"what_not_to_do_mastery_v1","item_key":"what_not_to_do_f02_base","option_key":"e","label":"The prescribed timer and no-support boundaries remain in force when the student stalls; discomfort is not permission to change them."}]'::jsonb) AS q(assessment_key text,item_key text,option_key text,label text);
CREATE TEMP TABLE _ri_quality_versions ON COMMIT DROP AS
 SELECT assessment_key,max(bank_version) from_version,max(bank_version)+1 to_version
 FROM private.specialist_capability_assessment_configs
 WHERE assessment_key IN (SELECT DISTINCT assessment_key FROM _ri_quality_edits)
 GROUP BY assessment_key;
DO $$ BEGIN
 IF (SELECT count(*) FROM _ri_quality_versions)<>4 OR (SELECT count(*) FROM _ri_quality_edits)<>12
 THEN RAISE EXCEPTION 'Unexpected quality patch scope'; END IF;
 IF EXISTS (SELECT 1 FROM _ri_quality_versions v JOIN private.specialist_capability_assessment_configs c ON c.assessment_key=v.assessment_key AND c.bank_version=v.from_version WHERE c.active OR c.review_mode)
 THEN RAISE EXCEPTION 'Active or review bank cannot be copied'; END IF;
 IF EXISTS (SELECT 1 FROM public.specialist_capability_assessment_attempts a JOIN _ri_quality_versions v ON a.assessment_key=v.assessment_key AND a.bank_version=v.from_version)
 THEN RAISE EXCEPTION 'Staged version contains attempts'; END IF;
 IF EXISTS (SELECT 1 FROM _ri_quality_edits e JOIN _ri_quality_versions v USING(assessment_key) LEFT JOIN private.specialist_capability_assessment_items i ON i.assessment_key=e.assessment_key AND i.item_key=e.item_key AND i.bank_version=v.from_version
 WHERE i.item_key IS NULL OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(i.options) x WHERE x->>'key'=e.option_key))
 THEN RAISE EXCEPTION 'Source option unavailable'; END IF;
END $$;
INSERT INTO private.specialist_capability_assessment_configs(assessment_key,bank_version,title,assessment_deep_dive_key,evidence_kind,pass_threshold_percent,form_size,max_attempts,retry_cooldown_hours,competency_blueprint,active,created_at,retired_at,review_mode)
SELECT c.assessment_key,v.to_version,c.title,c.assessment_deep_dive_key,c.evidence_kind,c.pass_threshold_percent,c.form_size,c.max_attempts,c.retry_cooldown_hours,c.competency_blueprint,false,NOW(),NULL,false
FROM private.specialist_capability_assessment_configs c JOIN _ri_quality_versions v ON v.assessment_key=c.assessment_key AND v.from_version=c.bank_version;
INSERT INTO private.specialist_capability_assessment_items(assessment_key,bank_version,item_key,competency_key,deep_dive_key,prompt,question_kind,options,correct_option_keys,critical_fail_option_keys,critical_boundary_keys,explanation,active,created_at,option_feedback)
SELECT i.assessment_key,v.to_version,i.item_key,i.competency_key,i.deep_dive_key,i.prompt,i.question_kind,i.options,i.correct_option_keys,i.critical_fail_option_keys,i.critical_boundary_keys,i.explanation,i.active,NOW(),i.option_feedback
FROM private.specialist_capability_assessment_items i JOIN _ri_quality_versions v ON v.assessment_key=i.assessment_key AND v.from_version=i.bank_version;
UPDATE private.specialist_capability_assessment_items i SET options=(
 SELECT jsonb_agg(CASE WHEN elem->>'key'=e.option_key THEN jsonb_set(elem,'{label}',to_jsonb(e.label),true) ELSE elem END ORDER BY ord)
 FROM jsonb_array_elements(i.options) WITH ORDINALITY elements(elem,ord)
)
FROM _ri_quality_versions v JOIN _ri_quality_edits e ON e.assessment_key=v.assessment_key
WHERE i.assessment_key=v.assessment_key AND i.bank_version=v.to_version AND i.item_key=e.item_key
  AND (SELECT count(*) FROM _ri_quality_edits p WHERE p.assessment_key=e.assessment_key AND p.item_key=e.item_key)=1;
-- Multi-option items are handled independently; all option edits must be applied.
UPDATE private.specialist_capability_assessment_items i SET options=(
 SELECT jsonb_agg(COALESCE(
 (SELECT jsonb_set(elem,'{label}',to_jsonb(p.label),true) FROM _ri_quality_edits p WHERE p.assessment_key=i.assessment_key AND p.item_key=i.item_key AND p.option_key=elem->>'key'),
 elem) ORDER BY ord)
 FROM jsonb_array_elements(i.options) WITH ORDINALITY elements(elem,ord)
)
WHERE EXISTS (SELECT 1 FROM _ri_quality_edits p WHERE p.assessment_key=i.assessment_key AND p.item_key=i.item_key)
AND EXISTS (SELECT 1 FROM _ri_quality_versions v WHERE v.assessment_key=i.assessment_key AND v.to_version=i.bank_version);
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM _ri_quality_edits e JOIN _ri_quality_versions v USING(assessment_key) JOIN private.specialist_capability_assessment_items i ON i.assessment_key=e.assessment_key AND i.bank_version=v.to_version AND i.item_key=e.item_key WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(i.options) x WHERE x->>'key'=e.option_key AND x->>'label'=e.label))
 THEN RAISE EXCEPTION 'Quality replacement not read back'; END IF;
 IF EXISTS (SELECT 1 FROM _ri_quality_versions v LEFT JOIN (SELECT assessment_key,bank_version,count(*) n FROM private.specialist_capability_assessment_items GROUP BY 1,2) original ON original.assessment_key=v.assessment_key AND original.bank_version=v.from_version LEFT JOIN (SELECT assessment_key,bank_version,count(*) n FROM private.specialist_capability_assessment_items GROUP BY 1,2) revised ON revised.assessment_key=v.assessment_key AND revised.bank_version=v.to_version WHERE original.n<>revised.n OR revised.n IS NULL)
 THEN RAISE EXCEPTION 'Copied pool mismatch'; END IF;
END $$;
COMMIT;
