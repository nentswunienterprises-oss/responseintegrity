// Runtime configuration for API URL

const PRODUCTION_API_URL = 'https://api.responseintegrity.co.za';

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export function getApiUrl(): string {
  const explicitApiUrl = String(import.meta.env.VITE_API_URL || '').trim();
  if (explicitApiUrl) {
    return trimTrailingSlash(explicitApiUrl);
  }

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname.toLowerCase();

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:5000';
    }

    // Vercel previews use their own same-origin serverless API so branch code
    // and Preview environment data are exercised instead of silently proxying
    // to production. Vercel Preview environment variables must point at Proof.
    if (hostname.endsWith('.vercel.app')) {
      return window.location.origin;
    }
  }

  return PRODUCTION_API_URL;
}

export const API_URL = getApiUrl();
