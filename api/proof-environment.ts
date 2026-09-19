import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  const supabaseUrl = process.env.SUPABASE_URL || '';
  let supabaseProjectRef: string | null = null;
  try {
    supabaseProjectRef = new URL(supabaseUrl).hostname.split('.')[0] || null;
  } catch {
    supabaseProjectRef = null;
  }

  let databaseHost: string | null = null;
  try {
    databaseHost = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).hostname : null;
  } catch {
    databaseHost = null;
  }

  res.status(200).json({
    ok: true,
    vercelEnv: process.env.VERCEL_ENV || null,
    supabaseProjectRef,
    databaseHost,
  });
}
