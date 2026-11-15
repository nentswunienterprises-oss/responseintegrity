-- Activate Sandbox diagnosis integrity revision V2 (bank version 4).
-- Preconditions validate the bank and narratives before changing only the V4 bank row.
do $$
declare
  updated_rows integer;
  duplicate_signatures integer;
begin
  if (
    select count(*) from private.specialist_sandbox_environment_banks
     where bank_key='sandbox_stateful_environment' and bank_version=4
  ) <> 1 then
    raise exception 'Expected exactly one seeded Sandbox bank version 4.';
  end if;

  if exists (
    select 1 from private.specialist_sandbox_environment_banks
     where bank_key='sandbox_stateful_environment' and bank_version=4
       and (active is distinct from false
         or coalesce((capability_policy->>'runtimeEligible')::boolean, true) is distinct from false)
  ) then
    raise exception 'V4 must still be inactive and runtime-ineligible before activation.';
  end if;

  if (
    select count(*) from private.specialist_sandbox_diagnosis_outcomes
     where bank_key='sandbox_stateful_environment' and bank_version=1 and active=true
  ) <> 56 or (
    select count(*) from private.specialist_sandbox_rep_outcomes
     where bank_key='sandbox_stateful_environment' and bank_version=1 and active=true
  ) <> 264 then
    raise exception 'V1 active source counts changed; refusing V4 activation.';
  end if;

  if (
    select count(*) from private.specialist_sandbox_diagnosis_outcomes
     where bank_key='sandbox_stateful_environment' and bank_version=4 and active=true
  ) <> 52 or (
    select count(*) from private.specialist_sandbox_rep_outcomes
     where bank_key='sandbox_stateful_environment' and bank_version=4 and active=true
  ) <> 264 then
    raise exception 'V4 must contain exactly 52 active diagnosis outcomes and 264 active Training outcomes.';
  end if;

  if exists (
    select outcome_key
      from private.specialist_sandbox_diagnosis_outcomes
     where bank_key='sandbox_stateful_environment' and bank_version=4 and active=true
     group by outcome_key having count(*) <> 1
  ) or (
    select count(distinct probe_id)
      from private.specialist_sandbox_diagnosis_outcomes
     where bank_key='sandbox_stateful_environment' and bank_version=4 and active=true
  ) <> 7 then
    raise exception 'V4 diagnosis keys or probe coverage are invalid.';
  end if;

  with signatures as (
    select probe_id, definition->>'trajectoryClass' as trajectory_class,
      jsonb_agg(jsonb_build_array(item->>'dimensionId',item->>'behaviorId')
        order by item->>'dimensionId',item->>'behaviorId') as signature
    from private.specialist_sandbox_diagnosis_outcomes outcome
    cross join lateral jsonb_array_elements(outcome.definition->'canonicalObservations') item
    where bank_key='sandbox_stateful_environment' and bank_version=4 and active=true
    group by outcome.id, probe_id, definition->>'trajectoryClass'
  )
  select count(*) into duplicate_signatures from (
    select probe_id, trajectory_class, signature from signatures
    group by probe_id, trajectory_class, signature having count(*) > 1
  ) duplicates;
  if duplicate_signatures <> 0 then
    raise exception 'V4 has duplicate canonical observation signatures.';
  end if;

  if exists (
    select 1
      from private.specialist_sandbox_diagnosis_outcomes outcome
     where bank_key='sandbox_stateful_environment' and bank_version=4 and active=true
       and outcome_key in (
         'stack.challenge_no_timer.pattern_8',
         'stack.normal_independent.pattern_8',
         'stack.timed_challenge.pattern_8'
       )
       and (
         select count(*) from jsonb_array_elements(definition->'canonicalObservations') observation
          where observation->>'dimensionId'='clarity.method'
            and observation->>'behaviorId'='confounded'
       ) <> 1
  ) or (
    select count(*) from private.specialist_sandbox_diagnosis_outcomes
     where bank_key='sandbox_stateful_environment' and bank_version=4 and active=true
       and outcome_key in (
         'stack.challenge_no_timer.pattern_8',
         'stack.normal_independent.pattern_8',
         'stack.timed_challenge.pattern_8'
       )
  ) <> 3 then
    raise exception 'Each stacked pattern_8 narrative must retain exactly one canonical clarity.method/confounded observation.';
  end if;

  if not exists (
    select 1
      from private.specialist_sandbox_diagnosis_outcomes
     where bank_key='sandbox_stateful_environment' and bank_version=4 and active=true
       and outcome_key='stack.challenge_no_timer.pattern_4'
       and definition->>'studentBehavior' ilike '%earlier Clarity and Structured Execution layers are intact%'
       and (select count(*) from jsonb_array_elements(definition->'canonicalObservations')) = 11
       and not exists (
         select expected.dimension_id, expected.behavior_id
         from (values
           ('clarity.vocabulary','accurate_recognition'),
           ('clarity.method','correct_method_cleanly'),
           ('clarity.reason','clear_reason'),
           ('clarity.immediate_apply','engages_cleanly'),
           ('execution.start','valid_independent_start'),
           ('execution.step_discipline','structure_maintained'),
           ('execution.independence','independent_throughout'),
           ('difficulty.initial_response','withdraws_or_freezes'),
           ('difficulty.first_step_control','no_controlled_step'),
           ('difficulty.tolerance','exits_difficulty'),
           ('difficulty.rescue_dependence','immediate_rescue')
         ) expected(dimension_id,behavior_id)
         except
         select observation->>'dimensionId', observation->>'behaviorId'
         from jsonb_array_elements(definition->'canonicalObservations') observation
       )
  ) then
    raise exception 'Stacked challenge_no_timer pattern_4 narrative/canonical sequence is incomplete.';
  end if;

  update private.specialist_sandbox_environment_banks
     set active=true,
         capability_policy=coalesce(capability_policy,'{}'::jsonb) ||
           jsonb_build_object('diagnosisBankRevision',2,'activationStatus','active','runtimeEligible',true)
   where bank_key='sandbox_stateful_environment' and bank_version=4
     and active=false
     and coalesce((capability_policy->>'runtimeEligible')::boolean,true)=false;
  get diagnostics updated_rows = row_count;
  if updated_rows <> 1 then
    raise exception 'Expected to activate exactly one V4 bank row; changed %.', updated_rows;
  end if;
end
$$;
