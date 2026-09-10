import { supabase } from "./supabaseClient";
import { API_URL } from "./config";
import { getAuthMode } from "./authMode";

export async function authorizedGetJson(path: string): Promise<any> {
  const authMode = await getAuthMode();
  const { data: { session } } = authMode.emergencyDbMode
    ? { data: { session: null } }
    : await supabase.auth.getSession();
  const headers: HeadersInit = {};
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
    console.log("🔐 authorizedGetJson: using Supabase token");
  } else {
    console.warn("⚠️ authorizedGetJson: no Supabase token, relying on cookies");
  }

  const fullUrl = API_URL + path;
  console.log("🔗 authorizedGetJson: GET", fullUrl);
  
  const res = await fetch(fullUrl, {
    headers,
    credentials: "include",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await res.text();
    const origin = typeof window !== 'undefined' ? window.location.origin : 'server';
    throw new Error(`Invalid content-type from ${fullUrl} (origin ${origin}): ${contentType}. Body: ${text.substring(0, 200)}`);
  }

  return await res.json();
}
