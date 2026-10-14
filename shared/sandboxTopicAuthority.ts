import {
  PHASES,
  type TopicPhase,
  type TopicStability,
} from "./topicConditioningEngine";
import {
  normalizeCapabilityProgressionState,
  type CapabilityProgressionState,
  type ProgressionAuthority,
} from "./capabilityProgressionAuthority";

/**
 * One Sandbox trajectory belongs to the synthetic student. Its active training
 * condition is topic-scoped; selecting another topic must never reuse the
 * preceding topic's phase, stability, or hidden canonical continuity.
 */
export function sandboxTopicKey(value: unknown): string {
  return typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en").slice(0, 200)
    : "";
}

export type SandboxTopicRoute = "normal_training" | "targeted_rediagnosis";

export type SandboxTopicLane = CapabilityProgressionState & {
  route: SandboxTopicRoute;
  targetedRediagnosisPhase: TopicPhase | null;
};

export type SandboxCanonicalTopicLane = SandboxTopicLane & {
  previousTrajectoryClass: string | null;
  continuityTags: string[];
  recentOutcomeKeys: string[];
  priorTracksDiverged: boolean;
};

function isPhase(value: unknown): value is TopicPhase {
  return typeof value === "string" && PHASES.some(phase => phase === value);
}

function isStability(value: unknown): value is TopicStability {
  return value === "Low" || value === "Medium" ||
    value === "High" || value === "High Maintenance";
}

function isProgression(value: unknown): value is ProgressionAuthority {
  return value === "building" || value === "exit_confirmation_eligible" ||
    value === "transfer_maintenance";
}

export function normalizeSandboxTopicLane(value: unknown): SandboxTopicLane | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  if (!isPhase(source.phase) || !isStability(source.stability)) return null;
  const progression = source.progressionAuthority;
  if (progression != null && !isProgression(progression)) return null;
  const route = source.route == null ? "normal_training" : source.route;
  if (route !== "normal_training" && route !== "targeted_rediagnosis") return null;
  const target = source.targetedRediagnosisPhase;
  if (target != null && !isPhase(target)) return null;
  try {
    return {
      ...normalizeCapabilityProgressionState({
        phase: source.phase,
        stability: source.stability,
        progression: progression ?? null,
      }),
      route,
      targetedRediagnosisPhase: target ?? null,
    };
  } catch {
    return null;
  }
}

export function normalizeSandboxCanonicalLane(value: unknown): SandboxCanonicalTopicLane | null {
  const lane = normalizeSandboxTopicLane(value);
  if (!lane) return null;
  const source = value as Record<string, unknown>;
  const strings = (field: unknown) =>
    Array.isArray(field) && field.every(entry => typeof entry === "string")
      ? field as string[]
      : null;
  const continuityTags = strings(source.continuityTags);
  const recentOutcomeKeys = strings(source.recentOutcomeKeys);
  if (!continuityTags || !recentOutcomeKeys ||
      typeof source.priorTracksDiverged !== "boolean" ||
      (source.previousTrajectoryClass != null && typeof source.previousTrajectoryClass !== "string")) {
    return null;
  }
  return {
    ...lane,
    previousTrajectoryClass: typeof source.previousTrajectoryClass === "string" ? source.previousTrajectoryClass : null,
    continuityTags,
    recentOutcomeKeys,
    priorTracksDiverged: source.priorTracksDiverged,
  };
}

export type SandboxTopicSeed = {
  topicKey: string;
  topic: string;
  state: SandboxTopicLane;
};

/**
 * The launch URL is a routing hint, not authority. A previously observed
 * synthetic-student topic entry is required to seed a new topic condition.
 * An unobserved or prerequisite-contradicted topic must take diagnosis first.
 */
export function resolveSandboxTopicSeed(
  conceptMastery: unknown,
  requestedTopic: unknown,
): SandboxTopicSeed | null {
  const topicKey = sandboxTopicKey(requestedTopic);
  if (!topicKey || !conceptMastery || typeof conceptMastery !== "object") return null;
  const master = conceptMastery as Record<string, any>;
  const topics = master.topicConditioning?.topics;
  if (!topics || typeof topics !== "object" || Array.isArray(topics)) return null;
  const entry = Object.entries(topics).find(([name, value]) =>
    sandboxTopicKey(value && typeof value === "object" ? (value as any).topic || name : name) === topicKey,
  );
  if (!entry || !entry[1] || typeof entry[1] !== "object") return null;
  const value = entry[1] as Record<string, any>;
  if (value.requiresTargetedRediagnosis === true) return null;
  if (!Array.isArray(value.history) || !value.history.some(item =>
    item && typeof item === "object" && isPhase(item.phase) &&
    isStability(item.stability) && typeof item.date === "string"
  )) return null;
  const state = normalizeSandboxTopicLane({
    phase: value.phase,
    stability: value.stability,
    progressionAuthority: value.progressionAuthority,
    route: "normal_training",
    targetedRediagnosisPhase: null,
  });
  return state ? { topicKey, topic: String(value.topic || entry[0]).trim(), state } : null;
}

export function persistedTopicLane(
  map: unknown,
  topicKey: string,
  canonical: false,
): SandboxTopicLane | null;
export function persistedTopicLane(
  map: unknown,
  topicKey: string,
  canonical: true,
): SandboxCanonicalTopicLane | null;
export function persistedTopicLane(
  map: unknown,
  topicKey: string,
  canonical: boolean,
): SandboxTopicLane | SandboxCanonicalTopicLane | null {
  if (!map || typeof map !== "object" || Array.isArray(map)) return null;
  const raw = (map as Record<string, unknown>)[topicKey];
  if (raw == null) return null;
  return canonical ? normalizeSandboxCanonicalLane(raw) : normalizeSandboxTopicLane(raw);
}
