"use client";

import * as React from "react";
import QRCode from "qrcode";
import { User, Shield, Users, Flag, Scale, Activity } from "lucide-react";
import { martialArtName, classDisplayName, martialArtRequiresClass } from "@/lib/martial-arts";

// Status mapping — maps real DB values (approved / pending_approval / rejected) to
// spec statuses (Active / Pending / Suspended) with the colour palette from the brief.
const STATUS_MAP: Record<string, { label: string; dot: string; text: string; bg: string; border: string }> = {
  Active:     { label: "ACTIVE",     dot: "#169b62", text: "#169b62", bg: "rgba(22,155,98,0.12)",  border: "rgba(22,155,98,0.55)" },
  Pending:    { label: "PENDING",    dot: "#D8B875", text: "#D8B875", bg: "rgba(216,184,117,0.12)", border: "rgba(216,184,117,0.55)" },
  Suspended:  { label: "SUSPENDED",  dot: "#dc2626", text: "#f87171", bg: "rgba(220,38,38,0.12)",   border: "rgba(220,38,38,0.55)" },
  Expired:    { label: "EXPIRED",    dot: "#dc2626", text: "#f87171", bg: "rgba(220,38,38,0.12)",   border: "rgba(220,38,38,0.55)" },
  Inactive:   { label: "INACTIVE",   dot: "#94a3b8", text: "#cbd5e1", bg: "rgba(148,163,184,0.12)", border: "rgba(148,163,184,0.55)" },
};

type DisciplineRow = {
  martialArt: string;
  classCode: string | null;
  wins: number;
  losses: number;
  draws: number;
  isPrimary: number;
};

type Data = {
  fighterNo: string;
  name: string;
  division: string;
  gender: string;
  classCode: string | null;
  martialArt: string;
  record: string;
  status: string; // one of STATUS_MAP keys
  nationality: string;
  club: string;
  portraitUrl: string | null;
  disciplines?: DisciplineRow[];
};

// Hard-coded Irish tricolour corner ribbon via SVG so it renders crisp at any size.
function TricolourRibbon({ corner }: { corner: "tl" | "br" }) {
  const rotate = corner === "tl" ? 0 : 180;
  return (
    <svg
      viewBox="0 0 160 160"
      aria-hidden
      className="absolute w-24 h-24 md:w-32 md:h-32 pointer-events-none"
      style={{
        [corner === "tl" ? "top" : "bottom"]: 0,
        [corner === "tl" ? "left" : "right"]: 0,
        transform: `rotate(${rotate}deg)`,
      }}
    >
      {/* Clipped triangle with three vertical stripes */}
      <defs>
        <clipPath id={`clip-${corner}`}>
          <polygon points="0,0 160,0 0,160" />
        </clipPath>
      </defs>
      <g clipPath={`url(#clip-${corner})`}>
        <rect x="0" y="0" width="54" height="160" fill="#169b62" />
        <rect x="54" y="0" width="52" height="160" fill="#ffffff" />
        <rect x="106" y="0" width="54" height="160" fill="#ff883e" />
      </g>
      {/* Gold edge along the diagonal */}
      <line x1="0" y1="160" x2="160" y2="0" stroke="#C8A45A" strokeWidth="2" opacity="0.8" />
    </svg>
  );
}

// Decorative laurel used either side of the footer text.
// Laurel component removed — footer is text-only.

function QrCanvas({ text }: { text: string }) {
  const ref = React.useRef<HTMLCanvasElement>(null);
  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !text) return;
    QRCode.toCanvas(canvas, text, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 180,
      color: { dark: "#06261D", light: "#ffffff" },
    });
  }, [text]);
  return <canvas ref={ref} className="w-full h-auto" style={{ aspectRatio: "1/1" }} />;
}

// Irish flag — removed from the card body. Corner tricolour ribbons carry the identity.

