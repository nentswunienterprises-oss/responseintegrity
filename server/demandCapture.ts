import { normalizeProductionLinkCode, resolveDurableProductionLink, validateProductionLinkForRole } from "../shared/productionLinks";

// Shared by password signup, OAuth and Gateway. Identity and source never decide service terms.
export async function captureDemandParent(client: any, storage: any, input: {
  userId: string; fullName: string; email?: string; code?: unknown; source?: string | null; campaign?: string | null;
}) {
  const { data: account, error } = await client.from("users").select("production_link_code, tracking_source, tracking_campaign").eq("id", input.userId).single();
  if (error) throw new Error(error.message);
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
  const { error: parentError } = await client.from("parents").upsert({
    user_id: input.userId, full_name: input.fullName, onboarding_type: "pending",
    affiliate_code: code, affiliate_type: link?.affiliate_type || null,
  }, { onConflict: "user_id", ignoreDuplicates: true });
  if (parentError) throw new Error(parentError.message);
  // Fill a missing parent source only; no later request can replace it.
  if (code) {
    const { error: sourceError } = await client.from("parents").update({ affiliate_code: code, affiliate_type: link?.affiliate_type || null })
      .eq("user_id", input.userId).is("affiliate_code", null);
    if (sourceError) throw new Error(sourceError.message);
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
