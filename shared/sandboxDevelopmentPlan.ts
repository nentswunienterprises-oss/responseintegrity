import { resolveSandboxBehaviorProfile, sandboxBehaviorObservableSignatureMultiplier, type SandboxBehaviorProfileId } from "./sandboxBehaviorProfiles";
import type { SandboxOutcomeDefinition, SandboxTrajectoryClass } from "./sandboxEnvironment";
import type { TopicPhase } from "./topicConditioningEngine";

// Server-owned opt-in, persisted at trajectory creation. An absent marker is
// historical selection, not permission to upgrade an existing learner.
export const SANDBOX_DEVELOPMENT_PLAN_V1 = "sandbox-development-plan:v1";
const prefix = "sandbox-development-plan:";

export function hasSandboxDevelopmentPlan(tags: readonly string[] = []): boolean {
  const versions = tags.filter(tag => tag.startsWith(prefix));
  if (versions.some(tag => tag !== SANDBOX_DEVELOPMENT_PLAN_V1)) {
    throw new Error("Unsupported Sandbox development plan; preserve the trajectory for review.");
  }
  return versions.includes(SANDBOX_DEVELOPMENT_PLAN_V1);
}

export function sandboxProfileDifficultyPhase(profile: SandboxBehaviorProfileId): TopicPhase | null {
  if (profile === "clarity_fragile") return "Clarity";
  if (profile === "reassurance_seeker") return "Structured Execution";
  if (profile === "pressure_fragile") return "Time Pressure Stability";
  return null;
}

const lessonPrefix = (topic: string, phase: TopicPhase) =>
  `sandbox-development-lessons:${encodeURIComponent(topic.trim().toLowerCase())}:${phase}:`;

export function sandboxDevelopmentLessons(tags: readonly string[], topic: string, phase: TopicPhase): number {
  const values = tags.filter(tag => tag.startsWith(lessonPrefix(topic, phase)) && !tag.endsWith(":disrupted"));
  if (values.length > 1 || (values.length && !/^\d+$/.test(values[0].slice(lessonPrefix(topic, phase).length)))) {
    throw new Error("Invalid Sandbox development history; do not reset learner experience.");
  }
  const count = values.length ? Number(values[0].slice(lessonPrefix(topic, phase).length)) : 0;
  if (!Number.isSafeInteger(count)) throw new Error("Invalid Sandbox development lesson count.");
  return count;
}

/** Experience advances only after a complete lesson with preserved conditions.
 * Observation accuracy is graded separately; it cannot rewrite learner conduct.
 */
export function advanceSandboxDevelopment(input: {
  tags: string[]; topic: string; phase: TopicPhase;
  conditionKept: boolean; lessonCompleted: boolean;
}): string[] {
  if (!hasSandboxDevelopmentPlan(input.tags)) return input.tags;
  if (!input.topic.trim()) throw new Error("Sandbox development requires an owned topic.");
  const count = sandboxDevelopmentLessons(input.tags, input.topic, input.phase);
  const key = lessonPrefix(input.topic, input.phase);
  const disrupted = `${key}disrupted`;
  const tags = new Set(input.tags);
  if (!input.conditionKept) tags.add(disrupted);
  if (input.lessonCompleted) {
    if (!tags.has(disrupted)) {
      for (const tag of tags) if (tag.startsWith(key) && tag !== disrupted) tags.delete(tag);
      tags.add(`${key}${count + 1}`);
    }
    tags.delete(disrupted);
  }
  return [...tags].sort();
}

/** A curriculum for synthetic conduct, never a placement or grading override.
 * Initial difficulty is followed by consolidation and retained strength. Later
 * maintenance checks revisit the weakness without making every rep a relapse.
 */
export function sandboxDevelopmentClass(input: {
  seed: string; phase: TopicPhase; completedLessons: number; repIndex: number;
  previous?: SandboxTrajectoryClass | null;
}): SandboxTrajectoryClass {
  const profile = resolveSandboxBehaviorProfile(input.seed);
  const challengeLesson = input.completedLessons === 0 ||
    (input.completedLessons >= 6 && input.completedLessons % 6 === 0);
  let desired: SandboxTrajectoryClass = "supported";
  if (challengeLesson) {
    if (sandboxProfileDifficultyPhase(profile) === input.phase && input.repIndex < 2) desired = "conditional";
    if (profile === "fast_recovery" && input.repIndex % 3 === 0) desired = "breakdown";
    if (profile === "uneven_performer" && input.repIndex % 3 === 1) desired = "conditional";
  }
  // A visible intermediate must precede support after a breakdown, including
  // one carried over from a previous lesson or an evidence-integrity incident.
  if (desired === "supported" && input.previous === "breakdown") return "near_stable";
  return desired;
}

export function sandboxDevelopmentCandidates(input: {
  seed: string; candidates: SandboxOutcomeDefinition[]; phase: TopicPhase;
  completedLessons: number; repIndex: number; previous?: SandboxTrajectoryClass | null;
}): SandboxOutcomeDefinition[] {
  const desired = sandboxDevelopmentClass(input);
  const candidates = input.candidates.filter(item => item.trajectoryClass === desired);
  if (!candidates.length) {
    throw new Error(`Sandbox development plan has no compatible ${desired} response in ${input.phase}; repair the scenario bank, never bypass evidence authority.`);
  }
  const signature = candidates.filter(item => sandboxBehaviorObservableSignatureMultiplier({
    seed: input.seed, phase: input.phase, trajectoryClass: item.trajectoryClass,
    previousTrajectoryClass: input.previous, outcomeKey: item.key,
  }) > 1);
  return signature.length ? signature : candidates;
}

// Avalanche mixing prevents correlated key prefixes from choosing the response
// class. In V1 of this plan, class is already curriculum-owned; this draw only
// varies eligible scenes within that class. Legacy random streams are untouched.
export function sandboxDevelopmentDraw(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 0x01000193);
  hash ^= hash >>> 16; hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13; hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return ((hash >>> 0) + 0.5) / 0x100000000;
}
