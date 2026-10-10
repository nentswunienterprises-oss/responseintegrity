import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const migration = readFileSync(new URL("../migrations/20261010_neutral_issue_reporting_v1.sql", import.meta.url), "utf8");

test("neutral issue migration creates a protected route-scoped intake and immutable status ledger permissions", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon;
      CREATE ROLE authenticated;
      CREATE ROLE service_role;
      CREATE TABLE public.users(id varchar PRIMARY KEY);
    `);
    await db.exec(migration);

    const access = await db.query<{
      reports_rls: boolean;
      events_rls: boolean;
      anon_select: boolean;
      auth_select: boolean;
      service_insert: boolean;
      service_select: boolean;
      events_update: boolean;
    }>(`
      SELECT
        (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.issue_reports'::regclass) AS reports_rls,
        (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.issue_report_status_events'::regclass) AS events_rls,
        has_table_privilege('anon','public.issue_reports','SELECT') AS anon_select,
        has_table_privilege('authenticated','public.issue_reports','SELECT') AS auth_select,
        has_table_privilege('service_role','public.issue_reports','INSERT') AS service_insert,
        has_table_privilege('service_role','public.issue_reports','SELECT') AS service_select,
        has_table_privilege('service_role','public.issue_report_status_events','UPDATE') AS events_update
    `);
    assert.deepEqual(access.rows[0], {
      reports_rls: true,
      events_rls: true,
      anon_select: false,
      auth_select: false,
      service_insert: true,
      service_select: true,
      events_update: false,
    });

    await db.query("INSERT INTO public.users(id) VALUES ('reporter'),('reviewer')");
    const inserted = await db.query<{ id: string }>(`
      INSERT INTO public.issue_reports
        (reported_by, category, owner_team, title, description, impact)
      VALUES ('reporter','technical','technology','Progress vanished','Capability progress not showing after login','blocked')
      RETURNING id
    `);
    const id = inserted.rows[0].id;
    assert.ok(id);
    await assert.rejects(
      db.query(`
        INSERT INTO public.issue_reports
          (reported_by, category, owner_team, title, description, impact)
        VALUES ('reporter','technical','people','Wrong routing','Technical issue must not enter People intake','affected')
      `),
      /issue_reports_routing_authority/,
    );
    await db.query(`
      INSERT INTO public.issue_report_status_events
        (issue_report_id, changed_by, from_status, to_status, note)
      VALUES ($1,'reviewer','open','in_progress','Review started')
    `, [id]);
    const events = await db.query<{ count: string }>("SELECT count(*)::text AS count FROM public.issue_report_status_events");
    assert.equal(events.rows[0].count, "1");
  } finally {
    await db.close();
  }
});
