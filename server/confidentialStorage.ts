import type { RequestHandler } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";

const buckets = new Set(["tutor-documents", "coo-brain-library", "executive-task-proofs"]);

export function confidentialReference(bucket: string, key: string) {
  if (!buckets.has(bucket) || !key || key.split("/").some(p => p === ".." || p === ".")) {
    throw new Error("Invalid confidential object reference");
  }
  return `ri-storage://${bucket}/${key}`;
}

export function parseConfidentialReference(reference: string, supabaseUrl: string) {
  try {
    if (decodeURIComponent(reference).split(/[\\/]/).some(p => p === ".." || p === ".")) return null;
    const url = new URL(reference);
    let bucket: string, key: string;
    if (url.protocol === "ri-storage:") {
      bucket = url.hostname; key = decodeURIComponent(url.pathname.slice(1));
    } else {
      if (url.origin !== new URL(supabaseUrl).origin || url.search || url.hash) return null;
      const match = url.pathname.match(/^\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
      if (!match) return null;
      bucket = match[1]; key = decodeURIComponent(match[2]);
    }
    confidentialReference(bucket, key);
    return { bucket, key };
  } catch { return null; }
}

export function confidentialDownloadUrl(reference: string) {
  return `/api/confidential-file?reference=${encodeURIComponent(reference)}`;
}

export async function ensurePrivateBucket(client: SupabaseClient, bucket: string) {
  if (!buckets.has(bucket)) throw new Error("Unknown confidential bucket");
  const { data, error } = await client.storage.getBucket(bucket);
  if (!error && data) {
    if (data.public) throw new Error("Confidential bucket is public; protected containment required");
    return;
  }
  // Permission/network failures must not be interpreted as a missing bucket.
  if (String((error as any)?.status || (error as any)?.statusCode) !== "404") throw error || new Error("Bucket unavailable");
  const created = await client.storage.createBucket(bucket, { public: false });
  if (created.error) throw created.error;
}

type Query = (sql: string, values: unknown[]) => Promise<{ rows: any[] }>;

export function createConfidentialDownloadHandler(args: {
  query: Query; client: SupabaseClient; supabaseUrl: string;
}): RequestHandler {
  return async (req, res) => {
    const user = (req as any).dbUser;
    if (!user?.id) { res.status(401).json({ message: "Authentication required" }); return; }
    const reference = String(req.query.reference || "");
    const object = parseConfidentialReference(reference, args.supabaseUrl);
    if (!object || object.bucket === "executive-task-proofs") {
      res.status(404).json({ message: "File not found" }); return;
    }
    try {
      let allowed = false;
      if (object.bucket === "coo-brain-library") {
        if (user.role === "coo") {
          const result = await args.query("SELECT id FROM public.coo_brain_library_items WHERE pdf_url=$1 LIMIT 1", [reference]);
          allowed = result.rows.length > 0;
        }
      } else {
        // Match persisted evidence first; never authorize an arbitrary object path.
        for (const [table, role] of [["tutor_applications","tutor"],["td_applications","td"],["affiliate_applications","affiliate"]] as const) {
          if (user.role !== "coo" && !(user.role === "hr" && table === "tutor_applications") && user.role !== role) continue;
          const result = await args.query(
            `SELECT a.id FROM public.${table} a WHERE ($2::text='coo' OR ($2::text='hr' AND '${table}'='tutor_applications') OR a.user_id::text=$3)
             AND EXISTS (SELECT 1 FROM jsonb_each_text(to_jsonb(a)) e
               WHERE e.key LIKE 'doc_%_url' AND e.value=$1) LIMIT 1`,
            [reference,user.role,user.id]);
          if (result.rows.length) { allowed = true; break; }
        }
      }
      if (!allowed) { res.status(404).json({ message: "File not found" }); return; }
      const { data, error } = await args.client.storage.from(object.bucket).download(object.key);
      if (error || !data) throw error || new Error("File unavailable");
      // Proxy bytes after authorization: no signed bearer URL to persist or leak.
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Security-Policy", "sandbox");
      res.setHeader("Content-Type", data.type || "application/octet-stream");
      res.send(Buffer.from(await data.arrayBuffer()));
    } catch {
      res.status(503).json({ message: "File temporarily unavailable" });
    }
  };
}
