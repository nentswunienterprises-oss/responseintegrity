type EpisodeRun = {
  id: string;
  status: string;
  started_session_number: number;
  created_at: string;
};

/** Retire only the historical empty duplicate left behind a completed episode. */
export function canRetireSupersededEmptySandboxEpisode(row: {
  status: string; started_session_number: number;
  specialist_probe_count: number | null; canonical_probe_count: number | null;
  persisted_turn_count: number; completed_sibling: boolean;
  specialist_complete: boolean; canonical_complete: boolean;
}, currentSessionNumber: number): boolean {
  return row.status === "active" && row.started_session_number > 0 &&
    row.started_session_number < currentSessionNumber &&
    row.specialist_probe_count === 0 && row.canonical_probe_count === 0 &&
    row.persisted_turn_count === 0 && row.completed_sibling === true &&
    row.specialist_complete === false && row.canonical_complete === false;
}

/** A blocked episode requires review; a newer empty run cannot supersede it. */
export function resolveSandboxRediagnosisEpisodeRun<T extends EpisodeRun>(
  rows: readonly T[], sessionNumber: number,
): T | null {
  const current = rows.filter(row => Number(row.started_session_number) === sessionNumber)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id.localeCompare(a.id));
  return current.find(row => row.status === "blocked") ||
    current.find(row => row.status === "active") || null;
}
