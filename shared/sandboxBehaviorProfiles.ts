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
  return PROFILES[stableIndex(String(seed || "sandbox-student"), PROFILES.length)].id;
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
