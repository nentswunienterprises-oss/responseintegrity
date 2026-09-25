CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.specialist_sandbox_scenario_banks (
  bank_key varchar NOT NULL,
  bank_version integer NOT NULL CHECK (bank_version > 0),
  title varchar NOT NULL,
  max_attempts integer NOT NULL DEFAULT 6 CHECK (max_attempts > 0),
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  retired_at timestamptz,
  PRIMARY KEY (bank_key, bank_version)
);
ALTER TABLE private.specialist_sandbox_scenario_banks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.specialist_sandbox_scenario_banks FROM PUBLIC, anon, authenticated;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sandbox_scenario_bank_one_active
ON private.specialist_sandbox_scenario_banks (bank_key) WHERE active = true;

CREATE TABLE IF NOT EXISTS private.specialist_sandbox_scenarios (
  bank_key varchar NOT NULL,
  bank_version integer NOT NULL,
  scenario_key varchar NOT NULL,
  scenario_version integer NOT NULL CHECK (scenario_version > 0),
  definition jsonb NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bank_key, bank_version, scenario_key),
  FOREIGN KEY (bank_key, bank_version)
    REFERENCES private.specialist_sandbox_scenario_banks (bank_key, bank_version)
    ON DELETE RESTRICT
);
ALTER TABLE private.specialist_sandbox_scenarios ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.specialist_sandbox_scenarios FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.specialist_sandbox_simulation_attempts (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tutor_assignment_id varchar NOT NULL REFERENCES public.tutor_assignments(id) ON DELETE CASCADE,
  tutor_id varchar NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  bank_key varchar NOT NULL,
  bank_version integer NOT NULL CHECK (bank_version > 0),
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  scenario_form_id varchar NOT NULL,
  scenario_key varchar NOT NULL,
  scenario_version integer NOT NULL CHECK (scenario_version > 0),
  phase varchar NOT NULL,
  previous_stability varchar NOT NULL,
  total_observations integer NOT NULL CHECK (total_observations > 0),
  matching_observations integer NOT NULL CHECK (matching_observations >= 0),
  observation_fidelity_percent numeric(5,2) NOT NULL CHECK (observation_fidelity_percent >= 0 AND observation_fidelity_percent <= 100),
  system_outcome_matched boolean NOT NULL,
  passed boolean NOT NULL,
  specialist_outcome jsonb NOT NULL,
  canonical_outcome jsonb NOT NULL,
  submission jsonb NOT NULL,
  student_state_authoritative boolean NOT NULL DEFAULT false CHECK (student_state_authoritative = false),
  evidence_scope varchar(16) NOT NULL DEFAULT 'sandbox' CHECK (evidence_scope = 'sandbox'),
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tutor_assignment_id, bank_key, bank_version, attempt_number)
);
ALTER TABLE public.specialist_sandbox_simulation_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.specialist_sandbox_simulation_attempts FROM PUBLIC, anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_specialist_sandbox_attempt_assignment
ON public.specialist_sandbox_simulation_attempts (tutor_assignment_id, completed_at DESC);

UPDATE private.specialist_sandbox_scenario_banks
SET active=false, retired_at=COALESCE(retired_at,now())
WHERE bank_key='sandbox_observation_foundation' AND active=true AND bank_version<>1;

INSERT INTO private.specialist_sandbox_scenario_banks
(bank_key,bank_version,title,max_attempts,active,retired_at)
VALUES ('sandbox_observation_foundation',1,'Sandbox Observation Foundation V1',6,true,null)
ON CONFLICT (bank_key,bank_version) DO UPDATE
SET title=excluded.title,max_attempts=excluded.max_attempts,active=true,retired_at=null;

