-- Record the topic-specific response symptom identifiers submitted by parents.
-- The JSON object is keyed by topic and remains optional for neutral-baseline requests.
ALTER TABLE public.parent_enrollments
  ADD COLUMN IF NOT EXISTS topic_response_symptom_ids
  jsonb NOT NULL DEFAULT '{}'::jsonb;
