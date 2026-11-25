import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/site/page-header";
import { martialArtName, classDisplayName, martialArtRequiresClass } from "@/lib/martial-arts";
import { divisionDisplayName, genderName } from "@/lib/divisions";
import { instagramUrl, facebookUrl, tiktokUrl } from "@/lib/socials";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { id } = await params;
  const f = await prisma.athlete.findUnique({ where: { id: Number(id) } });
  if (!f) return { title: "Fighter not found" };
  return { title: `${f.name} · Fighter profile` };
}

export default async function FighterPage({ params }: { params: Params }) {
  const { id } = await params;
  const f = await prisma.athlete.findUnique({
    where: { id: Number(id) },
    include: {
      profile: true,
      passport: true,
      rankings: true,
      disciplines: true,
      fightHistory: { orderBy: { fightDate: "desc" } },
      photos: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!f || f.profile?.approvalStatus !== "approved") notFound();

  // Sort primary first.
  const disciplines = [...f.disciplines].sort((a, b) => b.isPrimary - a.isPrimary);
  const hasMulti = disciplines.length > 1;

  return (
    <>
      <PageHeader eyebrow="Fighter profile" title={f.name}>
        {f.martialArt && <>Discipline: <strong className="text-white">{martialArtName(f.martialArt)}</strong>. </>}
        {f.classCode && martialArtRequiresClass(f.martialArt) && <>Class: <strong className="text-white">{classDisplayName(f.martialArt, f.classCode)}</strong>.</>}
      </PageHeader>
      <Container className="py-10">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          <aside className="bg-surface border border-border p-6 space-y-5">
            {f.portraitUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={f.portraitUrl}
                alt={f.name}
                className="w-full aspect-[4/5] object-cover rounded-xl border border-gold/30"
              />
            ) : (
              <div className="w-full aspect-[4/5] bg-black/40 border border-dashed border-border rounded-xl grid place-items-center">
                <span className="font-display text-7xl text-muted/50">
                  {f.name[0]?.toUpperCase()}
                </span>
              </div>
            )}
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-[10px] tracking-wider text-gold uppercase">Fighter No</dt>
                <dd className="font-display text-xl text-white tracking-wider mt-1">
                  {f.passport?.fighterNo ?? "Not issued"}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] tracking-wider text-gold uppercase">Nationality</dt>
                <dd className="text-white mt-1">{f.country || "—"}</dd>
              </div>
              <div>
                <dt className="text-[10px] tracking-wider text-gold uppercase">Division</dt>
                <dd className="text-white mt-1">{divisionDisplayName(f.gender, f.division) || "—"}</dd>
              </div>
              {f.gender && (
                <div>
                  <dt className="text-[10px] tracking-wider text-gold uppercase">Gender</dt>
                  <dd className="text-white mt-1">{genderName(f.gender)}</dd>
                </div>
              )}
              <div>
                <dt className="text-[10px] tracking-wider text-gold uppercase">Record (W–L–D)</dt>
                <dd className="font-display text-xl text-white tracking-wider mt-1">
                  {f.wins}–{f.losses}–{f.draws}
                </dd>
              </div>
              {hasMulti && (
                <div>
                  <dt className="text-[10px] tracking-wider text-gold uppercase">Disciplines</dt>
                  <dd className="mt-1 space-y-1 text-sm">
                    {disciplines.map((d) => (
                      <div key={d.martialArt} className="flex justify-between text-white">
                        <span>
                          {martialArtName(d.martialArt)}
                          {d.classCode && martialArtRequiresClass(d.martialArt) && (
                            <span className="text-gold ml-1">· {d.classCode}</span>
                          )}
                          {d.isPrimary === 1 && (
                            <span className="ml-1.5 inline-block bg-gold text-bg text-[9px] px-1.5 py-0.5 rounded-full align-middle">
                              Primary
                            </span>
                          )}
                        </span>
                        <span className="text-[#cfe3d8]">
                          {d.wins}-{d.losses}-{d.draws}
                        </span>
                      </div>
                    ))}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-[10px] tracking-wider text-gold uppercase">Status</dt>
                <dd className="text-emerald mt-1 font-display tracking-wider">
                  ACTIVE
                </dd>
              </div>
              {f.passport?.fighterNo && (
                <Link
                  href={`/passport/${f.passport.fighterNo}`}
                  className="inline-flex w-full justify-center items-center gap-2 bg-gold text-bg py-3 font-display font-bold text-xs tracking-wider uppercase hover:bg-gold-hi"
                >
                  View digital passport →
                </Link>
              )}
              <FighterSocials
                instagram={f.instagramHandle}
                facebook={f.facebookUrl}
                tiktok={f.tiktokHandle}
              />
            </dl>
          </aside>
          <section className="space-y-6">
            <div className="bg-surface border border-border p-6">
              <h2 className="font-display text-xl text-white tracking-wider mb-3">
                Biography
              </h2>
              <p className="text-sm text-muted leading-relaxed">
                {f.biography ||
                  `${f.name} is a ${classDisplayName(f.martialArt, f.classCode) || martialArtName(f.martialArt) || "WUCO"} fighter competing in ${divisionDisplayName(f.gender, f.division) || "—"}. More details will be added by their coach or the fighter directly from the member portal.`}
              </p>
            </div>
            {f.rankings.length > 0 && (
              <div className="bg-surface border border-border p-6">
                <h2 className="font-display text-xl text-white tracking-wider mb-3">
                  Rankings
                </h2>
                <ul className="space-y-2 text-sm">
                  {f.rankings.map((r) => (
                    <li key={r.id} className="flex justify-between text-white">
                      <span>{divisionDisplayName(f.gender, r.division)}</span>
                      <span className="font-display text-gold">#{r.position}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {f.fightHistory.length > 0 && (
              <div className="bg-surface border border-border p-6">
                <h2 className="font-display text-xl text-white tracking-wider mb-3">
                  Fight history
                </h2>
                <ol className="divide-y divide-border/60">
                  {f.fightHistory.map((h) => (
                    <li key={h.id} className="py-3 flex items-start gap-3">
                      <span
                        className={`font-display text-[10px] tracking-wider px-2 py-1 rounded uppercase ${
                          h.result === "win"
                            ? "bg-emerald text-white"
                            : h.result === "loss"
                              ? "bg-red-500 text-white"
                              : "bg-orange-500 text-white"
                        }`}
                      >
                        {h.result}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white">
                          vs <span className="font-medium">{h.opponent}</span>
                          {h.method && <span className="text-muted"> · {h.method}</span>}
                        </p>
                        <p className="text-[11px] text-muted">
                          {h.fightDate}
                          {h.eventName && ` · ${h.eventName}`}
                          {h.location && ` · ${h.location}`}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {f.photos.length > 0 && (
              <div className="bg-surface border border-border p-6">
                <h2 className="font-display text-xl text-white tracking-wider mb-3">
                  Photos
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {f.photos.map((p) => (
                    <figure
                      key={p.id}
                      className="relative aspect-square rounded-lg overflow-hidden border border-border bg-black/40"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.url}
                        alt={p.caption || f.name}
                        className="w-full h-full object-cover"
                      />
                      {p.caption && (
                        <figcaption className="absolute inset-x-0 bottom-0 bg-black/70 text-white text-[11px] px-2 py-1 line-clamp-2">
                          {p.caption}
                        </figcaption>
                      )}
                    </figure>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </Container>
    </>
  );
}

function FighterSocials({
  instagram,
  facebook,
  tiktok,
}: {
  instagram: string;
  facebook: string;
  tiktok: string;
}) {
  const ig = instagramUrl(instagram);
  const fb = facebookUrl(facebook);
  const tt = tiktokUrl(tiktok);
  if (!ig && !fb && !tt) return null;
  return (
    <div className="pt-3 border-t border-border/50">
      <p className="text-[10px] tracking-wider text-gold uppercase mb-2">Social</p>
      <div className="flex items-center gap-2">
        {ig && (
          <a
            href={ig}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${instagram || "Instagram"} on Instagram`}
            className="grid place-items-center size-9 rounded-full border border-border hover:border-gold hover:text-gold text-white transition-colors"
          >
            <IgIcon />
          </a>
        )}
        {tt && (
          <a
            href={tt}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${tiktok || "TikTok"} on TikTok`}
            className="grid place-items-center size-9 rounded-full border border-border hover:border-gold hover:text-gold text-white transition-colors"
          >
            <TikTokIcon />
          </a>
        )}
        {fb && (
          <a
            href={fb}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${facebook || "Facebook"} on Facebook`}
            className="grid place-items-center size-9 rounded-full border border-border hover:border-gold hover:text-gold text-white transition-colors"
          >
            <FbIcon />
          </a>
        )}
      </div>
    </div>
  );
}

function IgIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
function FbIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
      <path d="M13 22v-8h3l1-4h-4V7.5c0-1.2.4-2 2.2-2H17V2.1C16.7 2 15.4 2 14.3 2 11.6 2 9.8 3.7 9.8 6.9V10H7v4h2.8v8h3.2z" />
    </svg>
  );
}
function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
      <path d="M19.6 7.3c-1.3-.3-2.3-1.2-2.8-2.4V4h-3.3v13.3c0 1.4-1.2 2.6-2.6 2.6s-2.6-1.2-2.6-2.6 1.2-2.6 2.6-2.6c.3 0 .6 0 .9.1v-3.4c-.3 0-.6-.1-.9-.1-3.3 0-6 2.7-6 6s2.7 6 6 6 6-2.7 6-6V9.6c1.2.8 2.7 1.3 4.3 1.3V7.5c-.5 0-1-.1-1.6-.2z" />
    </svg>
  );
}
