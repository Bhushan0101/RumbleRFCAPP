import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/site/page-header";
import { signOutAction } from "@/app/actions/auth";
import {
  Users,
  UserPlus,
  Clock,
  Building2,
  Calendar,
  Trophy,
  Mail,
  TicketCheck,
} from "lucide-react";

export const metadata = { title: "Member portal" };

export default async function PortalPage() {
  const session = await auth();
  if (!session?.user) redirect("/portal/sign-in");

  if (session.user.role === "admin") return <AdminDashboard name={session.user.name ?? "Admin"} />;
  if (session.user.role === "ranking_admin") redirect("/portal/ranking");

  return <FighterDashboard userId={session.user.id!} name={session.user.name ?? "Member"} />;
}

// --- Admin -----------------------------------------------------------------
async function AdminDashboard({ name }: { name: string }) {
  const [
    approved,
    pending,
    rejected,
    gyms,
    upcoming,
    past,
    bookings,
    newEnquiries,
    unreadMail,
    topFighters,
    recentAudit,
    recentBookings,
  ] = await Promise.all([
    prisma.fighterProfile.count({ where: { approvalStatus: "approved" } }),
    prisma.fighterProfile.count({ where: { approvalStatus: "pending_approval" } }),
    prisma.fighterProfile.count({ where: { approvalStatus: "rejected" } }),
    prisma.gym.count({ where: { status: "active" } }),
    prisma.event.count({ where: { status: "Upcoming" } }),
    prisma.event.count({ where: { status: "Past" } }),
    prisma.classBooking.count(),
    prisma.gymEnquiry.count({ where: { status: "new" } }),
    prisma.outboundMail.count({ where: { readAt: null } }),
    prisma.athlete.findMany({
      where: { profile: { approvalStatus: "approved" } },
      orderBy: { wins: "desc" },
      take: 5,
      include: { passport: true },
    }),
    prisma.applicationAudit.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { athlete: true, actor: true },
    }),
    prisma.classBooking.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { class: { include: { gym: true } } },
    }),
  ]);
  const totalBouts = await prisma.bout.count();

  return (
    <>
      <PageHeader eyebrow="Administrator workspace" title={`Welcome, ${name}`}>
        A single view of fighters, events, clubs and activity across W.U.C.O
        Ireland.
      </PageHeader>
      <Container className="py-10 space-y-10">
        {/* Top-line KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi
            icon={<Users className="size-5" />}
            value={approved}
            label="Approved fighters"
            href="/portal/admin/fighters"
          />
          <Kpi
            icon={<Clock className="size-5" />}
            value={pending}
            label="Pending approval"
            href="/portal/admin/fighters"
            accent={pending > 0 ? "gold" : undefined}
          />
          <Kpi
            icon={<Building2 className="size-5" />}
            value={gyms}
            label="Affiliated clubs"
            href="/clubs"
          />
          <Kpi
            icon={<Calendar className="size-5" />}
            value={upcoming}
            label="Upcoming events"
            href="/portal/admin/events"
          />
          <Kpi
            icon={<Trophy className="size-5" />}
            value={totalBouts}
            label="Recorded bouts"
            href="/portal/admin/events"
          />
          <Kpi
            icon={<TicketCheck className="size-5" />}
            value={bookings}
            label="Class bookings"
            href="/portal/admin/bookings"
          />
          <Kpi
            icon={<UserPlus className="size-5" />}
            value={newEnquiries}
            label="New gym enquiries"
            href="/portal/admin/gyms"
            accent={newEnquiries > 0 ? "gold" : undefined}
          />
          <Kpi
            icon={<Mail className="size-5" />}
            value={unreadMail}
            label="Notifications"
            href="/portal/admin/inbox"
          />
        </div>

        {/* Donut-ish breakdown + rankings */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <section className="bg-surface border border-border p-6 lg:col-span-2">
            <h2 className="font-display text-xl text-white tracking-wider mb-5">
              Fighter approval status
            </h2>
            <StatusBreakdown approved={approved} pending={pending} rejected={rejected} />
          </section>
          <section className="bg-surface border border-border p-6">
            <h2 className="font-display text-xl text-white tracking-wider mb-4">
              Past events
            </h2>
            <p className="font-display text-5xl text-gold">{past}</p>
            <p className="text-sm text-muted mt-2">events in the archive</p>
          </section>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Top fighters */}
          <section className="bg-surface border border-border">
            <header className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="font-display text-xl text-white tracking-wider">
                Top 5 by wins
              </h2>
              <Link
                href="/portal/admin/fighters"
                className="text-xs font-display tracking-wider text-gold"
              >
                MANAGE →
              </Link>
            </header>
            <ol className="divide-y divide-border">
              {topFighters.map((a, i) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between px-6 py-3"
                >
                  <span className="flex items-center gap-4">
                    <span className="font-display text-xl text-gold w-6">
                      {i + 1}
                    </span>
                    <span>
                      <span className="text-white font-display tracking-wider block">
                        {a.name}
                      </span>
                      <span className="text-xs text-muted">
                        {a.passport?.fighterNo} · {a.classCode ?? "—"} · {a.division}
                      </span>
                    </span>
                  </span>
                  <span className="text-white font-display">
                    {a.wins}–{a.losses}–{a.draws}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          {/* Recent activity */}
          <section className="bg-surface border border-border">
            <header className="px-6 py-4 border-b border-border">
              <h2 className="font-display text-xl text-white tracking-wider">
                Recent approval activity
              </h2>
            </header>
            <ol className="divide-y divide-border">
              {recentAudit.length === 0 ? (
                <li className="px-6 py-5 text-sm text-muted">
                  No approvals yet.
                </li>
              ) : (
                recentAudit.map((row) => (
                  <li key={row.id} className="px-6 py-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm text-white">
                          {row.athlete.name}{" "}
                          <span
                            className={`inline-block text-[9px] font-display tracking-wider px-1.5 py-0.5 ml-1 ${
                              row.action === "approved"
                                ? "bg-emerald text-white"
                                : row.action === "rejected"
                                  ? "bg-red-500 text-white"
                                  : "bg-orange-500 text-white"
                            }`}
                          >
                            {row.action.toUpperCase()}
                          </span>
                        </p>
                        {row.note && (
                          <p className="text-xs text-muted mt-1">{row.note}</p>
                        )}
                      </div>
                      <span className="text-[10px] text-muted whitespace-nowrap">
                        {row.createdAt.toISOString().slice(0, 10)}
                      </span>
                    </div>
                  </li>
                ))
              )}
            </ol>
          </section>
        </div>

        {/* Recent bookings */}
        <section className="bg-surface border border-border">
          <header className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-display text-xl text-white tracking-wider">
              Recent class bookings
            </h2>
          </header>
          {recentBookings.length === 0 ? (
            <p className="px-6 py-5 text-sm text-muted">
              No bookings yet.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-[10px] text-gold font-display tracking-wider bg-surface-3">
                <tr>
                  <th className="px-6 py-3">When</th>
                  <th className="px-6 py-3">Class</th>
                  <th className="px-6 py-3">Gym</th>
                  <th className="px-6 py-3">Attendee</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="text-muted">
                {recentBookings.map((b) => (
                  <tr key={b.id} className="border-t border-border">
                    <td className="px-6 py-3 text-xs">
                      {b.createdAt.toISOString().slice(0, 10)}
                    </td>
                    <td className="px-6 py-3 text-white">{b.class.title}</td>
                    <td className="px-6 py-3">{b.class.gym.name}</td>
                    <td className="px-6 py-3">{b.guestName || "Member"}</td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-block text-[9px] font-display tracking-wider px-1.5 py-0.5 ${
                          b.status === "paid"
                            ? "bg-emerald text-white"
                            : "bg-gold text-bg"
                        }`}
                      >
                        {b.status.replace("_", " ").toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Quick links */}
        <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <QuickTile href="/portal/admin/fighters" title="Fighters" />
          <QuickTile href="/portal/admin/events" title="Events & bouts" />
          <QuickTile href="/portal/admin/rankings" title="Rankings" />
          <QuickTile href="/portal/admin/gyms" title="Gym enquiries" />
          <QuickTile href="/portal/admin/inbox" title="Inbox" />
        </section>

        <form action={signOutAction}>
          <button className="text-xs text-muted hover:text-white underline">
            Sign out
          </button>
        </form>
      </Container>
    </>
  );
}

// --- Fighter dashboard -----------------------------------------------------
async function FighterDashboard({ userId, name }: { userId: number; name: string }) {
  const profile = await prisma.fighterProfile.findFirst({
    where: { userId },
    include: {
      athlete: { include: { passport: true, rankings: true } },
      gym: true,
    },
  });

  return (
    <>
      <PageHeader eyebrow="Your corner" title={`Hi, ${name}`}>
        {profile?.approvalStatus === "approved"
          ? "Your profile is live. Keep your details up to date."
          : profile?.approvalStatus === "pending_approval"
            ? "Your application is awaiting administrator approval."
            : profile
              ? "Your application was not approved."
              : "No fighter profile linked to your account."}
      </PageHeader>
      <Container className="py-10 space-y-8">
        {profile && (
          <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
            {/* Fighter Card */}
            <aside className="relative overflow-hidden rounded-2xl border-2 border-gold/50 p-5 shadow-xl bg-gradient-to-br from-[#0a2f23] via-[#0b3d2e] to-[#07251b]">
              <div className="absolute top-3 right-3 text-right">
                <p className="font-display text-[10px] tracking-[0.3em] text-gold uppercase">
                  WUCO Fighter No
                </p>
                <p className="font-display text-xl text-white tracking-wider mt-0.5">
                  {profile.athlete.passport?.fighterNo ?? "— pending —"}
                </p>
              </div>
              <h2 className="font-display text-3xl text-white tracking-wider mt-10">
                {profile.athlete.name}
              </h2>
              {profile.athlete.nickname && (
                <p className="text-xs text-muted mt-1">
                  “{profile.athlete.nickname}”
                </p>
              )}
              <p className="text-xs text-muted mt-2">
                {profile.athlete.martialArt || "—"} ·{" "}
                {profile.athlete.classCode ?? "No class"} ·{" "}
                {profile.athlete.division}
              </p>
              <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                <div className="bg-black/30 border border-gold/30 rounded-lg py-3">
                  <div className="font-display text-3xl text-white">{profile.athlete.wins}</div>
                  <div className="text-[10px] tracking-wider text-gold">WINS</div>
                </div>
                <div className="bg-black/30 border border-gold/30 rounded-lg py-3">
                  <div className="font-display text-3xl text-white">{profile.athlete.losses}</div>
                  <div className="text-[10px] tracking-wider text-gold">LOSSES</div>
                </div>
                <div className="bg-black/30 border border-gold/30 rounded-lg py-3">
                  <div className="font-display text-3xl text-white">{profile.athlete.draws}</div>
                  <div className="text-[10px] tracking-wider text-gold">DRAWS</div>
                </div>
              </div>
              <p className="text-[10px] text-muted mt-4 text-center">
                Status:{" "}
                <span
                  className={`font-display tracking-wider ${
                    profile.approvalStatus === "approved"
                      ? "text-emerald-400"
                      : profile.approvalStatus === "pending_approval"
                        ? "text-gold"
                        : "text-red-400"
                  }`}
                >
                  {profile.approvalStatus.replace("_", " ")}
                </span>
              </p>
              <div className="flex gap-2 mt-5">
                {profile.athlete.passport?.fighterNo ? (
                  <Link
                    href={`/passport/${profile.athlete.passport.fighterNo}`}
                    target="_blank"
                    className="flex-1 bg-gold text-bg py-2.5 text-center font-display font-bold text-xs tracking-wider rounded-full hover:bg-gold-hi"
                  >
                    DIGITAL PASSPORT →
                  </Link>
                ) : (
                  <span className="flex-1 text-center text-[10px] text-muted py-2.5">
                    Passport issued on approval
                  </span>
                )}
                <Link
                  href="/portal/profile"
                  className="flex-1 border border-gold text-white py-2.5 text-center font-display font-bold text-xs tracking-wider rounded-full hover:bg-gold hover:text-bg"
                >
                  EDIT PROFILE →
                </Link>
              </div>
            </aside>

            {/* Side details */}
            <section className="space-y-4">
              <div className="bg-surface border border-border rounded-2xl p-6">
                <h3 className="font-display text-lg text-white tracking-wider mb-3">
                  Overview
                </h3>
                <dl className="grid grid-cols-2 gap-y-2 text-sm">
                  <dt className="text-muted">Record</dt>
                  <dd className="text-white font-display">
                    {profile.athlete.wins}–{profile.athlete.losses}–{profile.athlete.draws}
                  </dd>
                  <dt className="text-muted">Discipline</dt>
                  <dd className="text-white">
                    {profile.athlete.martialArt || "—"}
                  </dd>
                  <dt className="text-muted">Class</dt>
                  <dd className="text-white">
                    {profile.athlete.classCode ?? "—"}
                  </dd>
                  <dt className="text-muted">Division</dt>
                  <dd className="text-white">{profile.athlete.division}</dd>
                  <dt className="text-muted">Nationality</dt>
                  <dd className="text-white">{profile.athlete.country || "—"}</dd>
                  <dt className="text-muted">Gym</dt>
                  <dd className="text-white">{profile.gym?.name ?? "Independent"}</dd>
                </dl>
                {profile.reviewNote && (
                  <div className="mt-4 p-3 rounded-lg bg-black/30 border border-border text-xs text-muted">
                    Admin note: {profile.reviewNote}
                  </div>
                )}
              </div>
              <div className="bg-surface border border-border rounded-2xl p-6">
                <h3 className="font-display text-lg text-white tracking-wider mb-3">
                  Next steps
                </h3>
                <ul className="space-y-2 text-sm text-muted">
                  <li>— Browse <Link className="text-gold underline" href="/events">upcoming events</Link>.</li>
                  <li>— Explore <Link className="text-gold underline" href="/clubs">clubs</Link> near you.</li>
                  <li>— Keep your <Link className="text-gold underline" href="/portal/profile">profile</Link> up to date.</li>
                </ul>
              </div>
            </section>
          </div>
        )}
        <form action={signOutAction}>
          <button className="text-xs text-muted hover:text-white underline">
            Sign out
          </button>
        </form>
      </Container>
    </>
  );
}

// --- Components ------------------------------------------------------------
function Kpi({
  icon,
  value,
  label,
  href,
  accent,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  href?: string;
  accent?: "gold";
}) {
  const Tag = href ? Link : "div";
  return (
    <Tag
      // @ts-expect-error - Link href prop
      href={href}
      className={`block bg-surface border border-border p-5 transition-colors ${
        href ? "hover:border-gold" : ""
      } ${accent === "gold" ? "border-gold" : ""}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-gold">{icon}</span>
      </div>
      <div className="font-display text-4xl text-white mt-3">{value}</div>
      <div className="text-xs text-muted mt-1 tracking-wider uppercase">
        {label}
      </div>
    </Tag>
  );
}

function QuickTile({ href, title }: { href: string; title: string }) {
  return (
    <Link
      href={href}
      className="block bg-surface border border-border p-5 hover:border-gold transition-colors"
    >
      <h3 className="font-display text-base text-white tracking-wider">
        {title}
      </h3>
      <span className="text-gold text-xs font-display tracking-wider mt-2 inline-block">
        OPEN →
      </span>
    </Link>
  );
}

function StatusBreakdown({
  approved,
  pending,
  rejected,
}: {
  approved: number;
  pending: number;
  rejected: number;
}) {
  const total = approved + pending + rejected;
  if (total === 0) return <p className="text-sm text-muted">No applications yet.</p>;
  const pct = (n: number) => `${((n / total) * 100).toFixed(0)}%`;
  return (
    <div className="space-y-4">
      <div className="h-5 flex rounded overflow-hidden border border-border">
        <div
          style={{ width: pct(approved) }}
          title={`Approved ${approved}`}
          className="bg-emerald"
        />
        <div
          style={{ width: pct(pending) }}
          title={`Pending ${pending}`}
          className="bg-gold"
        />
        <div
          style={{ width: pct(rejected) }}
          title={`Rejected ${rejected}`}
          className="bg-red-500"
        />
      </div>
      <div className="grid grid-cols-3 gap-4 text-sm">
        <Legend color="bg-emerald" value={approved} label="Approved" />
        <Legend color="bg-gold" value={pending} label="Pending" />
        <Legend color="bg-red-500" value={rejected} label="Declined" />
      </div>
    </div>
  );
}

function Legend({
  color,
  value,
  label,
}: {
  color: string;
  value: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-block size-3 ${color}`} />
      <span className="text-white font-display">
        {value}
      </span>
      <span className="text-xs text-muted tracking-wider uppercase">
        {label}
      </span>
    </div>
  );
}
