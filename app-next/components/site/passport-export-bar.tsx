"use client";

import * as React from "react";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";

const EXPORT_WIDTH = 1800;
const EXPORT_HEIGHT = 1200;

export function PassportExportBar({
  fighterNo,
  name,
}: {
  fighterNo: string;
  name: string;
}) {
  const [busy, setBusy] = React.useState<null | "png" | "pdf">(null);

  async function renderCardPng(): Promise<string> {
    const node = document.querySelector("[data-passport-card]") as HTMLElement | null;
    if (!node) throw new Error("Passport card not found");
    const rect = node.getBoundingClientRect();
    const pixelRatio = Math.max(1, EXPORT_WIDTH / rect.width);
    return toPng(node, {
      pixelRatio,
      canvasWidth: EXPORT_WIDTH,
      canvasHeight: EXPORT_HEIGHT,
      cacheBust: true,
      backgroundColor: "#06261D",
    });
  }

  async function downloadPng() {
    setBusy("png");
    try {
      const dataUrl = await renderCardPng();
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${fighterNo}-${slug(name)}-passport.png`;
      a.click();
    } catch (err) {
      console.error(err);
      alert("Could not export PNG. Try reloading the page.");
    } finally {
      setBusy(null);
    }
  }

  async function downloadPdf() {
    setBusy("pdf");
    try {
      const dataUrl = await renderCardPng();
      // Landscape A4 → 297 × 210 mm. Fit the 3:2 image with a 10 mm margin.
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = 297;
      const pageH = 210;
      const margin = 10;
      const availW = pageW - margin * 2;
      const availH = pageH - margin * 2;
      // 3:2 aspect — width-constrained unless height caps out
      let w = availW;
      let h = (w * 2) / 3;
      if (h > availH) {
        h = availH;
        w = (h * 3) / 2;
      }
      const x = (pageW - w) / 2;
      const y = (pageH - h) / 2;
      pdf.addImage(dataUrl, "PNG", x, y, w, h, undefined, "FAST");
      pdf.save(`${fighterNo}-${slug(name)}-passport.pdf`);
    } catch (err) {
      console.error(err);
      alert("Could not export PDF. Try reloading the page.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 mb-6" data-export-bar>
      <button
        onClick={downloadPng}
        disabled={busy !== null}
        className="inline-flex items-center gap-2 bg-gold text-bg px-5 py-2.5 font-display font-bold text-xs tracking-wider uppercase rounded-full hover:bg-gold-hi disabled:opacity-50"
      >
        {busy === "png" ? "Exporting…" : "Download PNG"}
      </button>
      <button
        onClick={downloadPdf}
        disabled={busy !== null}
        className="inline-flex items-center gap-2 border border-gold text-white px-5 py-2.5 font-display font-bold text-xs tracking-wider uppercase rounded-full hover:bg-gold hover:text-bg disabled:opacity-50"
      >
        {busy === "pdf" ? "Exporting…" : "Download PDF"}
      </button>
      <button
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 border border-gold/40 text-white px-5 py-2.5 font-display font-bold text-xs tracking-wider uppercase rounded-full hover:border-gold"
      >
        Print
      </button>
    </div>
  );
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
