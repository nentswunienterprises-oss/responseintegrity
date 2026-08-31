import { supabase } from "./supabaseClient";
import { apiRequest, clearAllCache } from "./queryClient";

function navigateToAuthPath(path: string) {
  window.location.assign(path);
}

function getLogoutRedirect(user) {
  const pathname = window.location.pathname || "";
  const tutorLoginPath = "/operational/signup?role=tutor&mode=login&lock=login&returnTo=/operational/specialist/intake";

  if (user?.role === "tutor") {
    return tutorLoginPath;
  }

  if (user?.role === "td") {
    return "/operational/td/signup?mode=login&lock=login";
  }

  if (user?.role === "coo" || user?.role === "hr" || user?.role === "ceo" || user?.role === "executive") {
    return "/executive";
  }

  if (user?.role === "parent") {
    return "/";
  }

  if (user?.role === "student") {
    return "/student";
  }

  if (user?.role === "affiliate" || user?.role === "od") {
    return "/";
  }

  // If role is missing/stale, infer the portal from the current route.
  if (
    pathname.startsWith("/operational/specialist") ||
    pathname.startsWith("/specialist") ||
    pathname.startsWith("/operational/tutor") ||
    pathname.startsWith("/tutor")
  ) {
    return tutorLoginPath;
  }

  if (pathname.startsWith("/operational/td") || pathname.startsWith("/td")) {
    return "/operational/td/signup?mode=login&lock=login";
  }

  if (pathname.startsWith("/executive")) {
    return "/executive";
  }

  if (pathname.startsWith("/operational")) {
    return "/operational/landing";
  }

  return "/";
}

export async function logout(user) {
  const redirectPath = getLogoutRedirect(user);

  try {
    // Call backend logout endpoint
    await apiRequest("POST", "/api/auth/logout");
    // Sign out from Supabase
    await supabase.auth.signOut();
    // Clear ALL React Query cache (memory + localStorage) to prevent stale user data
    clearAllCache();

    navigateToAuthPath(redirectPath);
  } catch (error) {
    console.error("Logout error:", error);
    clearAllCache();
    navigateToAuthPath(redirectPath);
  }
}
