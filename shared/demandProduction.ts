export const QUALIFICATION_STATUSES = ["pending", "contact_required", "contacted", "follow_up", "qualified", "not_qualified"] as const;
export type QualificationStatus = typeof QUALIFICATION_STATUSES[number];
export type EntryType = "pending" | "pilot" | "commercial";

export function demandAssignmentBlock(enrollment: any): string | null {
  if (!enrollment) return "Enrollment not found";
  if (enrollment.demand_flow_version === 0 || enrollment.is_sandbox_account === true) return null;
  if (enrollment.demand_flow_version !== 1) return "Demand Production evidence is unavailable";
  if (enrollment.qualification_status !== "qualified" || !enrollment.qualification_completed_at || !enrollment.qualification_decided_by) {
    return "Qualification must be completed before assignment";
  }
  if (!enrollment.entry_selected_at || !enrollment.entry_selected_by) return "Select Pilot or Commercial before assignment";
  if (!enrollment.handover_completed_at || !enrollment.handover_from_user_id || !enrollment.handover_to_user_id) {
    return "Complete the transfer of responsibility before assignment";
  }
  return null;
}

export function handoverSla(enrollment: any, now = new Date()) {
  if (enrollment?.qualification_status !== "qualified" || !enrollment.qualification_completed_at) return { status: "not_measurable", hours: null };
  const start = Date.parse(enrollment.qualification_completed_at);
  const end = enrollment.handover_completed_at ? Date.parse(enrollment.handover_completed_at) : now.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return { status: "not_measurable", hours: null };
  const hours = (end - start) / 3_600_000;
  return { status: hours > 24 ? "breached" : enrollment.handover_completed_at ? "within_standard" : "pending", hours };
}

export function resolveEntryType(parent: any): EntryType | null {
  const value = parent?.onboarding_type;
  return value === "pilot" || value === "commercial" || value === "pending" ? value : null;
}

export const PARENT_QUALIFICATION_SECTIONS = [
  "parentExperience",
  "supportPreferences",
  "riExplanation",
  "commercialReadiness",
] as const;
export type ParentQualificationSection = typeof PARENT_QUALIFICATION_SECTIONS[number];

export const PARENT_EXPERIENCE_QUESTIONS = [
  "Tell me about your child and how math has been going recently.",
  "What's the most recent time you saw them really struggle with maths? What actually happened?",
  "When they get stuck, what do they do? How do they respond or react?",
  "What about that concerns or frustrates you the most?",
  "What have you tried to address the problem? Tutor, extra classes, helping at home, school support, online resources, or anything else?",
  "What made you decide to try those things? What did you expect them to change? If you stopped, why?",
  "If you could see that this problem was genuinely improving, what would be different about your child?",
  "Why does that matter to you?",
] as const;

export const SUPPORT_PREFERENCE_QUESTIONS = [
  "If someone new was going to help your child with mathematics, what would you want them to understand about your child before they start working together?",
  "Do you know what happens when your child comes across a question that looks different from the examples they have practiced, even if it involves something they have learned before?",
  "How does your child usually react when they make a mistake, especially when somebody else notices it?",
  "Have you noticed any differences in how your child approaches mathematics when they are working alone, with one adult, or around other learners? What seems to change?",
  "What happens when someone sits with your child and watches closely while they are working? Does it help, make them uncomfortable, or depend on the situation?",
  "What differences, if any, have you noticed between how your child works during ordinary practice and how they work in a timed environment, test, or examination?",
  "What kind of practice routine do you believe your child could maintain consistently, even during busy school weeks or holidays? What might make that difficult?",
  "If someone was working with your child regularly, how would you want them to decide what to focus on in each session? For example, what they are busy with in class currently, or what your child hasn't mastered properly, even if it's not something the class is actively working on at the moment, or what they will be writing about in exams ahead of what the class has started with?",
  "What kind of learning environment do you think suits your child best for additional support? For example, working individually, one-on-one, or in a group, online, or in person. What makes those options suitable or unsuitable?",
  "If your child received additional support for a month, what would you need to see or hear to feel confident that it was genuinely helping?",
  "Imagine your child's marks improved, but they still needed considerable help to start and complete unfamiliar questions on their own. Would you consider that successful support? What if they become more independent, but their marks improved more slowly?",
] as const;

export const RI_EXPLANATION_SCRIPT = `Thank you for sharing your experience with me. I'd like to explain what Response Integrity actually does, so you can decide whether it's something that would be relevant to your child's situation. Response Integrity is an online one-on-one mathematics response training program. We're a little different from traditional tutoring. In traditional tutoring, the focus is generally on helping a learner understand mathematical topics, complete exercises, and improve their academic performance. At Response Integrity, we also care about understanding mathematics, but we focus particularly on something else: how the learner responds when they have to work independently, encounter unfamiliar questions, make mistakes, or experience pressure. For example, a child might understand everything while the teacher is explaining, but struggle when they are expected to work through a question alone. Another child might understand the method but rush through calculations, skip important steps, or become frustrated when something does not work. Sometimes the underlying problem is simply missing mathematical knowledge. That's why we don't assume that every child needs the same intervention. Our approach begins with understanding the learner's actual difficulties through Diagnosis. Rather than relying only on their marks or what parents tell us, we observe how they work through mathematics and how they respond under different conditions in actual sessions. From there, our training follows a structured progression. We work on helping learners approach questions clearly, follow a reliable process, and eventually maintain that process when questions become unfamiliar or time pressure increases. The idea is to introduce difficulty progressively rather than expecting a learner to perform well under examination pressure without enough preparation.`;

export interface ParentQualificationEvidence {
  parentAccount?: string;
  evidence?: string;
  interviewerObservation?: string;
  followUp?: string;
  responses?: Record<string, string>;
  scriptPresented?: boolean;
}
export type ParentQualificationAssessment = Partial<Record<ParentQualificationSection, ParentQualificationEvidence>>;
