import type { VercelRequest, VercelResponse } from '@vercel/node';

// PR47 closure proof: deploy deterministic targeted re-diagnosis fixtures with the current proof SHA.

export default function handler(_req: VercelRequest, res: VercelResponse) {
  if (process.env.VERCEL_ENV !== 'preview') {
    return res.status(404).json({ error: 'Not found' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || '';
  let supabaseProjectRef: string | null = null;
  try {
    supabaseProjectRef = new URL(supabaseUrl).hostname.split('.')[0] || null;
  } catch {
    supabaseProjectRef = null;
  }

  let databaseHost: string | null = null;
  try {
    databaseHost = process.env.DATABASE_URL
      ? new URL(process.env.DATABASE_URL).hostname
      : null;
  } catch {
    databaseHost = null;
  }

  return res.status(200).json({
    vercelEnv: process.env.VERCEL_ENV || null,
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
    supabaseProjectRef,
    databaseHost,
    requiredEnv: {
      SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
      SUPABASE_ANON_KEY: Boolean(process.env.SUPABASE_ANON_KEY),
      SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      DATABASE_URL: Boolean(process.env.DATABASE_URL),
      SESSION_SECRET: Boolean(process.env.SESSION_SECRET),
    },
  });
}
