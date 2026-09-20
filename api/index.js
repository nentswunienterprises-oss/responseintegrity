export default async function handler(req, res) {
  if (process.env.VERCEL_ENV !== 'preview') {
    return res.status(404).json({ error: 'Not found' });
  }

  const runtime = await import('../generated/preview-api-runtime.mjs');
  return runtime.default(req, res);
}
