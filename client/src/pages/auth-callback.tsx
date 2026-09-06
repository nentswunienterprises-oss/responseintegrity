import { useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { API_URL } from "@/lib/config";
import { getDefaultDashboardRoute } from "@shared/portals";
import { buildOAuthAttribution, clearOAuthAttribution } from "@/lib/oauth-attribution";

/**
 * OAuth Callback Handler
 * Completes the client session and creates the application profile for new OAuth users.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const hashParams = useMemo(
    () => new URLSearchParams(location.hash.startsWith("#") ? location.hash.slice(1) : location.hash),
    [location.hash]
  );

  useEffect(() => {
    let cancelled = false;

    const completeCallback = async () => {
      const requestedNext = searchParams.get("next");
      const safeNext = requestedNext && requestedNext.startsWith("/") && !requestedNext.startsWith("//")
        ? requestedNext
        : "/auth";
      const oauthRole = sessionStorage.getItem("oauth_role");
      const isRecoveryLink =
        searchParams.get("type") === "recovery" ||
        hashParams.get("type") === "recovery" ||
        safeNext === "/reset-password" ||
        (searchParams.has("code") && !oauthRole);

      if (isRecoveryLink) {
        const forwardedParams = new URLSearchParams(searchParams);
        forwardedParams.delete("next");
        const forwardedQuery = forwardedParams.toString();
        const targetWithQuery = forwardedQuery ? `${safeNext}?${forwardedQuery}` : safeNext;
        navigate(`${targetWithQuery}${location.hash}`, { replace: true });
        return;
      }

      if (!oauthRole) {
        navigate(safeNext, { replace: true });
        return;
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const oauthUser = sessionData.session?.user;
      if (sessionError || !oauthUser) {
        console.error("OAuth session was not available after callback", sessionError);
        navigate("/auth", { replace: true });
        return;
      }

      const metadata = oauthUser.user_metadata || {};
      const oauthAttribution = buildOAuthAttribution(sessionStorage, sessionStorage.getItem("oauth_mode"));
      const response = await fetch(`${API_URL}/api/auth/oauth-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          user_id: oauthUser.id,
          email: oauthUser.email,
          role: oauthRole,
          first_name: metadata.given_name || metadata.first_name || "",
          last_name: metadata.family_name || metadata.last_name || "",
          affiliate_code: oauthAttribution.affiliate_code,
          production_link_code: oauthAttribution.production_link_code,
          production_pipeline: oauthAttribution.production_pipeline,
          tracking_source: oauthAttribution.tracking_source,
          tracking_campaign: oauthAttribution.tracking_campaign,
        }),
      });

      if (!response.ok) {
        throw new Error("OAuth profile creation failed");
      }

      const profile = await response.json();
      const resolvedRole = profile.role || oauthRole;
      clearOAuthAttribution(sessionStorage);
      if (!cancelled) {
        navigate(getDefaultDashboardRoute(resolvedRole), { replace: true });
      }
    };

    completeCallback().catch((error) => {
      console.error("OAuth callback failed", error);
      if (!cancelled) navigate("/auth", { replace: true });
    });

    return () => {
      cancelled = true;
    };
  }, [hashParams, location.hash, navigate, searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Processing...</h1>
        <p className="text-gray-600">Redirecting to authentication...</p>
      </div>
    </div>
  );
}