function FieldRow({
  icon: Icon,
  label,
  value,
  valueClass,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-gold/20 last:border-b-0 min-w-0">
      <Icon className="w-4 h-4 text-gold flex-shrink-0 mt-1" />
      <span className="font-display text-[10px] md:text-xs tracking-[0.18em] text-gold uppercase w-20 md:w-24 flex-shrink-0 mt-1">
        {label}
      </span>
      <span className={`font-display tracking-wider text-sm md:text-base break-words min-w-0 flex-1 ${valueClass ?? "text-white"}`}>
        {value}
      </span>
    </div>
  );
}

export function PassportCard({ data }: { data: Data }) {
  const [origin, setOrigin] = React.useState("");
  React.useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  const qrUrl = origin ? `${origin}/passport/${encodeURIComponent(data.fighterNo)}` : "";

  // Normalise and sort disciplines — primary first, rest alphabetical.
  const disciplines = React.useMemo(() => {
    const list = data.disciplines ?? [];
    return [...list].sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return b.isPrimary - a.isPrimary;
      return martialArtName(a.martialArt).localeCompare(martialArtName(b.martialArt));
    });
  }, [data.disciplines]);

  const status = STATUS_MAP[data.status] ?? STATUS_MAP.Pending;

  return (
    <article
      data-passport-card
      className="relative overflow-hidden rounded-2xl shadow-[0_30px_80px_rgba(0,0,0,0.6)]"
      style={{
        // Card sizes exactly to content — no slack space at the bottom.
        background: "linear-gradient(135deg, #0B3D2E 0%, #145240 55%, #06261D 100%)",
        border: "4px solid #C8A45A",
        boxShadow: "0 0 0 1px #06261D inset, 0 30px 80px rgba(0,0,0,0.6)",
      }}
    >
      {/* Boxing-ring arena backdrop, dimmed */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "url(/brand/arena.webp)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          opacity: 0.18,
          mixBlendMode: "screen",
        }}
      />
      {/* Carbon-fibre style texture using repeating gradients */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, rgba(255,255,255,0.025) 0 2px, transparent 2px 6px), repeating-linear-gradient(-45deg, rgba(0,0,0,0.12) 0 2px, transparent 2px 6px)",
        }}
      />
      {/* Inner gold border */}
      <div
        aria-hidden
        className="absolute inset-[6px] rounded-xl pointer-events-none"
        style={{ border: "1px solid rgba(200,164,90,0.45)" }}
      />

      <TricolourRibbon corner="tl" />
      <TricolourRibbon corner="br" />

      {/* Content grid — 3 columns: photo | centre | right (no + QR) */}
      <div className="relative grid grid-cols-1 md:grid-cols-[280px_minmax(0,1fr)_200px] gap-4 md:gap-6 p-5 md:p-8 pt-6 md:pt-7">
        {/* --- HEADER ROW spans all columns --- */}
        <header className="col-span-full flex flex-col items-center gap-2 pb-3 md:pb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/wuco-full-logo-white-on-transparent.png"
            alt="W.U.C.O — World United Combat Organisation · Ireland"
            className="h-12 md:h-16 w-auto"
          />
          {/* Gold banner with ornate flanking decoration */}
          <div className="relative flex items-center gap-3 md:gap-4 mt-1">
            <svg viewBox="0 0 48 24" aria-hidden className="h-5 w-10 text-gold" fill="currentColor">
              <polygon points="0,12 10,2 10,22" />
              <polygon points="14,12 24,4 24,20" opacity="0.7" />
            </svg>
            <div
              className="px-5 md:px-8 py-1.5 md:py-2 rounded-md"
              style={{
                background: "linear-gradient(180deg, #D8B875 0%, #C8A45A 55%, #8a6d2f 100%)",
                boxShadow: "0 3px 10px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.3)",
                border: "1px solid #8a6d2f",
              }}
            >
              <p
                className="font-display font-black text-base md:text-2xl tracking-[0.1em]"
                style={{ color: "#06261D" }}
              >
                DIGITAL FIGHTER{" "}
                <span className="text-white" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}>
                  PASSPORT
                </span>
              </p>
            </div>
            <svg viewBox="0 0 48 24" aria-hidden className="h-5 w-10 text-gold" fill="currentColor">
              <polygon points="48,12 38,2 38,22" />
              <polygon points="34,12 24,4 24,20" opacity="0.7" />
            </svg>
          </div>
        </header>

        {/* --- LEFT: PHOTO (large, stretches to centre column height) --- */}
        <div className="relative">
          <div
            className="w-full min-h-[380px] md:min-h-[480px] md:h-full rounded-md overflow-hidden grid place-items-center"
            style={{
              background: "linear-gradient(135deg, #06261D, #0B3D2E)",
              border: "3px solid #C8A45A",
              boxShadow: "0 6px 24px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(216,184,117,0.4)",
            }}
          >
            {data.portraitUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.portraitUrl}
                alt={data.name}
                crossOrigin="anonymous"
                className="object-cover w-full h-full"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-center p-4">
                {/* Silhouette fallback */}
                <svg viewBox="0 0 64 64" aria-hidden className="w-16 h-16 text-gold/30" fill="currentColor">
                  <circle cx="32" cy="22" r="12" />
                  <path d="M10 60 Q 10 38 32 38 Q 54 38 54 60 Z" />
                </svg>
                <span
                  className="font-display font-black text-5xl md:text-7xl"
                  style={{ color: "rgba(216,184,117,0.35)" }}
                >
                  {initials(data.name)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* --- CENTRE: fighter info + discipline table --- */}
        <section className="flex flex-col gap-3 md:gap-4 min-w-0">
          <div
            className="rounded-md p-3 md:p-4"
            style={{
              background: "rgba(6,38,29,0.55)",
              border: "1px solid rgba(200,164,90,0.3)",
            }}
          >
            <div className="flex flex-col">
              <FieldRow icon={User} label="Name" value={data.name} />
              <FieldRow icon={Shield} label="Club" value={data.club} />
              <FieldRow icon={Users} label="Gender" value={data.gender || "—"} />
              <FieldRow icon={Flag} label="Nationality" value={data.nationality} />
              <FieldRow icon={Scale} label="Division" value={data.division || "—"} />
              <FieldRow
                icon={Activity}
                label="Status"
                value={
                  <span
                    className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full border text-xs md:text-sm font-display tracking-wider whitespace-nowrap"
                    style={{
                      background: status.bg,
                      borderColor: status.border,
                      color: status.text,
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: status.dot }}
                    />
                    {status.label}
                  </span>
                }
              />
            </div>
          </div>

          {/* Discipline + Fight records table */}
          <div
            className="rounded-md p-3 md:p-4"
            style={{
              background: "rgba(6,38,29,0.55)",
              border: "1px solid rgba(200,164,90,0.3)",
            }}
          >
            <p className="font-display text-xs md:text-sm tracking-[0.2em] text-gold uppercase mb-2 flex items-center gap-2">
              <svg viewBox="0 0 24 24" aria-hidden className="w-4 h-4" fill="currentColor">
                <path d="M4 4h5l2 3h9v13H4z" />
              </svg>
              Disciplines &amp; Fight Records
            </p>
            {disciplines.length === 0 ? (
              <p className="text-xs text-white/50 italic">No disciplines registered.</p>
            ) : (
              <table className="w-full text-xs md:text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="font-display text-[10px] md:text-[11px] tracking-[0.15em] text-gold uppercase py-1.5 pr-2">
                      Discipline
                    </th>
                    <th className="font-display text-[10px] md:text-[11px] tracking-[0.15em] text-gold uppercase py-1.5 px-2">
                      Classification
                    </th>
                    <th className="font-display text-[10px] md:text-[11px] tracking-[0.15em] text-gold uppercase py-1.5 px-2">
                      Weight Division
                    </th>
                    <th className="font-display text-[10px] md:text-[11px] tracking-[0.15em] text-gold uppercase py-1.5 pl-2 text-right">
                      W-L-D
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {disciplines.map((d) => (
                    <tr key={d.martialArt} className="border-t border-gold/15">
                      <td className="py-1.5 pr-2">
                        <span className="font-display font-bold tracking-wider text-white uppercase">
                          {martialArtName(d.martialArt)}
                        </span>
                        {d.isPrimary === 1 && <PrimaryBadge />}
                      </td>
                      <td className="py-1.5 px-2 font-display tracking-wider text-gold uppercase">
                        {d.classCode && martialArtRequiresClass(d.martialArt)
                          ? classDisplayName(d.martialArt, d.classCode).replace(/\s*\(.*\)$/, "")
                          : "—"}
                      </td>
                      <td className="py-1.5 px-2 font-display tracking-wider text-white uppercase">
                        {formatDivisionShort(data.division)}
                      </td>
                      <td className="py-1.5 pl-2 font-display tracking-wider text-white text-right">
                        {d.wins}-{d.losses}-{d.draws}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="mt-2 pt-2 border-t border-gold/15 text-[10px] md:text-[11px] text-white/70 font-display tracking-wider flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1">
                <PrimaryBadge inline />
                = Primary Discipline
              </span>
              <span>W = Wins</span>
              <span>L = Losses</span>
              <span>D = Draws</span>
            </p>
          </div>
        </section>

        {/* --- RIGHT: fighter no · QR --- */}
        <aside className="flex flex-col items-center gap-3 md:gap-4">
          <div
            className="w-full text-center p-2 md:p-3 rounded-md"
            style={{
              background: "rgba(6,38,29,0.65)",
              border: "2px solid #C8A45A",
            }}
          >
            <p className="font-display text-[9px] md:text-[11px] tracking-[0.2em] text-gold uppercase">
              WUCO Fighter No.
            </p>
            <p className="font-display font-black text-base md:text-xl tracking-wider text-white mt-0.5">
              {data.fighterNo}
            </p>
          </div>
          <div
            className="w-full p-2 bg-white rounded-md"
            style={{ border: "2px solid #C8A45A" }}
          >
            {qrUrl && <QrCanvas text={qrUrl} />}
          </div>
          <p
            className="text-center font-display text-[9px] md:text-[11px] tracking-[0.15em] uppercase"
            style={{ color: "#D8B875" }}
          >
            Scan to verify
            <br />
            fighter record
          </p>
        </aside>

        {/* --- FOOTER — credential line only --- */}
        <footer className="col-span-full pt-3 md:pt-4">
          <div className="flex items-center justify-center">
            <p
              className="font-display font-bold text-[11px] md:text-sm tracking-[0.35em] whitespace-nowrap"
              style={{ color: "#F5F1E8", textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
            >
              OFFICIAL WUCO IRELAND SPORTING CREDENTIAL
            </p>
          </div>
        </footer>
      </div>
    </article>
  );
}

function PrimaryBadge({ inline = false }: { inline?: boolean }) {
  return (
    <span
      className={`${inline ? "" : "ml-2"} inline-flex items-center justify-center w-4 h-4 md:w-5 md:h-5 rounded-full font-display font-black text-[9px] md:text-[11px] align-middle`}
      style={{ background: "#C8A45A", color: "#06261D" }}
      aria-label="Primary discipline"
      title="Primary discipline"
    >
      P
    </span>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return `${first}${last}`.toUpperCase();
}

// Normalise "M-57kg" → "57 KG", "F-55kg" → "55 KG", "MMA-Lightweight" → "LIGHTWEIGHT".
function formatDivisionShort(div: string): string {
  if (!div) return "—";
  const m = div.match(/(\d+)\s*kg/i);
  if (m) return `${m[1]} KG`;
  const open = div.replace(/^MMA-/, "");
  return open.toUpperCase();
}
