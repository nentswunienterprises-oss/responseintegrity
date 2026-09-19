-- Apply before the application release. No historical qualification or handover is invented.
BEGIN;
ALTER TABLE public.parents ALTER COLUMN onboarding_type SET DEFAULT 'pending';
ALTER TABLE public.leads ALTER COLUMN onboarding_type SET DEFAULT 'pending';
ALTER TABLE public.parents DROP CONSTRAINT IF EXISTS chk_onboarding_type;
ALTER TABLE public.parents ADD CONSTRAINT chk_onboarding_type CHECK (onboarding_type IN ('pending','pilot','commercial'));
ALTER TABLE public.parent_enrollments
  ADD COLUMN IF NOT EXISTS demand_flow_version integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qualification_status text,
  ADD COLUMN IF NOT EXISTS qualification_owner_id varchar(64) REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS qualification_contacted_at timestamptz,
  ADD COLUMN IF NOT EXISTS qualification_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS qualification_decided_by varchar(64) REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS qualification_note text,
  ADD COLUMN IF NOT EXISTS entry_selected_at timestamptz,
  ADD COLUMN IF NOT EXISTS entry_selected_by varchar(64) REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS handover_from_user_id varchar(64) REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS handover_to_user_id varchar(64) REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS handover_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS handover_note text;
-- Existing rows remain version 0 with NULL evidence. Defaults affect only future inserts.
ALTER TABLE public.parent_enrollments ALTER COLUMN demand_flow_version SET DEFAULT 1;
ALTER TABLE public.parent_enrollments ALTER COLUMN qualification_status SET DEFAULT 'pending';

CREATE OR REPLACE FUNCTION public.guard_demand_enrollment() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE entry_type text;
BEGIN
  -- Existing tables use server auth. Client roles may not write these internal stations directly.
  IF current_user IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'Demand enrollment writes require the server';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.demand_flow_version IS DISTINCT FROM OLD.demand_flow_version THEN
    RAISE EXCEPTION 'Demand flow version cannot be changed';
  END IF;
  IF TG_OP = 'INSERT' AND NOT COALESCE(NEW.is_sandbox_account, false) THEN
    IF NEW.demand_flow_version <> 1 OR NEW.qualification_status IS DISTINCT FROM 'pending'
       OR NEW.qualification_completed_at IS NOT NULL OR NEW.entry_selected_at IS NOT NULL
       OR NEW.handover_completed_at IS NOT NULL THEN
      RAISE EXCEPTION 'New applications must enter qualification pending';
    END IF;
    UPDATE public.parents SET onboarding_type = 'pending' WHERE user_id = NEW.user_id::text;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.is_sandbox_account IS DISTINCT FROM OLD.is_sandbox_account THEN
    RAISE EXCEPTION 'A demand application cannot become a Sandbox exemption';
  END IF;
  IF NEW.demand_flow_version = 0 OR COALESCE(NEW.is_sandbox_account, false) THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.qualification_completed_at IS NOT NULL AND
      (NEW.qualification_status, NEW.qualification_owner_id, NEW.qualification_completed_at, NEW.qualification_decided_by, NEW.qualification_note)
      IS DISTINCT FROM (OLD.qualification_status, OLD.qualification_owner_id, OLD.qualification_completed_at, OLD.qualification_decided_by, OLD.qualification_note) THEN
      RAISE EXCEPTION 'Completed qualification evidence is immutable';
    END IF;
    IF OLD.entry_selected_at IS NOT NULL AND (NEW.entry_selected_at,NEW.entry_selected_by) IS DISTINCT FROM (OLD.entry_selected_at,OLD.entry_selected_by) THEN
      RAISE EXCEPTION 'Entry decision evidence is immutable';
    END IF;
    IF OLD.handover_completed_at IS NOT NULL AND
      (NEW.handover_completed_at,NEW.handover_from_user_id,NEW.handover_to_user_id,NEW.handover_note)
      IS DISTINCT FROM (OLD.handover_completed_at,OLD.handover_from_user_id,OLD.handover_to_user_id,OLD.handover_note) THEN
      RAISE EXCEPTION 'Completed handover evidence is immutable';
    END IF;
  END IF;
  IF NEW.qualification_status IS NULL OR NEW.qualification_status NOT IN ('pending','contact_required','contacted','follow_up','qualified','not_qualified') THEN
    RAISE EXCEPTION 'Invalid qualification status';
  END IF;
  IF NEW.qualification_status IN ('qualified','not_qualified') AND
    (NEW.qualification_owner_id IS NULL OR NEW.qualification_completed_at IS NULL OR NEW.qualification_decided_by IS NULL OR NULLIF(trim(NEW.qualification_note),'') IS NULL) THEN
    RAISE EXCEPTION 'Qualification decision requires owner, decision maker, timestamp and note';
  END IF;
  IF NEW.entry_selected_at IS NOT NULL AND (NEW.qualification_status <> 'qualified' OR NEW.entry_selected_by IS NULL) THEN
    RAISE EXCEPTION 'Entry selection requires completed qualification';
  END IF;
  IF NEW.handover_completed_at IS NOT NULL AND
    (NEW.qualification_status <> 'qualified' OR NEW.entry_selected_at IS NULL OR NEW.handover_from_user_id IS NULL
     OR NEW.handover_to_user_id IS NULL OR NEW.handover_from_user_id = NEW.handover_to_user_id
     OR NEW.handover_completed_at < NEW.qualification_completed_at OR NULLIF(trim(NEW.handover_note),'') IS NULL) THEN
    RAISE EXCEPTION 'Handover requires qualified entry, distinct sender and recipient, timestamp and next action';
  END IF;
  -- Applies to every assignment/progression writer, including future routes and direct SQL.
  IF NEW.assigned_tutor_id IS NOT NULL OR NEW.status NOT IN ('not_enrolled','awaiting_assignment') THEN
    SELECT onboarding_type INTO entry_type FROM public.parents WHERE user_id = NEW.user_id::text;
    IF NEW.qualification_status <> 'qualified' OR NEW.entry_selected_at IS NULL OR NEW.handover_completed_at IS NULL
       OR entry_type IS NULL OR entry_type NOT IN ('pilot','commercial') THEN
      RAISE EXCEPTION 'Qualification, entry selection and completed handover are required before assignment or service';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_demand_enrollment ON public.parent_enrollments;
