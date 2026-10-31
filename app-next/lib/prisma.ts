// Prisma client — dual-target singleton.
//
//   DEPLOY_TARGET=cloudflare → D1 adapter, picked from the Workers request
//                              context so existing `import { prisma }` call
//                              sites keep working unchanged.
//   otherwise                → better-sqlite3 adapter on local SQLite file
//                              (local dev + Render).
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function makeLocalClient(): PrismaClient {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  const path = url.startsWith("file:") ? url.slice("file:".length) : url;
  const adapter = new PrismaBetterSqlite3({ url: path });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

function makeCloudflareProxy(): PrismaClient {
  // D1 bindings only exist inside a Workers request. We can't build the
  // client at module load — instead, return a Proxy that lazily resolves the
  // real client on first property access per request.
  let cached: PrismaClient | null = null;
  const resolve = async (): Promise<PrismaClient> => {
    if (cached) return cached;
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { PrismaD1 } = await import("@prisma/adapter-d1");
    const ctx = getCloudflareContext();
    const d1 = (ctx.env as unknown as { DB: D1Database }).DB;
    const adapter = new PrismaD1(d1);
    cached = new PrismaClient({ adapter });
    return cached;
  };

  return new Proxy({} as PrismaClient, {
    get(_target, prop) {
      // Every delegate method (prisma.user.findMany, etc.) becomes a thunk
      // that resolves the real client first.
      return new Proxy(() => {}, {
        get(_t, inner) {
          return async (...args: unknown[]) => {
            const client = await resolve();
            // @ts-expect-error — dynamic delegate lookup
            return client[prop][inner](...args);
          };
        },
        apply: async (_t, _this, args) => {
          const client = await resolve();
          // @ts-expect-error — $-method lookup (e.g. $transaction)
          return client[prop](...args);
        },
      });
    },
  });
}

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  (process.env.DEPLOY_TARGET === "cloudflare"
    ? makeCloudflareProxy()
    : makeLocalClient());

if (process.env.NODE_ENV !== "production" && process.env.DEPLOY_TARGET !== "cloudflare") {
  globalForPrisma.prisma = prisma;
}
