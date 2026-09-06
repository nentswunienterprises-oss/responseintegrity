import { buildCanonicalProductionLinkUrl } from "./productionLinkUrls";

export type ProductionEconomyInput = {
  links: any[];
  leads: any[];
  applications: any[];
  users: any[];
  enrollments: any[];
  assignments: any[];
  trialCases: any[];
  trialPlacements: any[];
  closes: any[];
};

const countBy = (rows: any[], key: string, value: unknown) =>
  rows.filter((row) => row[key] === value).length;

export function isOrganicProductionRow(row: { production_link_code?: string | null }) {
  return !row.production_link_code;
}

function ownerForLink(link: any) {
  return {
    ownerType: link.owner_type || link.type || "source",
    ownerName: link.owner_name || link.person_name || link.entity_name || link.campaign_name || link.code,
    ownerUserId: link.owner_user_id || null,
  };
}

function demandStation(lead: any, enrollment: any, close: any) {
  if (close) return "close";
  if (enrollment?.confirmed_at || enrollment?.status === "confirmed") return "subscription";
  if (enrollment?.status && enrollment.status !== "awaiting_assignment") return "captured";
  return "captured";
}

function capacityStation(application: any, assignment: any, trialCase: any) {
  if (assignment?.operational_mode === "certified_live" && assignment.certification_status === "passed") return "certified_live";
  if (assignment?.operational_mode === "trial" || trialCase) return "trial";
  if (assignment?.operational_mode === "sandbox") return "sandbox";
  if (assignment?.operational_mode === "training" || application.status === "approved") return "training";
  return "application";
}

