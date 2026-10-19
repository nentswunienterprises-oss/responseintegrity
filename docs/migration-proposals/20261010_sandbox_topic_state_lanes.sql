-- Proof-first schema for topic-scoped Sandbox conditions.
-- The synthetic Sandbox student retains ONE trajectory and one Specialist capability ledger.
-- Per-topic capability state is stored independently inside its public and private tracks.
-- No real student state authority or browser grants are introduced.
BEGIN;

ALTER TABLE public.specialist_sandbox_trajectories
 ADD COLUMN IF NOT EXISTS active_topic_key varchar(200),
 ADD COLUMN IF NOT EXISTS specialist_topic_states jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE private.specialist_sandbox_trajectory_truth
 ADD COLUMN IF NOT EXISTS canonical_topic_states jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.specialist_sandbox_session_evaluations
 ADD COLUMN IF NOT EXISTS topic_key varchar(200);

ALTER TABLE public.specialist_sandbox_rep_events
 ADD COLUMN IF NOT EXISTS topic_key varchar(200);

-- Associate an existing session with a topic ONLY when its persisted
-- student topic history links to that exact immutable Sandbox session id.
-- No dates, scores, names or arbitrary last-selected-topic guesses.
WITH candidates AS (
 SELECT e.id AS session_id,
        lower(trim(topic_entry.key)) AS topic_key
 FROM public.specialist_sandbox_session_evaluations e
 JOIN public.specialist_sandbox_trajectories tr ON tr.id = e.trajectory_id
 JOIN public.students s ON s.id = tr.student_id
 CROSS JOIN LATERAL jsonb_each(
   CASE WHEN jsonb_typeof(s.concept_mastery->'topicConditioning'->'topics') = 'object'
     THEN s.concept_mastery->'topicConditioning'->'topics'
     ELSE '{}'::jsonb END
 ) AS topic_entry(key, value)
 CROSS JOIN LATERAL jsonb_array_elements(
   CASE WHEN jsonb_typeof(topic_entry.value->'history') = 'array'
     THEN topic_entry.value->'history'
     ELSE '[]'::jsonb END
 ) AS history(entry)
 WHERE history.entry->>'drillId' = e.id
), unique_matches AS (
 SELECT session_id, min(topic_key) AS topic_key
 FROM candidates
 GROUP BY session_id
 HAVING count(DISTINCT topic_key) = 1
)
UPDATE public.specialist_sandbox_session_evaluations e
 SET topic_key = unique_matches.topic_key
 FROM unique_matches
 WHERE e.id = unique_matches.session_id AND e.topic_key IS NULL;

UPDATE public.specialist_sandbox_rep_events ev
 SET topic_key = se.topic_key
 FROM public.specialist_sandbox_session_evaluations se
 WHERE ev.trajectory_id = se.trajectory_id
   AND ev.session_number = se.session_number
   AND se.topic_key IS NOT NULL
   AND ev.topic_key IS NULL;

-- Preserve the last active synthetic student condition as its own topic lane.
-- If attribution is missing, the application fails closed rather than
-- assigning prior private evidence to the wrong selected topic.
UPDATE public.specialist_sandbox_trajectories tr
 SET active_topic_key = (
  SELECT e.topic_key
  FROM public.specialist_sandbox_session_evaluations e
  WHERE e.trajectory_id = tr.id
  ORDER BY e.session_number DESC
  LIMIT 1
 )
 WHERE tr.active_topic_key IS NULL
 AND tr.status = 'active'
 AND EXISTS (
  SELECT 1 FROM public.specialist_sandbox_session_evaluations e
  WHERE e.trajectory_id = tr.id AND e.topic_key IS NOT NULL
 );

DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='sandbox_specialist_topic_states_are_object'
  AND conrelid='public.specialist_sandbox_trajectories'::regclass) THEN
  ALTER TABLE public.specialist_sandbox_trajectories
   ADD CONSTRAINT sandbox_specialist_topic_states_are_object
   CHECK (jsonb_typeof(specialist_topic_states) = 'object');
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='sandbox_canonical_topic_states_are_object'
  AND conrelid='private.specialist_sandbox_trajectory_truth'::regclass) THEN
  ALTER TABLE private.specialist_sandbox_trajectory_truth
   ADD CONSTRAINT sandbox_canonical_topic_states_are_object
   CHECK (jsonb_typeof(canonical_topic_states) = 'object');
 END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sandbox_session_evaluations_topic
 ON public.specialist_sandbox_session_evaluations (trajectory_id, topic_key, session_number);

-- Existing row-level security and revoked anon/authenticated privileges remain unchanged.
COMMIT;
