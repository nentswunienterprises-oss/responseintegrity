import type { Role } from "@shared/portals";

const PASSWORD_RESET_RETURN_TO_KEY = "password-reset-return-to";
const DEFAULT_LOGIN_PATH = "/auth?mode=login";

function buildPath(pathname: string, params: URLSearchParams) {
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function isSafeInternalPath(value: string | null) {
  return Boolean(value && value.startsWith("/") && !value.startsWith("//"));
}

export function buildPasswordResetReturnTo(pathname: string, search: string, role?: Role) {
  const params = new URLSearchParams(search);
  params.set("mode", "login");

  if (pathname === "/operational/signup" && (role === "tutor" || role === "td")) {
    params.set("role", role);
  }

  return buildPath(pathname, params);
}

export function buildForgotPasswordPath(returnTo: string) {
  const params = new URLSearchParams();
  params.set("returnTo", returnTo);
  return `/forgot-password?${params.toString()}`;
}

export function getPasswordResetFallbackLoginPath(search: string) {
  const params = new URLSearchParams(search);
  const returnTo = params.get("returnTo");
  if (isSafeInternalPath(returnTo)) {
    return returnTo;
  }

  if (typeof window === "undefined") {
    return DEFAULT_LOGIN_PATH;
  }

  try {
    const storedValue = localStorage.getItem(PASSWORD_RESET_RETURN_TO_KEY);
    return isSafeInternalPath(storedValue) ? storedValue : DEFAULT_LOGIN_PATH;
  } catch {
    return DEFAULT_LOGIN_PATH;
  }
}

export function storePasswordResetReturnTo(returnTo: string) {
  if (!isSafeInternalPath(returnTo) || typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(PASSWORD_RESET_RETURN_TO_KEY, returnTo);
  } catch {
    // Ignore storage failures and fall back to the default auth route.
  }
}

export function clearPasswordResetReturnTo() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.removeItem(PASSWORD_RESET_RETURN_TO_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export function hasStoredPasswordResetReturnTo() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const storedValue = localStorage.getItem(PASSWORD_RESET_RETURN_TO_KEY);
    return isSafeInternalPath(storedValue);
  } catch {
    return false;
  }
}
