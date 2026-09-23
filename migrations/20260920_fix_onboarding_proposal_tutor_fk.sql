-- Correct onboarding_proposals.tutor_id to use the application's public.users identity.
-- Existing environments may have created this column as UUID REFERENCES auth.users(id),
-- while the application, students.tutor_id, and Drizzle schema use public.users.id (VARCHAR).

BEGIN;

ALTER TABLE public.onboarding_proposals
  DROP CONSTRAINT IF EXISTS onboarding_proposals_tutor_id_fkey;

ALTER TABLE public.onboarding_proposals
  ALTER COLUMN tutor_id TYPE VARCHAR USING tutor_id::text;

ALTER TABLE public.onboarding_proposals
  ADD CONSTRAINT onboarding_proposals_tutor_id_fkey
  FOREIGN KEY (tutor_id) REFERENCES public.users(id);

COMMIT;
