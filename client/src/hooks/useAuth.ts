
import type { User } from "@shared/schema";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getQueryFn, clearAllCache, setCurrentUserId, getCurrentUserId, setupMultiTabSync } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabaseClient";
import { API_URL } from "@/lib/config";
import { getAuthMode } from "@/lib/authMode";
import { useState, useEffect, useRef } from "react";
import { logout as roleLogout } from "@/lib/auth";

export function useAuth() {
  const [, setLocation] = useLocation();
  const [supabaseReady, setSupabaseReady] = useState(false);
  const queryClient = useQueryClient();
  const previousUserIdRef = useRef<string | null>(null);
  
  // Resolve the actual auth identity before protected queries are allowed to
  // reuse persisted React Query data. This closes the reload/hot-reload path
  // where a tab can hold cache from one Specialist while Supabase has already
  // restored a different Specialist session.
  useEffect(() => {
    let cancelled = false;

    const initializeAuthIdentity = async () => {
      const authMode = await getAuthMode();
      if (cancelled) return;

      if (authMode.dbSessionAuthMode) {
        setSupabaseReady(true);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;

      const sessionUserId = session?.user?.id || null;
      const storedUserId = getCurrentUserId();

      if (storedUserId !== sessionUserId) {
        if (storedUserId || sessionUserId) {
          console.log(
            "🔄 Auth identity changed before query hydration:",
            storedUserId,
            "→",
            sessionUserId,
            "- clearing cache",
          );
          clearAllCache();
        }
        setCurrentUserId(sessionUserId);
      }

      setSupabaseReady(true);
    };

    void initializeAuthIdentity();

    return () => {
      cancelled = true;
    };
  }, []);

  // Setup multi-tab sync - clear cache and refetch when user changes in another tab
  useEffect(() => {
    const cleanup = setupMultiTabSync(() => {
      // Invalidate all queries to force refetch with new user
      queryClient.invalidateQueries();
      // Force page reload to ensure clean state
      window.location.reload();
    });
    return cleanup;
  }, [queryClient]);
  
  // Fetch DB user data from backend - use returnNull for 401 so we don't throw errors on unauthorized
  // Only enable query once Supabase is ready (session restored from localStorage)
  const { data: user, isLoading: userLoading, error } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    staleTime: 1000 * 60 * 5, // Keep user data fresh for 5 minutes to avoid unnecessary refetches
    gcTime: 1000 * 60 * 10, // Keep in cache for 10 minutes
    enabled: supabaseReady, // Only fetch once Supabase session is ready
  });

  // Track user ID changes and clear cache when user switches
  useEffect(() => {
    if (user?.id) {
      const storedUserId = getCurrentUserId();
      
      // If there's a different user stored, clear cache (user switched accounts)
      if (storedUserId && storedUserId !== user.id) {
        console.log('🔄 User switched from', storedUserId, 'to', user.id, '- clearing cache');
        clearAllCache();
        queryClient.invalidateQueries();
      }
      
      // Update stored user ID
      setCurrentUserId(user.id);
      previousUserIdRef.current = user.id;
    }
  }, [user?.id, queryClient]);

  console.log("🔐 useAuth state:", { 
    user: user?.name || null, 
    role: user?.role || null,
    isLoading: userLoading || !supabaseReady, 
    isAuthenticated: !!user,
    supabaseReady,
    error: error?.message 
  });

  const logout = () => {
    // Use the role-based logout from @/lib/auth
    roleLogout(user);
  };

  return {
    user: user || undefined,
    isLoading: userLoading || !supabaseReady,
    isAuthenticated: !!user,
    logout,
  };
}
