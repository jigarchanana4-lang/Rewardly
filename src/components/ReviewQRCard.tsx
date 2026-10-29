"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { BRAND } from "@/config/brand";

/**
 * The printable table card. Rendered to a canvas so the owner gets a single
 * high-resolution PNG they can hand to a printer — a screenshot of the page
 * would come out at screen resolution and look cheap on a table.
 */
export default function ReviewQRCard({
  url,
  shopName,
  prompt,
  brandColor,
}: {
  url: string;
  shopName: string;
  prompt: string;
  brandColor: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = 1200;
    const H = 1800;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    (async () => {
      const qr = await QRCode.toDataURL(url, {
        width: 700,
        margin: 1,
        errorCorrectionLevel: "H", // survives a coffee ring or a thumb
        color: { dark: "#14093B", light: "#ffffff" },
      });

      ctx.fillStyle = brandColor;
      ctx.fillRect(0, 0, W, H);

      // White card inset
      const m = 70;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(m, m, W - m * 2, H - m * 2);

      ctx.textAlign = "center";
      ctx.fillStyle = "#14093B";

      ctx.font = "800 68px ui-sans-serif, system-ui, sans-serif";
      wrap(ctx, prompt, W / 2, 300, W - 260, 82);

      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, (W - 700) / 2, 520, 700, 700);

        ctx.fillStyle = "#14093B";
        ctx.font = "700 54px ui-sans-serif, system-ui, sans-serif";
        ctx.fillText("Scan to leave a review", W / 2, 1360);

        ctx.fillStyle = "#5b4e8c";
        ctx.font = "400 40px ui-sans-serif, system-ui, sans-serif";
        ctx.fillText("Takes about 20 seconds", W / 2, 1425);

        ctx.fillStyle = brandColor;
        ctx.font = "800 46px ui-sans-serif, system-ui, sans-serif";
        wrap(ctx, shopName, W / 2, 1560, W - 260, 56);

        ctx.fillStyle = "#a99ade";
        ctx.font = "400 28px ui-sans-serif, system-ui, sans-serif";
        ctx.fillText(`Powered by ${BRAND.name}`, W / 2, 1680);

        setReady(true);
      };
      img.src = qr;
    })();
  }, [url, shopName, prompt, brandColor]);

  function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${shopName.toLowerCase().replace(/\s+/g, "-")}-review-card.png`;
    a.click();
  }

  return (
    <div className="card-pop">
      <div className="label mb-3">Your table card</div>
      <canvas
        ref={canvasRef}
        className="mx-auto h-auto w-full max-w-[280px] rounded-md border-2 border-edge"
      />
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="btn-brand flex-1" onClick={download} disabled={!ready}>
          {ready ? "Download card (PNG)" : "Preparing…"}
        </button>
        <button className="btn-flat" onClick={() => window.print()}>
          Print
        </button>
      </div>
      <p className="mt-3 text-xs font-medium text-ink-2">
        Print at A5 or bigger and stand it on the table or by the till.
      </p>
    </div>
  );
}

/** Canvas has no text wrapping, so lay the lines out manually. */
function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) {
  const words = text.split(" ");
  let line = "";
  const lines: string[] = [];
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lh));
}
