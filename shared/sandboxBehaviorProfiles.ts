import type { TopicPhase } from "./topicConditioningEngine";
import type { SandboxTrajectoryClass } from "./sandboxEnvironment";

export type SandboxBehaviorProfileId =
  | "clarity_fragile"
  | "reassurance_seeker"
  | "pressure_fragile"
  | "fast_recovery"
  | "uneven_performer"
  | "quietly_strong";

type DecisionTrajectoryClass = Exclude<
  SandboxTrajectoryClass,
  "not_observed" | "confounded"
>;

type SandboxBehaviorProfile = {
  id: SandboxBehaviorProfileId;
  phaseMultipliers: Partial<
    Record<TopicPhase, Partial<Record<DecisionTrajectoryClass, number>>>
  >;
  globalMultipliers?: Partial<Record<DecisionTrajectoryClass, number>>;
};

// V1 identity order is historical authority: never reorder or insert into it.
// The persisted trajectory seed must continue resolving to the same identity.
export const SANDBOX_BEHAVIOR_PROFILE_MODEL_VERSION = 1 as const;
export const SANDBOX_BEHAVIOR_PROFILE_IDS_V1: readonly SandboxBehaviorProfileId[] = [
  "clarity_fragile",
  "reassurance_seeker",
  "pressure_fragile",
  "fast_recovery",
  "uneven_performer",
  "quietly_strong",
];

const PROFILES: SandboxBehaviorProfile[] = [
  {
    id: "clarity_fragile",
    phaseMultipliers: {
      Clarity: {
        supported: 0.72,
        near_stable: 1.05,
        conditional: 1.65,
        breakdown: 1.35,
      },
      "Structured Execution": {
        supported: 1.25,
        near_stable: 1.2,
        conditional: 0.9,
        breakdown: 0.72,
      },
      "Controlled Discomfort": {
        supported: 1.15,
        near_stable: 1.1,
        conditional: 0.95,
        breakdown: 0.82,
      },
    },
  },
  {
    id: "reassurance_seeker",
    phaseMultipliers: {
      "Structured Execution": {
        supported: 0.78,
        near_stable: 1.12,
        conditional: 1.6,
        breakdown: 1.25,
      },
      "Controlled Discomfort": {
        supported: 0.76,
        near_stable: 1.1,
        conditional: 1.65,
        breakdown: 1.3,
      },
    },
  },
  {
    id: "pressure_fragile",
    phaseMultipliers: {
      Clarity: {
        supported: 1.2,
        near_stable: 1.08,
        conditional: 0.85,
        breakdown: 0.7,
      },
      "Structured Execution": {
        supported: 1.18,
        near_stable: 1.08,
        conditional: 0.88,
        breakdown: 0.72,
      },
      "Time Pressure Stability": {
        supported: 0.62,
        near_stable: 0.95,
        conditional: 1.72,
        breakdown: 1.55,
      },
    },
  },
  {
    id: "fast_recovery",
    globalMultipliers: {
      supported: 1.25,
      near_stable: 1.5,
      conditional: 0.92,
      breakdown: 0.68,
    },
    phaseMultipliers: {},
  },
  {
    id: "uneven_performer",
    globalMultipliers: {
      supported: 0.9,
      near_stable: 1.28,
      conditional: 1.42,
      breakdown: 1.05,
    },
    phaseMultipliers: {},
  },
  {
    id: "quietly_strong",
    globalMultipliers: {
      supported: 1.65,
      near_stable: 1.3,
      conditional: 0.72,
      breakdown: 0.52,
    },
    phaseMultipliers: {},
  },
];

const stableIndex = (seed: string, modulo: number) => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % modulo;
};

export function resolveSandboxBehaviorProfile(
  seed: string,
): SandboxBehaviorProfileId {
  return SANDBOX_BEHAVIOR_PROFILE_IDS_V1[
    stableIndex(String(seed || "sandbox-student"), SANDBOX_BEHAVIOR_PROFILE_IDS_V1.length)
  ];
}

/**
 * New trajectories fill profiles that the Specialist has not yet encountered
 * before repeating one. Persisted seeds remain authoritative and are never
 * rewritten; the suffix only affects a trajectory at first creation.
 */
export function selectSandboxBehaviorProfileSeed(input: {
  baseSeed: string;
  existingSeeds: readonly string[];
  /** Server-owned unmet ledger profiles for a newly issued development plan. */
  preferredProfiles?: readonly SandboxBehaviorProfileId[];
}): string {
  const occupied = new Set(input.existingSeeds.map(resolveSandboxBehaviorProfile));
  const preferred = input.preferredProfiles?.length ? new Set(input.preferredProfiles) : null;
  if (!preferred && occupied.size >= SANDBOX_BEHAVIOR_PROFILE_IDS_V1.length) return input.baseSeed;

  for (let nonce = 0; nonce < 10_000; nonce += 1) {
    const candidate = nonce === 0 ? input.baseSeed : `${input.baseSeed}:${nonce}`;
    const profile = resolveSandboxBehaviorProfile(candidate);
    if (preferred ? preferred.has(profile) : !occupied.has(profile)) return candidate;
  }
  throw new Error("Unable to allocate an unrepresented Sandbox behavior profile.");
}

