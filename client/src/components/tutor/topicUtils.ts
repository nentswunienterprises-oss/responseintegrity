// Shared topic utilities for StudentCard and StudentTopicConditioningDialog
import { PhaseLabel, StabilityLabel, TopicTrend, TutorSessionRecord, TopicConditioningMap, StudentTopicConditioningDialogProps, parseObservation, normalizePhase, normalizeStability, sanitizeTopic, formatLastUpdatedLabel, trendFromHistory } from "./StudentTopicConditioningDialog";

export function buildTopics(
  parentTopics: string | null | undefined,
  map: TopicConditioningMap | null | undefined,
  persistedTopicStates: StudentTopicConditioningDialogProps["persistedTopicStates"],
  sessions: TutorSessionRecord[] | undefined,
): Array<{
  topic: string;
  phase: PhaseLabel;
  stability: StabilityLabel;
  hasObservedState: boolean;
  lastUpdated: string | null;
  lastSession: string;
  trend: TopicTrend;
  entryDiagnosis: string;
  recentLogs: string[];
  timeline: Array<{ date: string; phase: PhaseLabel; stability: StabilityLabel }>;
}> {
  const byTopic = new Map<
    string,
    {
      history: Array<{ date: string; phase: PhaseLabel; stability: StabilityLabel; note: string }>;
      seeded?: { phase: PhaseLabel; stability: StabilityLabel };
    }
  >();

  const persistedEntries = persistedTopicStates && typeof persistedTopicStates === "object"
    ? Object.entries(persistedTopicStates)
    : [];

  persistedEntries.forEach(([topicKey, entry]: [string, any]) => {
    const persistedTopic = sanitizeTopic(entry?.topic || topicKey || "");
    if (!persistedTopic) return;

    const existing = byTopic.get(persistedTopic) || { history: [] as any[] };
    const mergedHistory = [...(existing.history || [])];

    const persistedHistory = Array.isArray(entry?.history) ? entry.history : [];
    persistedHistory.forEach((h: any) => {
      if (!h?.date) return;
      mergedHistory.push({
        date: String(h.date),
        phase: normalizePhase(h.phase),
        stability: normalizeStability(h.stability),
        note: h?.observationNotes ? `Observation Notes: ${String(h.observationNotes)}` : "",
      });
    });

    byTopic.set(persistedTopic, {
      history: mergedHistory,
      seeded: {
        phase: normalizePhase(entry?.phase || map?.entry_phase),
        stability: normalizeStability(entry?.stability || map?.stability),
      },
    });
  });

  const observations = (sessions || [])
    .map(parseObservation)
    .filter((item): item is NonNullable<ReturnType<typeof parseObservation>> => !!item)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const hasPersistedHistory = persistedEntries.some(
    ([, entry]: [string, any]) => Array.isArray(entry?.history) && entry.history.length > 0,
  );

  observations.forEach((obs) => {
    // Prefer persisted topic history; only parse raw notes as fallback for unseen topics
    if (hasPersistedHistory && byTopic.has(obs.topic)) return;

    if (!byTopic.has(obs.topic)) {
      byTopic.set(obs.topic, { history: [] });
    }
    byTopic.get(obs.topic)?.history.push({
      date: obs.date,
      phase: obs.phase,
      stability: obs.stability,
      note: obs.rawNote,
    });
  });

  const rows: Array<{
    topic: string;
    phase: PhaseLabel;
    stability: StabilityLabel;
    hasObservedState: boolean;
    lastUpdated: string | null;
    lastSession: string;
    trend: TopicTrend;
    entryDiagnosis: string;
    recentLogs: string[];
    timeline: Array<{ date: string; phase: PhaseLabel; stability: StabilityLabel }>;
  }> = [];

  byTopic.forEach((entry, topic) => {
    const history = entry.history;
    const latest = history[history.length - 1];
    const phase = latest?.phase || entry.seeded?.phase || "Structured Execution";
    const stability = latest?.stability || entry.seeded?.stability || "Low";
    const lastSessionDate = latest?.date;

    const recentLogs = history
      .slice(-3)
      .reverse()
      .map((h, index) => {
        const noteLine = h.note
          .split(/\n+/)
          .find((line) => /Observation Notes:/i.test(line))
          ?.replace(/Observation Notes:\s*/i, "")
          .trim();
        return noteLine && noteLine.length > 0
          ? `Session ${index + 1}: ${noteLine}`
          : `Session ${index + 1}: ${h.phase}, ${h.stability} stability observed`;
      });

    rows.push({
      topic,
      phase,
      stability,
      hasObservedState: history.length > 0,
      lastUpdated: lastSessionDate || null,
      lastSession: formatLastUpdatedLabel(lastSessionDate),
      trend: trendFromHistory(
        history.map((h) => h.stability),
        history.map((h) => h.phase),
      ),
      entryDiagnosis:
        history.length > 0
          ? `Entered based on observed response pattern in logged sessions for ${topic.toLowerCase()}.`
          : `Seeded from enrollment/proposal focus for ${topic.toLowerCase()}.`,
      recentLogs,
      timeline: history.map((h) => ({
        date: new Date(h.date).toLocaleDateString("en-US", { day: "2-digit", month: "short" }),
        phase: h.phase,
        stability: h.stability,
      })),
    });
  });

  return rows.sort((a, b) => a.topic.localeCompare(b.topic));
}
