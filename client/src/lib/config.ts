// Runtime configuration for API URL

const PRODUCTION_API_URL = 'https://api.responseintegrity.co.za';
const PROOF_API_URL = 'https://responseintegrity-proof.onrender.com';

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export function getApiUrl(): string {
  const explicitApiUrl = String(import.meta.env.VITE_API_URL || '').trim();
  if (explicitApiUrl) {
    return trimTrailingSlash(explicitApiUrl);
  }

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:5000';
    }

    // Git-backed Vercel preview aliases must never call the production API.
    if (hostname.endsWith('.vercel.app') && hostname.includes('-git-')) {
      return PROOF_API_URL;
    }
  }

  return PRODUCTION_API_URL;
}

export const API_URL = getApiUrl();
