import { normalizeProductionLinkCode, resolveDurableProductionLink, validateProductionLinkForRole } from "../shared/productionLinks";
import { pool } from "./db";

// Shared by password signup, OAuth and Gateway. Identity and source never decide service terms.
export async function captureDemandParent(client: any, storage: any, input: {
  userId: string; fullName: string; email?: string; code?: unknown; source?: string | null; campaign?: string | null;
}) {
  const accountResult = await pool.query(
    `SELECT production_link_code, tracking_source, tracking_campaign
       FROM public.users
      WHERE id = $1
      LIMIT 1`,
    [input.userId],
  );
  const account = accountResult.rows[0];
  if (!account) throw new Error("User account not found");
  const firstLead = await storage.getFirstProductionLeadByUser(input.userId);
  const incoming = normalizeProductionLinkCode(input.code);
  const code = resolveDurableProductionLink(account.production_link_code, firstLead?.production_link_code, incoming);
  let link: any = null;
  if (code) {
    link = await storage.getAffiliateByCode(code);
    // Previously captured attribution survives revocation. New claims must be valid Demand links.
    if (!account.production_link_code && !firstLead?.production_link_code) {
      const invalid = validateProductionLinkForRole(link, "demand", "parent");
      if (invalid) throw new Error(invalid);
      if (link.ownership_status === "unresolved_legacy") throw new Error("Production Link ownership is unresolved");
    }
    await storage.claimUserProductionAttribution(input.userId, code,
      account.tracking_source || firstLead?.tracking_source || input.source || null,
      account.tracking_campaign || firstLead?.tracking_campaign || input.campaign || null);
  }
  await pool.query(
    `INSERT INTO public.parents
      (user_id, full_name, onboarding_type, affiliate_code, affiliate_type)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id) DO NOTHING`,
    [input.userId, input.fullName, "pending", code, link?.affiliate_type || null],
  );
  // Fill a missing parent source only; no later request can replace it.
  if (code) {
    await pool.query(
      `UPDATE public.parents
          SET affiliate_code = $2,
              affiliate_type = $3
        WHERE user_id = $1
          AND affiliate_code IS NULL`,
      [input.userId, code, link?.affiliate_type || null],
    );
  }
  if (firstLead) return { code, lead: firstLead };
  let encounterId: string | undefined;
  if (link?.owner_user_id && input.email) {
    const { data: encounter, error: encounterError } = await client.from("encounters").select("id")
      .eq("affiliate_id", link.owner_user_id).eq("parent_email", input.email).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (encounterError) throw new Error(encounterError.message);
    encounterId = encounter?.id;
  }
  const lead = await storage.createLead(link?.owner_user_id || null, input.userId, encounterId, {
    leadType: "parent", fullName: input.fullName, productionLinkCode: code,
    trackingSource: account.tracking_source || input.source || (code ? "production" : "organic"), trackingCampaign: account.tracking_campaign || input.campaign || null,
    affiliateType: link?.affiliate_type, affiliateName: link?.affiliate_name,
  });
  if (!lead || (code && lead.production_link_code !== code)) throw new Error("Failed to persist Demand Production lineage");
  return { code, lead };
}
