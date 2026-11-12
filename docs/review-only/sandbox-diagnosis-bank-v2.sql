-- REVIEW ONLY: Sandbox diagnosis outcome bank V2.
-- Stored under docs/review-only, outside migrations/ and Production migration authority.
-- Do not execute directly. If separately approved later, the governed migration runner
-- owns the transaction boundary. No database is changed by this review artifact.
-- V1 rows and historical evidence are preserved unchanged. V2 is inserted inactive.

do $$
begin
  if exists (
    select 1
    from private.specialist_sandbox_environment_banks
    where bank_key = 'sandbox_stateful_environment'
      and bank_version = 2
  ) then
    raise exception 'Sandbox diagnosis bank V2 already exists; refusing to overwrite it.';
  end if;

  if (
    select count(*)
    from private.specialist_sandbox_diagnosis_outcomes
    where bank_key = 'sandbox_stateful_environment'
      and bank_version = 1
      and active = true
  ) <> 56 then
    raise exception 'Expected exactly 56 active V1 diagnosis outcomes; source bank changed.';
  end if;
end
$$;

insert into private.specialist_sandbox_environment_banks (
  bank_key,
  bank_version,
  title,
  target_outcomes_per_rep,
  minimum_outcomes_per_rep,
  maximum_outcomes_per_rep,
  capability_policy,
  active
)
select
  bank_key,
  2,
  'Stateful Sandbox Environment V2 - Diagnosis Integrity',
  target_outcomes_per_rep,
  minimum_outcomes_per_rep,
  maximum_outcomes_per_rep,
  capability_policy || jsonb_build_object(
    'diagnosisBankRevision',
    2,
    'activationStatus',
    'review_required'
  ),
  false
from private.specialist_sandbox_environment_banks
where bank_key = 'sandbox_stateful_environment'
  and bank_version = 1;

-- Four duplicate canonical outcome pairs are consolidated by retaining pattern_4.
-- pattern_4 has the higher existing selection weight in each pair. The duplicate
-- pattern_5 rows are omitted from V2 only; V1 remains untouched.
insert into private.specialist_sandbox_diagnosis_outcomes (
  bank_key,
  bank_version,
  probe_id,
  outcome_key,
  outcome_version,
  definition,
  active
)
select
  source.bank_key,
  2,
  source.probe_id,
  source.outcome_key,
  2,
  jsonb_set(
    jsonb_set(
      source.definition,
      '{version}',
      '2'::jsonb,
      true
    ),
    '{studentBehavior}',
    to_jsonb(
      case source.outcome_key
        when 'stack.challenge_no_timer.pattern_4' then
          'The earlier Clarity and Structured Execution layers are intact. When difficulty is introduced, the student freezes, cannot establish a controlled first step, exits the difficult condition, and requires immediate Specialist rescue.'
        when 'stack.challenge_no_timer.pattern_8' then
          'The challenge is interpretable except for the method-understanding behaviour, which is confounded by a changed condition. The other recorded layers remain observable.'
        when 'stack.normal_independent.pattern_8' then
          'The response is interpretable except for the method-understanding behaviour, which is confounded by a changed condition. The other recorded execution observations remain observable.'
        when 'stack.timed_challenge.pattern_8' then
          'The timed response is interpretable except for the method-understanding behaviour, which is confounded by a changed condition. The other recorded layers, including the timed observations, remain observable.'
        else source.definition->>'studentBehavior'
      end
    ),
    true
  ),
  true
from private.specialist_sandbox_diagnosis_outcomes source
where source.bank_key = 'sandbox_stateful_environment'
  and source.bank_version = 1
  and source.active = true
  and source.outcome_key not in (
    'clarity.recognition.pattern_5',
    'difficulty.recovery.pattern_5',
    'execution.repeatability.pattern_5',
    'time.consistency.pattern_5'
  );

do $$
declare
  inserted_rows integer;
  duplicate_signatures integer;
begin
  select count(*) into inserted_rows
  from private.specialist_sandbox_diagnosis_outcomes
  where bank_key = 'sandbox_stateful_environment'
    and bank_version = 2
    and active = true;

  if inserted_rows <> 52 then
    raise exception 'Expected 52 active V2 diagnosis outcomes, inserted %.', inserted_rows;
  end if;

  with signatures as (
    select
      probe_id,
      definition->>'trajectoryClass' as trajectory_class,
      jsonb_agg(
        jsonb_build_array(item->>'dimensionId', item->>'behaviorId')
        order by item->>'dimensionId', item->>'behaviorId'
      ) as observation_signature
    from private.specialist_sandbox_diagnosis_outcomes outcome
    cross join lateral jsonb_array_elements(outcome.definition->'canonicalObservations') item
    where outcome.bank_key = 'sandbox_stateful_environment'
      and outcome.bank_version = 2
      and outcome.active = true
    group by outcome.id, probe_id, definition->>'trajectoryClass'
  ),
  duplicate_groups as (
    select probe_id, trajectory_class, observation_signature, count(*) as copies
    from signatures
    group by probe_id, trajectory_class, observation_signature
    having count(*) > 1
  )
  select count(*) into duplicate_signatures from duplicate_groups;

  if duplicate_signatures <> 0 then
    raise exception 'V2 contains % duplicate canonical outcome signatures.', duplicate_signatures;
  end if;

  if exists (
    select 1
    from private.specialist_sandbox_environment_banks
    where bank_key = 'sandbox_stateful_environment'
      and bank_version = 2
      and active = true
  ) then
    raise exception 'V2 must remain inactive pending explicit activation approval.';
  end if;
end
$$;


-- Post-insert review queries (run separately after an explicitly authorized application):
-- select bank_version, active from private.specialist_sandbox_environment_banks
--   where bank_key = 'sandbox_stateful_environment' order by bank_version;
-- select probe_id, count(*) from private.specialist_sandbox_diagnosis_outcomes
--   where bank_key = 'sandbox_stateful_environment' and bank_version = 2 and active
--   group by probe_id order by probe_id;
