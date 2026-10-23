/** Native storage has both JSON objects and JSON-encoded strings. Read only;
 * malformed/other values remain absent evidence, never successful evidence. */
export const SANDBOX_NATIVE_DRILL_PAYLOAD_SQL = `CASE
  WHEN jsonb_typeof(h.drill::jsonb) = 'object' THEN h.drill::jsonb
  WHEN jsonb_typeof(h.drill::jsonb) = 'string'
    AND (h.drill::jsonb #>> '{}') IS JSON OBJECT
    THEN (h.drill::jsonb #>> '{}')::jsonb
  ELSE NULL END`;
