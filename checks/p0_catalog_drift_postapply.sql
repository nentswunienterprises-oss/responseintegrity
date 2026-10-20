-- All three counts must be zero. Intentionally public RLS-enabled tables excluded.
SELECT count(*) AS public_no_rls,
  count(*) FILTER (WHERE has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE')) AS anon_no_rls,
  count(*) FILTER (WHERE has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE')) AS authenticated_no_rls
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind IN ('r','p') AND NOT c.relrowsecurity;
