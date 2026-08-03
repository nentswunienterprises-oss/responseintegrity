import { useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useNavigate } from "react-router-dom";

/**
 * OAuth Callback Handler
 * DISABLED - Google OAuth removed for affiliates
 * Redirects users back to auth page
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
    const requestedNext = searchParams.get("next");
    const safeNext = requestedNext && requestedNext.startsWith("/") && !requestedNext.startsWith("//")
      ? requestedNext
      : "/auth";

    const looksLikeRecoveryLink =
      searchParams.get("type") === "recovery" ||
      hashParams.get("type") === "recovery" ||
      searchParams.has("code") ||
      hashParams.has("access_token") ||
      safeNext === "/reset-password";

    const forwardedParams = new URLSearchParams(searchParams);
    forwardedParams.delete("next");

    const forwardedQuery = forwardedParams.toString();
    const targetWithQuery = forwardedQuery ? `${safeNext}?${forwardedQuery}` : safeNext;
    const target = looksLikeRecoveryLink ? `${targetWithQuery}${location.hash}` : safeNext;

    navigate(target, { replace: true });
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
