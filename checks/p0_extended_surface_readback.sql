SELECT c.relname,c.relkind,c.relrowsecurity,c.reloptions,
 has_table_privilege('anon',c.oid,'SELECT') AS anon_select,
 has_table_privilege('authenticated',c.oid,'SELECT') AS authenticated_select
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m') ORDER BY c.relname;
SELECT p.oid::regprocedure,p.prosecdef,p.proconfig,
 has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
 (SELECT count(*) FROM pg_trigger t WHERE t.tgfoid=p.oid) AS trigger_bindings
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' ORDER BY p.oid::regprocedure::text;
SELECT migration_path,sha256,source_commit FROM private.ri_production_schema_migrations
WHERE migration_path ILIKE '%p0%' OR migration_path ILIKE '%containment%';
