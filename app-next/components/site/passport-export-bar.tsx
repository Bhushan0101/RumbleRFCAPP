"use client";

import * as React from "react";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";

// Export the card at a fixed desktop width so the 3-column layout kicks in,
// regardless of the user's actual viewport. We clone the card into an
// off-screen wrapper sized to this width, render, then clean up.
const EXPORT_WIDTH = 1800;

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

    // Build a fixed-width off-screen stage so mobile viewports render the
    // same 3-column layout the design targets. Without this, mobile
    // exports only capture the stacked column that fits the viewport width
    // and the generated PDF ends up as a thin slice.
    const stage = document.createElement("div");
    stage.style.cssText = [
      "position: fixed",
      "top: 0",
      "left: 0",
      `width: ${EXPORT_WIDTH}px`,
      "pointer-events: none",
      "opacity: 0", // invisible but still laid out
      "z-index: -1",
      "background: #06261D",
    ].join("; ");

    // Tailwind's `md:*` classes depend on the viewport, not the element width,
    // so a cloned card on a 400-px-wide phone would still render stacked. We
    // inject CSS that reproduces the desktop layout on the cloned subtree.
    const style = document.createElement("style");
    style.textContent = `
      [data-export-stage] [data-passport-card] > .relative.grid {
        grid-template-columns: 280px minmax(0, 1fr) 200px !important;
        gap: 1.5rem !important;
        padding: 2rem !important;
        padding-top: 1.75rem !important;
      }
      [data-export-stage] [data-passport-card] header.col-span-full {
        padding-bottom: 1rem !important;
      }
      [data-export-stage] [data-passport-card] header img { height: 4rem !important; }
      [data-export-stage] [data-passport-card] aside .w-full > p { font-size: 1.25rem !important; }
      [data-export-stage] [data-passport-card] .md\\:w-32 { width: 8rem !important; }
      [data-export-stage] [data-passport-card] .md\\:h-32 { height: 8rem !important; }
      [data-export-stage] [data-passport-card] .md\\:min-h-\\[480px\\] { min-height: 480px !important; }
      [data-export-stage] [data-passport-card] .md\\:text-2xl { font-size: 1.5rem !important; }
      [data-export-stage] [data-passport-card] .md\\:text-xl { font-size: 1.25rem !important; }
      [data-export-stage] [data-passport-card] .md\\:text-base { font-size: 1rem !important; }
      [data-export-stage] [data-passport-card] .md\\:text-sm { font-size: 0.875rem !important; }
      [data-export-stage] [data-passport-card] .md\\:text-\\[11px\\] { font-size: 11px !important; }
      [data-export-stage] [data-passport-card] .md\\:p-4 { padding: 1rem !important; }
      [data-export-stage] [data-passport-card] .md\\:p-8 { padding: 2rem !important; }
      [data-export-stage] [data-passport-card] .md\\:px-8 { padding-left: 2rem !important; padding-right: 2rem !important; }
      [data-export-stage] [data-passport-card] .md\\:py-2 { padding-top: 0.5rem !important; padding-bottom: 0.5rem !important; }
      [data-export-stage] [data-passport-card] .md\\:gap-6 { gap: 1.5rem !important; }
      [data-export-stage] [data-passport-card] .md\\:gap-4 { gap: 1rem !important; }
      [data-export-stage] [data-passport-card] .md\\:pb-4 { padding-bottom: 1rem !important; }
      [data-export-stage] [data-passport-card] .md\\:pt-4 { padding-top: 1rem !important; }
      [data-export-stage] [data-passport-card] .md\\:pt-7 { padding-top: 1.75rem !important; }
      [data-export-stage] [data-passport-card] .md\\:w-24 { width: 6rem !important; }
      [data-export-stage] [data-passport-card] .md\\:h-16 { height: 4rem !important; }
      [data-export-stage] [data-passport-card] .md\\:h-full { height: 100% !important; }
      [data-export-stage] [data-passport-card] .md\\:w-5 { width: 1.25rem !important; }
      [data-export-stage] [data-passport-card] .md\\:h-5 { height: 1.25rem !important; }
      [data-export-stage] [data-passport-card] .md\\:p-3 { padding: 0.75rem !important; }
      [data-export-stage] [data-passport-card] .md\\:w-24.md\\:h-24,
      [data-export-stage] [data-passport-card] .md\\:w-32.md\\:h-32 {
        width: 8rem !important; height: 8rem !important;
      }
    `;
    stage.appendChild(style);
    stage.setAttribute("data-export-stage", "");
    const clone = node.cloneNode(true) as HTMLElement;
    // Force the cloned card to the full stage width.
    clone.style.width = `${EXPORT_WIDTH}px`;
    clone.style.maxWidth = "none";

    // Fix: the first inner `.relative.grid` must use the 3-column desktop
    // layout. Tailwind's `md:grid-cols-[...]` only activates on wide viewports,
    // so force it inline here.
    const innerGrid = clone.querySelector<HTMLElement>(":scope > .relative.grid");
    if (innerGrid) {
      innerGrid.style.gridTemplateColumns = "280px minmax(0, 1fr) 200px";
      innerGrid.style.gap = "1.5rem";
      innerGrid.style.padding = "2rem";
      innerGrid.style.paddingTop = "1.75rem";
    }
    // Make the portrait area tall enough to fill the centre column.
    const portraitWrap = clone.querySelector<HTMLElement>(
      "[data-passport-card] > .relative.grid > .relative > .w-full",
    );
    if (portraitWrap) {
      portraitWrap.style.minHeight = "480px";
    }
    stage.appendChild(clone);
    document.body.appendChild(stage);

    // Preserve pixel-perfect image dimensions — copy portrait src so the
    // cloned <img> reloads cleanly.
    try {
      // Wait a frame so the clone computes its real height at this width.
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      await new Promise((r) => setTimeout(r, 50));
      // Wait for images inside the clone to finish loading.
      const imgs = Array.from(clone.querySelectorAll("img"));
      await Promise.all(
        imgs.map((img) =>
          img.complete && img.naturalWidth > 0
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                img.addEventListener("load", () => resolve(), { once: true });
                img.addEventListener("error", () => resolve(), { once: true });
                // Safety timeout — don't block export on a slow image.
                setTimeout(resolve, 3000);
              }),
        ),
      );
      const rect = clone.getBoundingClientRect();
      const dataUrl = await toPng(clone, {
        pixelRatio: 2,
        width: Math.ceil(rect.width),
        height: Math.ceil(rect.height),
        cacheBust: true,
        backgroundColor: "#06261D",
        // Skip fonts that we can't load as CSS (lucide icons are inline SVG).
        skipFonts: false,
      });
      return dataUrl;
    } finally {
      stage.remove();
    }
  }

  async function downloadPng() {
    setBusy("png");
    try {
      const dataUrl = await renderCardPng();
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${fighterNo}-${slug(name)}-passport.png`;
      // Mobile Safari needs the link to be in the DOM to trigger a download.
      document.body.appendChild(a);
      a.click();
      a.remove();
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
      // Measure the generated PNG so the PDF fits the actual aspect ratio
      // (not a hard-coded 3:2). This matters when the card's content height
      // changes — e.g. different discipline counts.
      const { w: imgWpx, h: imgHpx } = await measureImage(dataUrl);
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = 297;
      const pageH = 210;
      const margin = 10;
      const availW = pageW - margin * 2;
      const availH = pageH - margin * 2;
      const ratio = imgWpx / imgHpx;
      // Fit the image inside the available area while preserving its ratio.
      let w = availW;
      let h = w / ratio;
      if (h > availH) {
        h = availH;
        w = h * ratio;
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

function measureImage(src: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => reject(new Error("Could not read exported image."));
    img.src = src;
  });
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
