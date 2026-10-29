"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** Renders the shop's scan URL as a QR (what the physical stand shows). */
export default function QRCodeCard({ url, name }: { url: string; name: string }) {
  const [dataUrl, setDataUrl] = useState<string>("");

  useEffect(() => {
    QRCode.toDataURL(url, { width: 320, margin: 1, color: { dark: "#14093B", light: "#ffffff" } }).then(
      setDataUrl,
    );
  }, [url]);

  return (
    <div className="card-pop text-center">
      <div className="label mb-2">Your QR — print it or use the free stand</div>
      {dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={dataUrl} alt={`QR code for ${name}`} className="mx-auto h-56 w-56" />
      ) : (
        <div className="mx-auto h-56 w-56 animate-pulse rounded-2xl bg-surface-2" />
      )}
      <div className="mt-2 break-all font-mono text-xs text-ink-2">{url}</div>
      <a href={dataUrl} download={`${name}-qr.png`} className="btn-ghost mt-3 inline-flex">
        Download QR
      </a>
    </div>
  );
}
