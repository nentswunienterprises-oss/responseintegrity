/**
 * Neutral issue intake. Ownership is system-assigned, never selected by the reporter.
 * Existing HR disputes remain historical records, not the storage for technical faults.
 */
export const ISSUE_CATEGORIES = [
  { value: "technical", label: "Technical / platform", hint: "An error, login problem, broken feature, or missing progress", team: "technology" },
  { value: "workflow", label: "Workflow / process", hint: "A confusing or blocked operating step", team: "operations" },
  { value: "service", label: "Service / delivery", hint: "A problem with an activity, booking, or service", team: "operations" },
  { value: "people", label: "People / communication", hint: "A communication or conduct concern", team: "people" },
  { value: "other", label: "Other", hint: "Something else that needs attention", team: "operations" },
] as const;

export type IssueCategory = (typeof ISSUE_CATEGORIES)[number]["value"];
export type IssueOwnerTeam = (typeof ISSUE_CATEGORIES)[number]["team"];
export type IssueStatus = "open" | "in_progress" | "resolved";
export type IssueImpact = "blocked" | "affected" | "informational";

export const ISSUE_IMPACTS = [
  { value: "blocked", label: "I can't continue" },
  { value: "affected", label: "I can continue, but something isn't working" },
  { value: "informational", label: "Observation or improvement" },
] as const;

export function getIssueTeam(category: IssueCategory): IssueOwnerTeam {
  const item = ISSUE_CATEGORIES.find((item) => item.value === category);
  if (!item) throw new Error("Unsupported issue category");
  return item.team;
}

/**
 * View authority is separate from review/action authority.
 * COO oversees all issues, including sensitive People reports, while the
 * People team retains ownership of personnel-case handling.
 */
export function issueTeamsVisibleToRole(role: string): IssueOwnerTeam[] {
  if (role === "coo") return ["technology", "operations", "people"];
  return issueTeamsForRole(role);
}

/** Teams whose issues the role may move or resolve. */
export function issueTeamsForRole(role: string): IssueOwnerTeam[] {
  switch (role) {
    case "ceo":
      return ["technology", "operations", "people"];
    case "coo":
      return ["technology", "operations"];
    case "cto":
      return ["technology"];
    case "hr":
      return ["people"];
    default:
      return [];
  }
}
