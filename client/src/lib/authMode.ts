import { API_URL } from "./config";

export type AuthMode = {
  emergencyDbMode: boolean;
  authMode: "db-session" | "supabase";
};

let authModePromise: Promise<AuthMode> | undefined;

export function getAuthMode(): Promise<AuthMode> {
  if (!authModePromise) {
    authModePromise = fetch(`${API_URL}/api/auth/mode`, {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Auth mode request failed: ${response.status}`);
        return response.json() as Promise<AuthMode>;
      })
      .catch(() => ({ emergencyDbMode: false, authMode: "supabase" as const }));
  }
  return authModePromise;
}