CREATE TRIGGER guard_demand_enrollment BEFORE INSERT OR UPDATE ON public.parent_enrollments
FOR EACH ROW EXECUTE FUNCTION public.guard_demand_enrollment();

-- This is an internal, atomic command: enrollment lock serializes concurrent decisions.
CREATE OR REPLACE FUNCTION public.update_demand_production(
  p_enrollment_id text, p_actor_id text, p_action text, p_status text DEFAULT NULL,
  p_owner_id text DEFAULT NULL, p_entry_type text DEFAULT NULL, p_note text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE e public.parent_enrollments%ROWTYPE; current_entry text; at_time timestamptz := clock_timestamp();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_actor_id AND role::text IN ('coo','hr','ceo')) THEN
    RAISE EXCEPTION 'Demand decisions require an authorized staff actor';
  END IF;
  SELECT * INTO e FROM public.parent_enrollments WHERE id::text = p_enrollment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Enrollment not found'; END IF;
  IF e.demand_flow_version <> 1 OR COALESCE(e.is_sandbox_account, false) THEN
    RAISE EXCEPTION 'Historical or Sandbox enrollment: no retrospective qualification evidence may be created';
  END IF;
  IF e.handover_completed_at IS NOT NULL THEN RAISE EXCEPTION 'Handover is already completed'; END IF;
  IF length(COALESCE(p_note,'')) > 2000 THEN RAISE EXCEPTION 'Decision note is too long'; END IF;
  IF p_owner_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.users WHERE id = p_owner_id AND role::text IN ('coo','hr','ceo','td')
  ) THEN RAISE EXCEPTION 'Choose an existing staff owner or recipient'; END IF;

  IF p_action = 'qualification' THEN
    IF e.qualification_completed_at IS NOT NULL THEN RAISE EXCEPTION 'Qualification decision is already completed'; END IF;
    IF p_status IS NULL OR p_status NOT IN ('pending','contact_required','contacted','follow_up','qualified','not_qualified') THEN
      RAISE EXCEPTION 'Invalid qualification status';
    END IF;
    e.qualification_status := p_status;
    e.qualification_owner_id := COALESCE(p_owner_id, e.qualification_owner_id);
    IF p_note IS NOT NULL THEN e.qualification_note := NULLIF(trim(p_note),''); END IF;
    IF p_status = 'contacted' THEN e.qualification_contacted_at := COALESCE(e.qualification_contacted_at, at_time); END IF;
    IF p_status IN ('qualified','not_qualified') THEN
      e.qualification_completed_at := at_time;
      e.qualification_decided_by := p_actor_id;
      -- Require a fresh decision note, not a stale contact note.
      e.qualification_note := NULLIF(trim(p_note),'');
    END IF;
  ELSIF p_action = 'entry' THEN
    IF e.qualification_status <> 'qualified' OR e.qualification_completed_at IS NULL THEN RAISE EXCEPTION 'Qualify the application before choosing entry type'; END IF;
    IF p_entry_type IS NULL OR p_entry_type NOT IN ('pilot','commercial') THEN RAISE EXCEPTION 'Choose Pilot or Commercial'; END IF;
    IF e.entry_selected_at IS NOT NULL THEN RAISE EXCEPTION 'Entry type has already been selected'; END IF;
    e.entry_selected_at := at_time;
    e.entry_selected_by := p_actor_id;
  ELSIF p_action = 'handover' THEN
    IF e.qualification_status <> 'qualified' OR e.entry_selected_at IS NULL THEN RAISE EXCEPTION 'Qualified entry must be selected before handover'; END IF;
    IF p_owner_id IS NULL OR p_owner_id = p_actor_id OR NULLIF(trim(p_note),'') IS NULL THEN
      RAISE EXCEPTION 'Confirm a distinct receiving owner and the agreed next action';
    END IF;
    e.handover_from_user_id := p_actor_id;
    e.handover_to_user_id := p_owner_id;
    e.handover_completed_at := at_time;
    e.handover_note := trim(p_note);
  ELSE RAISE EXCEPTION 'Invalid demand action'; END IF;

  UPDATE public.parent_enrollments SET
    qualification_status=e.qualification_status, qualification_owner_id=e.qualification_owner_id,
    qualification_contacted_at=e.qualification_contacted_at, qualification_completed_at=e.qualification_completed_at,
    qualification_decided_by=e.qualification_decided_by, qualification_note=e.qualification_note,
    entry_selected_at=e.entry_selected_at, entry_selected_by=e.entry_selected_by,
    handover_from_user_id=e.handover_from_user_id, handover_to_user_id=e.handover_to_user_id,
    handover_completed_at=e.handover_completed_at, handover_note=e.handover_note,
    current_step=CASE WHEN p_action = 'handover' THEN 'awaiting-assignment' ELSE current_step END,
    updated_at=at_time WHERE id=e.id RETURNING * INTO e;
  IF p_action = 'entry' THEN
    UPDATE public.parents SET onboarding_type=p_entry_type, updated_at=at_time WHERE user_id=e.user_id::text;
    IF NOT FOUND THEN RAISE EXCEPTION 'Parent billing record is missing'; END IF;
    UPDATE public.leads SET onboarding_type=p_entry_type WHERE user_id::text=e.user_id::text;
  END IF;
  RETURN to_jsonb(e);