INSERT INTO private.specialist_sandbox_scenarios
(bank_key,bank_version,scenario_key,scenario_version,definition,active)
VALUES
('sandbox_observation_foundation',1,'clarity_recovery_v1',1,$scenario${"key":"clarity_recovery_v1","version":1,"title":"Clarity — Recovery into clean execution","description":"A fictional learner begins with partial recognition, then settles into clear independent Clarity evidence across the remaining opportunities.","phase":"Clarity","previousStability":"Low","passThresholdPercent":90,"sets":[{"setId":"clarity.identification","reps":[{"repNumber":1,"studentBehavior":"The learner names the vocabulary correctly, but gives only a partial method description and weak reason, then hesitates before responding.","observations":{"vocabulary":{"optionId":"clarity.identification.opportunity_1.clarity.vocabulary.option_3","evidenceStatus":"observed"},"method":{"optionId":"clarity.identification.opportunity_1.clarity.method.option_2","evidenceStatus":"observed"},"reason":{"optionId":"clarity.identification.opportunity_1.clarity.reason.option_2","evidenceStatus":"observed"},"immediateApply":{"optionId":"clarity.identification.opportunity_1.clarity.immediate_apply.option_2","evidenceStatus":"observed"}}},{"repNumber":2,"studentBehavior":"Without help, the learner names the vocabulary, identifies the method clearly, explains why it applies, and responds confidently.","observations":{"vocabulary":{"optionId":"clarity.identification.opportunity_2.clarity.vocabulary.option_3","evidenceStatus":"observed"},"method":{"optionId":"clarity.identification.opportunity_2.clarity.method.option_3","evidenceStatus":"observed"},"reason":{"optionId":"clarity.identification.opportunity_2.clarity.reason.option_3","evidenceStatus":"observed"},"immediateApply":{"optionId":"clarity.identification.opportunity_2.clarity.immediate_apply.option_3","evidenceStatus":"observed"}}},{"repNumber":3,"studentBehavior":"The learner repeats the recognition cleanly without solving: vocabulary, method and reason are clear, and the response is confident.","observations":{"vocabulary":{"optionId":"clarity.identification.opportunity_3.clarity.vocabulary.option_3","evidenceStatus":"observed"},"method":{"optionId":"clarity.identification.opportunity_3.clarity.method.option_3","evidenceStatus":"observed"},"reason":{"optionId":"clarity.identification.opportunity_3.clarity.reason.option_3","evidenceStatus":"observed"},"immediateApply":{"optionId":"clarity.identification.opportunity_3.clarity.immediate_apply.option_3","evidenceStatus":"observed"}}}]},{"setId":"clarity.light_apply","reps":[{"repNumber":1,"studentBehavior":"During light application the learner is partly accurate, uses an inconsistent method, gives a weak reason, and hesitates before starting.","observations":{"vocabulary":{"optionId":"clarity.light_apply.opportunity_1.clarity.vocabulary.option_2","evidenceStatus":"observed"},"method":{"optionId":"clarity.light_apply.opportunity_1.clarity.method.option_2","evidenceStatus":"observed"},"reason":{"optionId":"clarity.light_apply.opportunity_1.clarity.reason.option_2","evidenceStatus":"observed"},"immediateApply":{"optionId":"clarity.light_apply.opportunity_1.clarity.immediate_apply.option_2","evidenceStatus":"observed"}}},{"repNumber":2,"studentBehavior":"The learner identifies the vocabulary correctly, uses a structured method, states the reason, and starts immediately.","observations":{"vocabulary":{"optionId":"clarity.light_apply.opportunity_2.clarity.vocabulary.option_3","evidenceStatus":"observed"},"method":{"optionId":"clarity.light_apply.opportunity_2.clarity.method.option_3","evidenceStatus":"observed"},"reason":{"optionId":"clarity.light_apply.opportunity_2.clarity.reason.option_3","evidenceStatus":"observed"},"immediateApply":{"optionId":"clarity.light_apply.opportunity_2.clarity.immediate_apply.option_3","evidenceStatus":"observed"}}},{"repNumber":3,"studentBehavior":"The learner again works with correct vocabulary, structured method, present reason and an immediate start without mathematical help.","observations":{"vocabulary":{"optionId":"clarity.light_apply.opportunity_3.clarity.vocabulary.option_3","evidenceStatus":"observed"},"method":{"optionId":"clarity.light_apply.opportunity_3.clarity.method.option_3","evidenceStatus":"observed"},"reason":{"optionId":"clarity.light_apply.opportunity_3.clarity.reason.option_3","evidenceStatus":"observed"},"immediateApply":{"optionId":"clarity.light_apply.opportunity_3.clarity.immediate_apply.option_3","evidenceStatus":"observed"}}}]}]}$scenario$::jsonb,true),
('sandbox_observation_foundation',1,'clarity_late_breakdown_v1',1,$scenario${"key":"clarity_late_breakdown_v1","version":1,"title":"Clarity — Late breakdown under application","description":"A fictional learner looks clear early, then shows a concrete late breakdown that the Specialist must preserve rather than smooth over.","phase":"Clarity","previousStability":"High","passThresholdPercent":90,"sets":[{"setId":"clarity.identification","reps":[{"repNumber":1,"studentBehavior":"The learner names the vocabulary correctly, identifies the method clearly, states why it applies, and answers confidently.","observations":{"vocabulary":{"optionId":"clarity.identification.opportunity_1.clarity.vocabulary.option_3","evidenceStatus":"observed"},"method":{"optionId":"clarity.identification.opportunity_1.clarity.method.option_3","evidenceStatus":"observed"},"reason":{"optionId":"clarity.identification.opportunity_1.clarity.reason.option_3","evidenceStatus":"observed"},"immediateApply":{"optionId":"clarity.identification.opportunity_1.clarity.immediate_apply.option_3","evidenceStatus":"observed"}}},{"repNumber":2,"studentBehavior":"The second recognition opportunity is also clear across vocabulary, method, reason and immediate response.","observations":{"vocabulary":{"optionId":"clarity.identification.opportunity_2.clarity.vocabulary.option_3","evidenceStatus":"observed"},"method":{"optionId":"clarity.identification.opportunity_2.clarity.method.option_3","evidenceStatus":"observed"},"reason":{"optionId":"clarity.identification.opportunity_2.clarity.reason.option_3","evidenceStatus":"observed"},"immediateApply":{"optionId":"clarity.identification.opportunity_2.clarity.immediate_apply.option_3","evidenceStatus":"observed"}}},{"repNumber":3,"studentBehavior":"The learner completes the recognition-only opportunity cleanly again without help or solving.","observations":{"vocabulary":{"optionId":"clarity.identification.opportunity_3.clarity.vocabulary.option_3","evidenceStatus":"observed"},"method":{"optionId":"clarity.identification.opportunity_3.clarity.method.option_3","evidenceStatus":"observed"},"reason":{"optionId":"clarity.identification.opportunity_3.clarity.reason.option_3","evidenceStatus":"observed"},"immediateApply":{"optionId":"clarity.identification.opportunity_3.clarity.immediate_apply.option_3","evidenceStatus":"observed"}}}]},{"setId":"clarity.light_apply","reps":[{"repNumber":1,"studentBehavior":"The learner applies the topic with correct vocabulary, a structured method, present reason and an immediate start.","observations":{"vocabulary":{"optionId":"clarity.light_apply.opportunity_1.clarity.vocabulary.option_3","evidenceStatus":"observed"},"method":{"optionId":"clarity.light_apply.opportunity_1.clarity.method.option_3","evidenceStatus":"observed"},"reason":{"optionId":"clarity.light_apply.opportunity_1.clarity.reason.option_3","evidenceStatus":"observed"},"immediateApply":{"optionId":"clarity.light_apply.opportunity_1.clarity.immediate_apply.option_3","evidenceStatus":"observed"}}},{"repNumber":2,"studentBehavior":"The second application remains clean and independent across all four observed Clarity dimensions.","observations":{"vocabulary":{"optionId":"clarity.light_apply.opportunity_2.clarity.vocabulary.option_3","evidenceStatus":"observed"},"method":{"optionId":"clarity.light_apply.opportunity_2.clarity.method.option_3","evidenceStatus":"observed"},"reason":{"optionId":"clarity.light_apply.opportunity_2.clarity.reason.option_3","evidenceStatus":"observed"},"immediateApply":{"optionId":"clarity.light_apply.opportunity_2.clarity.immediate_apply.option_3","evidenceStatus":"observed"}}},{"repNumber":3,"studentBehavior":"On the final application the learner uses incorrect vocabulary, skips the method, cannot state a reason, and delays before beginning.","observations":{"vocabulary":{"optionId":"clarity.light_apply.opportunity_3.clarity.vocabulary.option_1","evidenceStatus":"observed"},"method":{"optionId":"clarity.light_apply.opportunity_3.clarity.method.option_1","evidenceStatus":"observed"},"reason":{"optionId":"clarity.light_apply.opportunity_3.clarity.reason.option_1","evidenceStatus":"observed"},"immediateApply":{"optionId":"clarity.light_apply.opportunity_3.clarity.immediate_apply.option_1","evidenceStatus":"observed"}}}]}]}$scenario$::jsonb,true)
ON CONFLICT (bank_key,bank_version,scenario_key) DO UPDATE
SET scenario_version=excluded.scenario_version,definition=excluded.definition,active=true;