export function buildProductionEconomy(input: ProductionEconomyInput) {
  const { links, leads, applications, users, enrollments, assignments, trialCases, trialPlacements, closes } = input;
  const userMap = new Map(users.map((user) => [user.id, user]));
  const enrollmentMap = new Map(enrollments.map((enrollment) => [enrollment.parent_id, enrollment]));
  const assignmentMap = new Map(assignments.map((assignment) => [assignment.tutor_id, assignment]));
  const trialMap = new Map(trialCases.map((trial) => [trial.tutor_id, trial]));
  const closeByLead = new Map(closes.filter((close) => close.lead_id != null).map((close) => [String(close.lead_id), close]));
  const productionLinks = links.filter((link) => link.status !== "revoked");

  const demandLineages = leads.filter((lead) => lead.production_link_code).map((lead) => {
    const link = links.find((candidate) => candidate.code === lead.production_link_code) || null;
    const close = closeByLead.get(String(lead.id)) || null;
    const enrollment = enrollmentMap.get(lead.user_id) || null;
    const owner = link ? ownerForLink(link) : {
      ownerType: close?.production_owner_type || "source",
      ownerName: close?.production_owner_name || lead.production_link_code,
      ownerUserId: null,
    };
    return {
      id: String(lead.id),
      code: lead.production_link_code,
      parentId: lead.user_id,
      createdAt: lead.created_at,
      currentStation: demandStation(lead, enrollment, close),
      source: link ? {
        code: link.code,
        link: buildCanonicalProductionLinkUrl(link.code, link.pipeline_type),
        pipeline: link.pipeline_type || "demand",
        ...owner,
        createdBy: link.created_by || null,
        campaignName: link.campaign_name || null,
        createdAt: link.created_at,
      } : null,
      close: close ? {
        id: close.id,
        productionLinkCode: close.production_link_code,
        ownerType: close.production_owner_type,
        ownerName: close.production_owner_name,
        affiliateId: close.affiliate_id || null,
        createdAt: close.created_at,
      } : null,
      reward: { eligible: false, status: "not_measurable" },
    };
  });

  const capacityLineages = applications.filter((application) => application.production_link_code).map((application) => {
    const link = links.find((candidate) => candidate.code === application.production_link_code) || null;
    const user = userMap.get(application.user_id);
    const assignment = assignmentMap.get(application.user_id) || null;
    const trialCase = trialMap.get(application.user_id) || null;
    const owner = link ? ownerForLink(link) : { ownerType: "source", ownerName: application.production_link_code, ownerUserId: null };
    return {
      id: String(application.id),
      code: application.production_link_code,
      specialistId: application.user_id,
      specialistName: user?.name || application.full_name || application.email || null,
      createdAt: application.created_at,
      currentStation: capacityStation(application, assignment, trialCase),
      source: link ? {
        code: link.code,
        link: buildCanonicalProductionLinkUrl(link.code, link.pipeline_type),
        pipeline: link.pipeline_type || "capacity",
        ...owner,
        createdBy: link.created_by || null,
        campaignName: link.campaign_name || null,
        createdAt: link.created_at,
      } : null,
      reward: { eligible: false, status: "not_applicable" },
    };
  });

  const sources = productionLinks.map((link) => {
    const sourceLeads = demandLineages.filter((lineage) => lineage.code === link.code);
    const sourceApplications = capacityLineages.filter((lineage) => lineage.code === link.code);
    const owner = ownerForLink(link);
    const isDemand = (link.pipeline_type || "demand") === "demand";
    const counts = isDemand ? {
      captured: sourceLeads.length,
      qualified: null,
      trial: null,
      subscribed: null,
      verifiedConversions: 0,
      rewardEligible: 0,
    } : {
      application: sourceApplications.length,
      training: countBy(sourceApplications, "currentStation", "training"),
      sandbox: countBy(sourceApplications, "currentStation", "sandbox"),
      trial: countBy(sourceApplications, "currentStation", "trial"),
      certifiedLive: countBy(sourceApplications, "currentStation", "certified_live"),
      deployment: 0,
    };
    return {
      code: link.code,
      link: buildCanonicalProductionLinkUrl(link.code, link.pipeline_type),
      pipeline: link.pipeline_type || "demand",
      status: link.status || "active",
      ...owner,
      createdBy: link.created_by || null,
      campaignName: link.campaign_name || null,
      createdAt: link.created_at,
      opportunitiesProduced: isDemand ? sourceLeads.length : sourceApplications.length,
      counts,
      reward: { eligible: false, status: isDemand ? "not_measurable" : "not_applicable" },
      lineages: isDemand ? sourceLeads : sourceApplications,
    };
  });

  const demandLinks = productionLinks.filter((link) => (link.pipeline_type || "demand") === "demand");
  const capacityLinks = productionLinks.filter((link) => link.pipeline_type === "capacity");
  const certifiedLive = assignments.filter((assignment) => assignment.operational_mode === "certified_live" && assignment.certification_status === "passed").length;
  const blockers = certifiedLive === 0 && demandLineages.length > 0
    ? [{ code: "capacity_certified_live_empty", message: "Demand captured successfully. Conversion is blocked by Capacity: 0 Certified Live Specialists available." }]
    : [];

  return {
    summary: {
      demand: {
        activeLinks: demandLinks.length,
        captured: demandLineages.length,
        qualified: null,
        trial: null,
        subscribed: null,
        verifiedConversions: 0,
        rewardEligible: 0,
        rewardsTriggered: null,
        rewardsPaid: null,
        organic: leads.filter(isOrganicProductionRow).length,
        productionAttributed: demandLineages.length,
      },
      capacity: {
        activeLinks: capacityLinks.length,
        applications: capacityLineages.length,
        training: countBy(capacityLineages, "currentStation", "training"),
        sandbox: countBy(capacityLineages, "currentStation", "sandbox"),
        trial: countBy(capacityLineages, "currentStation", "trial"),
        certifiedLive: countBy(capacityLineages, "currentStation", "certified_live"),
        deployed: 0,
      },
      blockers,
    },
    sources,
    demandLineages,
    capacityLineages,
    organic: leads.filter(isOrganicProductionRow).map((lead) => ({ id: String(lead.id), createdAt: lead.created_at })),
    trialPlacementsMeasured: trialPlacements.length,
  };
}