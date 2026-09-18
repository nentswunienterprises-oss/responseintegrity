// Runtime configuration for API URL

// Custom production API. Vercel preview deployments deliberately use their
// own same-origin serverless API so branch code and Preview environment data
// are exercised instead of silently proxying to production.
const PRODUCTION_API_URL = "https://api.responseintegrity.co.za";

export function getApiUrl(): string {
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname.toLowerCase();

    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "http://localhost:5000";
    }

    if (hostname.endsWith(".vercel.app")) {
      return "";
    }
  }

  return PRODUCTION_API_URL;
}

export const API_URL = getApiUrl();
