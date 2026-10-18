type EpisodeRun = {
  id: string;
  status: string;
  started_session_number: number;
  created_at: string;
};

/** A blocked episode requires review; a newer empty run cannot supersede it. */
export function resolveSandboxRediagnosisEpisodeRun<T extends EpisodeRun>(
  rows: readonly T[], sessionNumber: number,
): T | null {
  const current = rows.filter(row => Number(row.started_session_number) === sessionNumber)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id.localeCompare(a.id));
  return current.find(row => row.status === "blocked") ||
    current.find(row => row.status === "active") || null;
}
