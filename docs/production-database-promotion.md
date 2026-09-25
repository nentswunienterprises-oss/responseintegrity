# Production database promotion authority

Response Integrity does **not** mutate The Hub just because application code merges to `main`.

## Authority

- Production Supabase project: **The Hub**
- Project ref: `yzcnavucvwgmulcxgxvw`
- Verified schema baseline: `a8c1aab29b230ce523c0353cfcc4eb4b1ae07627`
- Authority manifest: `config/production-migration-authority.json`
- Manual promotion workflow: `.github/workflows/production-db-promotion.yml`
- Application-owned ledger: `private.ri_production_schema_migrations`

The baseline migration files in the manifest are immutable. They represent SQL whose live effects were verified on The Hub on 2026-09-25. PR #81 changed no migration files, so its merge commit is the baseline commit.

## New migration rule

Any new SQL migration after the baseline must:

1. be added as a new file under `migrations/`;
2. be added to `managedMigrations` in the authority manifest;
3. declare a description and risk (`additive` or `destructive`);
4. pass **Production DB Contract CI**;
5. be promoted through the manual **Production DB Promotion** workflow.

Editing a verified baseline migration fails CI. Adding an unmanaged SQL migration fails CI.

## Production workflow

The workflow never runs on `push` or `pull_request`. A person must start it manually.

- **plan** connects to The Hub and reports pending managed migrations without changing schema.
- **apply** requires the exact confirmation phrase `THE_HUB`.
- The database URL must contain The Hub project ref, otherwise the runner refuses to connect.
- Each managed migration is applied in its own transaction and recorded with a SHA-256 checksum, source commit, actor, and timestamp.
- A checksum mismatch fails closed.
- Dangerous server-side file/program SQL and transaction-incompatible statements are rejected by the runner.

On the first approved `apply`, the runner creates the private RI ledger and records the already-verified baseline **without re-running baseline SQL**.

## GitHub setup required once

Create a GitHub environment named `production-db` and configure:

- environment secret `RI_PRODUCTION_DATABASE_URL` containing The Hub Postgres URL with `sslmode=verify-full`;
- environment secret `RI_PRODUCTION_DB_CA_CERT` containing the full PEM text of The Hub database CA certificate downloaded from Supabase **Database Settings → SSL Configuration**;
- required reviewer protection for production promotion.

The workflow writes the CA certificate to the ephemeral GitHub runner and exposes it only through `NODE_EXTRA_CA_CERTS`. It never disables TLS certificate verification.

The workflow intentionally fails if the secret is absent.

## Drizzle distinction

`npm run db:push` is `drizzle-kit push`. It is **not** the production migration promotion authority and must not be used as an automatic production deploy step. The explicit migration files + authority manifest + manual workflow are the production path.

## Private banks

Capability and Sandbox private-bank activation remains separate from schema promotion. A schema migration must never silently activate private assessment, scenario, or outcome content.
