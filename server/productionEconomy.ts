import { demandAssignmentBlock, handoverSla, resolveEntryType } from "../shared/demandProduction";
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
  parents?: any[];
  payments?: any[];
  proposals?: any[];
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

function demandEvidence(enrollment: any, parent: any, payments: any[] | undefined, proposals: any[] | undefined) {
  const entryType = resolveEntryType(parent);
  const proposal = proposals?.find((row) => row.id === enrollment?.proposal_id && row.enrollment_id === enrollment?.id);
  const unlocked = !!enrollment && ["session_booked", "confirmed"].includes(enrollment.status)
    && (enrollment.demand_flow_version === 0 || demandAssignmentBlock(enrollment) === null);
  const accepted = !!proposal?.accepted_at && !!proposal?.student_id && !!proposal?.tutor_id;
  const paid = payments?.some((payment) => payment.enrollment_id === enrollment?.id && payment.parent_id === enrollment?.user_id
    && payment.proposal_id === enrollment?.proposal_id && payment.provider === "payfast" && payment.payment_status === "paid"
    && !!payment.paid_at && Number(payment.amount) > 0);
  const verifiedCommercial = payments === undefined || proposals === undefined || !parent ? null
    : entryType === "commercial" && unlocked && accepted && !!paid;
  const verifiedPilot = proposals === undefined || !parent ? null : entryType === "pilot" && unlocked && accepted;
  return {
    qualificationPending: enrollment?.demand_flow_version === 1 && ["pending", "contact_required", "contacted", "follow_up"].includes(enrollment.qualification_status),
    contacted: !!enrollment?.qualification_contacted_at,
    qualified: enrollment?.qualification_status === "qualified" && !!enrollment?.qualification_completed_at && !!enrollment?.qualification_decided_by,
    notQualified: enrollment?.qualification_status === "not_qualified" && !!enrollment?.qualification_completed_at && !!enrollment?.qualification_decided_by,
    handoverCompleted: !!enrollment?.handover_completed_at && !!enrollment?.handover_from_user_id && !!enrollment?.handover_to_user_id,
    pilotEntry: verifiedPilot,
    commercialEntry: verifiedCommercial,
    verifiedServiceEntry: verifiedPilot === null || verifiedCommercial === null ? null : verifiedPilot || verifiedCommercial,
    verifiedConversions: verifiedCommercial,
  };
}