export function sandboxBehaviorProfileMultiplier(input: {
  seed: string;
  phase: TopicPhase;
  trajectoryClass: SandboxTrajectoryClass;
}) {
  if (
    input.trajectoryClass === "not_observed" ||
    input.trajectoryClass === "confounded"
  ) {
    return 1;
  }

  const profile =
    PROFILES.find(
      (candidate) => candidate.id === resolveSandboxBehaviorProfile(input.seed),
    ) || PROFILES[0];
  const globalMultiplier =
    profile.globalMultipliers?.[input.trajectoryClass] ?? 1;
  const phaseMultiplier =
    profile.phaseMultipliers[input.phase]?.[input.trajectoryClass] ?? 1;

  return globalMultiplier * phaseMultiplier;
}

/**
 * Longitudinal simulation is a behavioural rule, not a new capability level.
 * It cannot override topic placement or manufacture a clean observation.
 */
export type SandboxBehaviorContinuityContext = {
  seed: string;
  phase: TopicPhase;
  trajectoryClass: SandboxTrajectoryClass;
  previousTrajectoryClass?: SandboxTrajectoryClass | null;
  continuityTags?: readonly string[];
  outcomeKey?: string;
};

const isEvidenceBoundary = (value?: SandboxTrajectoryClass | null) =>
  value === "not_observed" || value === "confounded";

/**
 * One clean rep cannot erase a directly preceding breakdown. A later clean
 * rep is possible after an observed intermediate response. Evidence gaps are
 * not an intermediate recovery when a breakdown remains unresolved.
 */
export function isSandboxBehaviorTransitionPlausible(
  input: Pick<SandboxBehaviorContinuityContext,
    "trajectoryClass" | "previousTrajectoryClass" | "continuityTags">,
): boolean {
  if (input.trajectoryClass !== "supported") return true;
  if (input.previousTrajectoryClass === "breakdown") return false;
  if (
    isEvidenceBoundary(input.previousTrajectoryClass) &&
    (input.continuityTags || []).includes("recent_breakdown")
  ) return false;
  return true;
}

// Audited V1 scene numbers describe actual visible conduct in the legacy
// bank's natural vignettes. These do not introduce new student-facing facts.
// Unrecognised/new bank keys have no implicit profile-specific cue.
const OBSERVABLE_SCENE_SIGNATURES_V1: Partial<
  Record<SandboxBehaviorProfileId, Partial<Record<TopicPhase, readonly number[]>>>
> = {
  clarity_fragile: { Clarity: [3, 4, 5, 6] },
  reassurance_seeker: {
    "Structured Execution": [3, 4, 5, 6],
    "Controlled Discomfort": [3, 5, 6],
  },
  pressure_fragile: {
    "Time Pressure Stability": [3, 4, 5, 6],
  },
  quietly_strong: {
    Clarity: [1, 2],
    "Structured Execution": [1, 2],
    "Controlled Discomfort": [1, 2],
    "Time Pressure Stability": [1, 2],
  },
};

export function sandboxBehaviorObservableSignatureMultiplier(
  input: SandboxBehaviorContinuityContext,
): number {
  if (isEvidenceBoundary(input.trajectoryClass)) return 1;
  const match = String(input.outcomeKey || "").match(/\.pattern_(\d+)$/);
  if (!match) return 1;
  const profile = resolveSandboxBehaviorProfile(input.seed);
  const patternNumber = Number(match[1]);
  if (profile === "fast_recovery") {
    return input.previousTrajectoryClass === "breakdown" && patternNumber === 2
      ? 2.1 : 1;
  }
  const preferred = OBSERVABLE_SCENE_SIGNATURES_V1[profile]?.[input.phase] || [];
  return preferred.includes(patternNumber) ? 1.6 : 1;
}

/**
 * Deterministic preference for plausible *transitions* rather than independent
 * random snapshots. This biases but does not force outcomes, and cannot
 * influence not-observed or confounded evidence probabilities.
 */
export function sandboxBehaviorTransitionMultiplier(
  input: SandboxBehaviorContinuityContext,
): number {
  if (isEvidenceBoundary(input.trajectoryClass)) return 1;
  const previous = input.previousTrajectoryClass;
  const next = input.trajectoryClass;
  const profile = resolveSandboxBehaviorProfile(input.seed);
  let transition = 1;

  if (previous === "breakdown") {
    transition = next === "near_stable" ? 1.7
      : next === "conditional" ? 1.4
      : next === "breakdown" ? 0.95 : 1;
    if (profile === "fast_recovery") {
      transition *= next === "near_stable" ? 2.0
        : next === "conditional" ? 1.3 : 0.75;
    }
  } else if (previous === "conditional" || previous === "near_stable") {
    transition = next === "supported" ? 1.45
      : next === "near_stable" ? 1.25
      : next === "conditional" ? 1.0 : 0.85;
    if (profile === "fast_recovery" && next === "supported") {
      transition *= 1.8;
    }
    if (profile === "uneven_performer" && next === "near_stable") {
      transition *= 1.5;
    }
  } else if (previous === "supported") {
    transition = next === "supported" ? 1.4
      : next === "near_stable" ? 1.15
      : next === "conditional" ? 0.85 : 0.75;
    if (profile === "uneven_performer") {
      transition *= next === "conditional" ? 2.3
        : next === "near_stable" ? 1.6
        : next === "supported" ? 0.75 : 1;
    }
  }

  return transition * sandboxBehaviorObservableSignatureMultiplier(input);
}
