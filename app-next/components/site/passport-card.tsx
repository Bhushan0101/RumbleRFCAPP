"use client";

import * as React from "react";
import Image from "next/image";
import QRCode from "qrcode";

type Data = {
  fighterNo: string;
  name: string;
  division: string;
  classCode: string | null;
  martialArt: string;
  record: string;
  status: string;
  nationality: string;
  club: string;
  portraitUrl: string | null;
};

function QrCanvas({ text }: { text: string }) {
  const ref = React.useRef<HTMLCanvasElement>(null);
  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !text) return;
    QRCode.toCanvas(canvas, text, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 150,
      color: { dark: "#0b3d2e", light: "#ffffff" },
    });
  }, [text]);
  return <canvas ref={ref} className="w-[150px] h-[150px]" />;
}

export function PassportCard({ data }: { data: Data }) {
  const [origin, setOrigin] = React.useState("");
  React.useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  const qrUrl = origin
    ? `${origin}/passport/${encodeURIComponent(data.fighterNo)}`
    : "";
  const statusColor =
    data.status === "Active" ? "text-emerald-400" : "text-orange-300";

  return (
    <article className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#0a2f23] via-[#0b3d2e] to-[#07251b] shadow-[0_24px_60px_rgba(0,0,0,.55)] border-2 border-gold/40 p-6 md:p-10">
      <header className="flex flex-col items-center gap-2 mb-6 md:mb-8">
        <div className="flex items-center gap-4">
          <Image src="/brand/wuco-mark.png" alt="" width={54} height={54} />
          <h2 className="font-display font-black text-4xl md:text-5xl text-white tracking-widest">
            WUCO
            <sup className="text-xs text-gold ml-1">TM</sup>
          </h2>
          <Image src="/brand/wuco-mark.png" alt="" width={54} height={54} />
        </div>
        <p className="font-display text-[10px] tracking-[0.4em] text-center">
          WORLD UNITED COMBAT ORGANISATION ·{" "}
          <em className="not-italic text-gold">IRELAND</em>
        </p>
      </header>
      <h1 className="text-center font-display font-black text-2xl md:text-4xl tracking-wider mb-6 md:mb-8">
        DIGITAL FIGHTER <em className="not-italic text-gold">PASSPORT</em>
      </h1>
      <div className="grid gap-6 md:grid-cols-[220px_1fr_200px]">
        <div className="w-full md:aspect-[5/6] aspect-[4/3] bg-[#07251b] border-2 border-gold/80 grid place-items-center overflow-hidden">
          {data.portraitUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.portraitUrl}
              alt={data.name}
              className="object-cover w-full h-full"
            />
          ) : (
            <span className="font-display text-8xl text-muted/60">
              {data.name[0]?.toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-3">
          {([
            ["Name", data.name],
            ["Club", data.club],
            ["Division", data.division],
            ["Discipline", data.martialArt || "—"],
            ["Class", data.classCode || "—"],
            ["Record", data.record],
            ["Status", data.status],
            ["Nationality", data.nationality],
          ] as const).map(([label, value]) => (
            <div
              key={label}
              className="grid grid-cols-[120px_1fr] gap-3 pb-2 border-b border-gold/20"
            >
              <span className="font-display text-xs tracking-wider text-gold uppercase">
                {label}
              </span>
              <span
                className={`font-display text-lg tracking-wider ${
                  label === "Status" ? statusColor : "text-white"
                }`}
              >
                {value}
              </span>
            </div>
          ))}
        </div>
        <div className="flex flex-col items-center gap-4">
          <div className="w-20 h-14 rounded border border-gold/50 overflow-hidden grid grid-cols-3">
            <span className="bg-[#169b62]" />
            <span className="bg-white" />
            <span className="bg-[#ff883e]" />
          </div>
          <div className="w-full border-2 border-gold text-center p-3 bg-black/30">
            <p className="font-display text-[10px] tracking-wider text-gold">
              WUCO FIGHTER NO
            </p>
            <p className="font-display text-xl tracking-wider mt-1">
              {data.fighterNo}
            </p>
          </div>
          <div className="bg-white border-2 border-gold p-2">
            {qrUrl && <QrCanvas text={qrUrl} />}
          </div>
          <p className="text-center font-display text-[10px] tracking-wider text-gold max-w-[180px]">
            SCAN TO VERIFY FIGHTER RECORD AND RANKINGS
          </p>
        </div>
      </div>
      <footer className="mt-8 pt-5 border-t border-gold/30 text-center font-display text-xs tracking-wider text-[#cfe3d8]">
        OFFICIAL W.U.C.O IRELAND SPORTING CREDENTIAL
      </footer>
    </article>
  );
}
