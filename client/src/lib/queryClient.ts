import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { supabase } from "./supabaseClient";
import { API_URL } from "./config";
import { getAuthMode } from "./authMode";

// Check if we're online
const isOnline = () => typeof navigator !== 'undefined' ? navigator.onLine : true;

// Key used by the persister in localStorage
const PERSISTER_KEY = 'REACT_QUERY_OFFLINE_CACHE';

// Key used to track current user - use sessionStorage (tab-specific) to avoid cross-tab issues
const SESSION_USER_KEY = 'SESSION_USER_ID';

// Create a custom storage adapter that uses sessionStorage (tab-specific, not shared)
// This prevents cache mixing when logging in as different users in different tabs
const sessionStorageAdapter = typeof window !== 'undefined' ? {
  getItem: (key: string) => window.sessionStorage.getItem(key),
  setItem: (key: string, value: string) => window.sessionStorage.setItem(key, value),
  removeItem: (key: string) => window.sessionStorage.removeItem(key),
} : undefined;

// Create a persister using sessionStorage (tab-specific) instead of localStorage (shared)
export const persister = createSyncStoragePersister({
  storage: sessionStorageAdapter,
  key: PERSISTER_KEY,
});

// Function to clear both in-memory and persisted cache
export function clearAllCache() {
  // Clear in-memory cache
  queryClient.clear();
  // Clear sessionStorage persisted cache
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(PERSISTER_KEY);
  }
  console.log('🗑️ All query cache cleared (memory + sessionStorage)');
}

// Track current user to detect user switching within the same tab
export function setCurrentUserId(userId: string | null) {
  if (typeof window !== 'undefined') {
    if (userId) {
      window.sessionStorage.setItem(SESSION_USER_KEY, userId);
    } else {
      window.sessionStorage.removeItem(SESSION_USER_KEY);
    }
  }
}

export function getCurrentUserId(): string | null {
  if (typeof window !== 'undefined') {
    return window.sessionStorage.getItem(SESSION_USER_KEY);
  }
  return null;
}

// No longer needed - sessionStorage is tab-specific so no cross-tab sync required
export function setupMultiTabSync(onUserChange: () => void) {
  // Return no-op cleanup function
  return () => {};
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const fullUrl = API_URL + url;
  const authMode = await getAuthMode();
  const { data: { session } } = authMode.emergencyDbMode
    ? { data: { session: null } }
    : await supabase.auth.getSession();
  const headers: HeadersInit = data ? { "Content-Type": "application/json" } : {};
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  if (method === 'POST') {
    console.log('[apiRequest][POST] url:', fullUrl, 'data:', data);
  }
  console.log("[apiRequest] method:", method, "url:", fullUrl, "credentials: include");
  const res = await fetch(fullUrl, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
    cache: "no-store",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Get the Supabase session to include auth token
    const authMode = await getAuthMode();
    const { data: { session } } = authMode.emergencyDbMode
      ? { data: { session: null } }
      : await supabase.auth.getSession();
    
    const headers: HeadersInit = {};
    
    // If there's a Supabase session, add the auth token
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
      console.log("📤 Sending request with Supabase auth token");
    } else {
      console.log("⚠️  No Supabase session found, request will rely on server session cookies");
    }
    
    const fetchOptions: RequestInit = {
      headers,
      credentials: "include", // Always include credentials for cookies
      cache: "no-store",
    };
    
    const url = queryKey.join("/") as string;
    const fullUrl = API_URL + url;
    console.log("🔗 Fetching:", fullUrl, "with headers:", Object.keys(headers));
    
    const res = await fetch(fullUrl, fetchOptions);

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: true,
      staleTime: 1000 * 45,
      retry: (failureCount, error) => {
        // Don't retry if offline
        if (!isOnline()) return false;
        // Don't retry on 401, 403, 404
        if (error instanceof Error && /^(401|403|404):/.test(error.message)) {
          return false;
        }
        // Retry up to 2 times for other errors
        return failureCount < 2;
      },
      // Keep showing cached data even if query fails
      networkMode: 'offlineFirst',
    },
    mutations: {
      retry: false,
      // Allow mutations to queue when offline
      networkMode: 'offlineFirst',
    },
  },
});

// Expose queryClient globally for use in components that can't easily access it
if (typeof window !== 'undefined') {
  (window as any).__queryClient = queryClient;
}
