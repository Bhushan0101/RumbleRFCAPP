# Migrations — dual tree rule

The Next.js app has **two** parallel migration trees that both describe the
same schema. Every schema change must be reflected in **both** or the
Cloudflare D1 deploy will drift out of sync with local development.

## The two trees

| Tree | Who applies it | How |
|---|---|---|
| `app-next/prisma/migrations/` | Local SQLite + Render | `prisma migrate dev` / `prisma migrate deploy` |
| `app-next/prisma/migrations-d1/` | Cloudflare D1 | `wrangler d1 migrations apply wuco-prod` |

Prisma names its folders by timestamp (`20261104183957_add_gender_and_divisions/`).
D1 numbers them sequentially (`0002_add_gender_and_divisions.sql`). The
contents are the same SQL body.

There is **no automatic sync script**. If you change `schema.prisma`:

1. Run `npx prisma migrate dev --name <name>` from `app-next/` — this
   generates the SQLite migration and applies it to `dev.db`.
2. Open the generated `app-next/prisma/migrations/<timestamp>_<name>/migration.sql`.
3. Create `app-next/prisma/migrations-d1/<NNNN>_<name>.sql` where `<NNNN>` is
   the next sequence number (look at the last file in that dir). Copy the
   SQL body verbatim.
4. Commit both files together.

## Checking D1 state

- `npm run cf:d1:migrate:local` — apply pending migrations to the local D1
  simulator (safe, iterative).
- `npm run cf:d1:migrate` — apply to the production D1. Requires explicit
  user approval; never run from an automated step.
- `npx wrangler d1 migrations list wuco-prod --local` — show which
  migrations have been applied in the local simulator.

## Why not generate D1 migrations from Prisma?

Prisma does not currently emit a native D1 migration — it emits SQLite
migrations that work on D1 but under a slightly different ambient PRAGMA
regime. Hand-copying the SQL and committing both files keeps the trees
reviewable in diff and makes drift obvious.
