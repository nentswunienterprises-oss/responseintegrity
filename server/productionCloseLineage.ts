export type ProductionCloseLineage = {
  affiliateId: string | null;
  productionLinkCode: string | null;
  ownerType: string | null;
  ownerName: string | null;
  rewardEligible: boolean;
};

export function resolveProductionCloseLineage(
  lead: { affiliate_id?: string | null; production_link_code?: string | null },
  link?: { owner_user_id?: string | null; owner_type?: string | null; owner_name?: string | null } | null,
): ProductionCloseLineage {
  const productionLinkCode = lead.production_link_code || null;
  const ownerType = link?.owner_type || null;
  const ownerName = link?.owner_name || null;
  return {
    affiliateId: lead.affiliate_id || null,
    productionLinkCode,
    ownerType,
    ownerName,
    rewardEligible: Boolean(productionLinkCode && lead.affiliate_id && link?.owner_user_id),
  };
}
