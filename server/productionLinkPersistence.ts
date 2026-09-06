export async function claimProductionLeadIfUnattributed(
  client: any,
  leadId: string,
  affiliateId: string | null,
  productionLinkCode: string,
  trackingSource?: string | null,
  trackingCampaign?: string | null,
) {
  const { data, error } = await client
    .from("leads")
    .update({
      affiliate_id: affiliateId,
      production_link_code: productionLinkCode,
      tracking_source: trackingSource || "affiliate",
      tracking_campaign: trackingCampaign || null,
    })
    .eq("id", leadId)
    .is("production_link_code", null)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data || null;
}