function demandCounts(rows: any[]) {
  const count = (key: string) => rows.some((row) => row.evidence[key] === null) ? null : rows.filter((row) => row.evidence[key]).length;
  return {
    captured: rows.length,
    qualificationPending: count("qualificationPending"), contacted: count("contacted"), qualified: count("qualified"),
    notQualified: count("notQualified"), handoverCompleted: count("handoverCompleted"),
    pilotEntry: count("pilotEntry"), commercialEntry: count("commercialEntry"), verifiedServiceEntry: count("verifiedServiceEntry"),
    subscribed: count("commercialEntry"), verifiedConversions: count("verifiedConversions"),
    trial: null, rewardEligible: 0,
    historicalQualificationUnknown: rows.filter((row) => row.enrollment?.demand_flow_version === 0).length,
  };
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
  const enrollmentMap = new Map(enrollments.map((enrollment) => [enrollment.user_id || enrollment.parent_id, enrollment]));
  const assignmentMap = new Map(assignments.map((assignment) => [assignment.tutor_id, assignment]));
  const trialMap = new Map(trialCases.map((trial) => [trial.tutor_id, trial]));
  const closeByLead = new Map(closes.filter((close) => close.lead_id != null).map((close) => [String(close.lead_id), close]));
  const productionLinks = links.filter((link) => link.status !== "revoked");

  const parentMap = new Map((input.parents || []).map((parent) => [parent.user_id, parent]));
  // One opportunity per family; prefer the first attributed lead over older organic placeholders.
  const familyLeads = new Map<string, any>();
  for (const lead of [...leads].sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")) || String(a.id).localeCompare(String(b.id)))) {
    const user = userMap.get(lead.user_id);
    if ((user?.role && user.role !== "parent") || (lead.lead_type && lead.lead_type !== "parent")) continue;
    if (enrollmentMap.get(lead.user_id)?.is_sandbox_account) continue;
    const previous = familyLeads.get(lead.user_id || lead.id);
    if (!previous || (!previous.production_link_code && lead.production_link_code)) familyLeads.set(lead.user_id || lead.id, lead);
  }
  // A durable account or application is capture evidence even if historical lead creation failed.
  for (const user of users.filter((row) => row.role === "parent")) {
    if (!familyLeads.has(user.id) && !enrollmentMap.get(user.id)?.is_sandbox_account) {
      familyLeads.set(user.id, { id: `account:${user.id}`, user_id: user.id, full_name: user.name,
        production_link_code: user.production_link_code || null, tracking_source: user.tracking_source || null,
        tracking_campaign: user.tracking_campaign || null, created_at: user.created_at || null });
    }
  }
  const allDemandLineages = [...familyLeads.values()].map((lead) => {
    const link = links.find((candidate) => candidate.code === lead.production_link_code) || null;
    const close = closeByLead.get(String(lead.id)) || null;
    const enrollment = enrollmentMap.get(lead.user_id) || null;
    const evidence = demandEvidence(enrollment, parentMap.get(lead.user_id), input.payments, input.proposals);
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
      parentName: enrollment?.parent_full_name || userMap.get(lead.user_id)?.name || lead.full_name || null,
      enrollment: enrollment || null,
      entryType: resolveEntryType(parentMap.get(lead.user_id)),
      handoverSla: handoverSla(enrollment),
      evidence,
      currentStation: evidence.verifiedConversions ? "commercial_service_entry" : evidence.pilotEntry ? "pilot_service_entry"
        : evidence.handoverCompleted ? "handover_completed" : evidence.qualified ? "qualified"
        : evidence.notQualified ? "not_qualified" : enrollment?.qualification_status || "captured",
      originalSource: lead.tracking_source || null,
      originalCampaign: lead.tracking_campaign || null,
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

  const demandLineages = allDemandLineages.filter((row) => row.code);
  const organicLineages = allDemandLineages.filter((row) => !row.code);

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
    const counts = isDemand ? demandCounts(sourceLeads) : {
      application: sourceApplications.length,
      training: countBy(sourceApplications, "currentStation", "training"),
      sandbox: countBy(sourceApplications, "currentStation", "sandbox"),
      trial: countBy(sourceApplications, "currentStation", "trial"),
      certifiedLive: countBy(sourceApplications, "currentStation", "certified_live"),
      deployment: null,
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
    ? [{ code: "capacity_certified_live_empty", message: "No Certified Live Specialists recorded. Review assignment capacity; Trial placements remain a separate governed lane." }]
    : [];

  return {
    summary: {
      demand: {
        activeLinks: demandLinks.length,
        ...demandCounts(allDemandLineages),
        rewardsTriggered: null,
        rewardsPaid: null,
        organic: organicLineages.length,
        productionAttributed: demandLineages.length,
      },
      capacity: {
        activeLinks: capacityLinks.length,
        applications: capacityLineages.length,
        training: countBy(capacityLineages, "currentStation", "training"),
        sandbox: countBy(capacityLineages, "currentStation", "sandbox"),
        trial: countBy(capacityLineages, "currentStation", "trial"),
        certifiedLive: countBy(capacityLineages, "currentStation", "certified_live"),
        deployed: null,
      },
      blockers,
    },
    sources,
    demandLineages,
    capacityLineages,
    organic: organicLineages,
    staff: users.filter((user) => ["coo", "hr", "ceo", "td"].includes(user.role)).map((user) => ({ id: user.id, name: user.name || user.email, role: user.role })),
    trialPlacementsMeasured: trialPlacements.length,
  };
}