END $$;
REVOKE ALL ON FUNCTION public.update_demand_production(text,text,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_demand_production(text,text,text,text,text,text,text) TO service_role;

-- First-touch is immutable even if a future caller omits the application-level check.
CREATE OR REPLACE FUNCTION public.guard_first_production_lineage() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF OLD.production_link_code IS NOT NULL AND
    (NEW.production_link_code IS DISTINCT FROM OLD.production_link_code OR NEW.tracking_source IS DISTINCT FROM OLD.tracking_source
     OR NEW.tracking_campaign IS DISTINCT FROM OLD.tracking_campaign) THEN
    RAISE EXCEPTION 'Existing Production Link lineage cannot be reassigned';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_first_production_lineage ON public.users;
CREATE TRIGGER guard_first_production_lineage BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.guard_first_production_lineage();
DROP TRIGGER IF EXISTS guard_first_production_lineage ON public.leads;
CREATE TRIGGER guard_first_production_lineage BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.guard_first_production_lineage();
CREATE OR REPLACE FUNCTION public.guard_demand_entry_type() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE e public.parent_enrollments%ROWTYPE;
BEGIN
  IF NEW.onboarding_type IS DISTINCT FROM OLD.onboarding_type THEN
    IF current_user IN ('anon','authenticated') THEN RAISE EXCEPTION 'Entry decisions require the server'; END IF;
    SELECT * INTO e FROM public.parent_enrollments WHERE user_id::text=NEW.user_id ORDER BY created_at DESC LIMIT 1;
    IF e.demand_flow_version=1 AND NOT COALESCE(e.is_sandbox_account,false) THEN
      IF e.entry_selected_at IS NULL OR e.qualification_status <> 'qualified' THEN RAISE EXCEPTION 'Entry decision requires qualification'; END IF;
      IF e.handover_completed_at IS NOT NULL OR OLD.onboarding_type IN ('pilot','commercial') THEN RAISE EXCEPTION 'Entry type has already been decided'; END IF;
    ELSIF NOT FOUND AND OLD.onboarding_type='pending' AND NEW.onboarding_type<>'pending' THEN
      RAISE EXCEPTION 'Entry decision requires a qualified application';
    END IF;
  END IF;
  IF OLD.affiliate_code IS NOT NULL AND NEW.affiliate_code IS DISTINCT FROM OLD.affiliate_code THEN
    RAISE EXCEPTION 'Original parent source cannot be replaced';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_demand_entry_type ON public.parents;
CREATE TRIGGER guard_demand_entry_type BEFORE UPDATE ON public.parents FOR EACH ROW EXECUTE FUNCTION public.guard_demand_entry_type();

-- Legacy affiliate automation cannot decide Demand Production service terms.
-- Source is lineage only; entry remains pending until explicit qualification and entry selection.
CREATE OR REPLACE FUNCTION public.set_onboarding_type_from_affiliate() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NEW.onboarding_type IS NULL OR NEW.onboarding_type NOT IN ('pending','pilot','commercial') THEN
    NEW.onboarding_type := 'pending';
  END IF;
  RETURN NEW;
END $$;
COMMIT;
