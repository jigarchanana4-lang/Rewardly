"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** The QR a café puts on the table so customers open the menu directly. */
export default function MenuQRCard({ url, name }: { url: string; name: string }) {
  const [dataUrl, setDataUrl] = useState("");

  useEffect(() => {
    QRCode.toDataURL(url, {
      width: 640,
      margin: 1,
      errorCorrectionLevel: "H",
      color: { dark: "#14093B", light: "#ffffff" },
    }).then(setDataUrl);
  }, [url]);

  return (
    <div className="card-pop text-center">
      <div className="label mb-2">Menu QR — put this on the table</div>
      {dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={dataUrl} alt={`Menu QR code for ${name}`} className="mx-auto h-48 w-48" />
      ) : (
        <div className="mx-auto h-48 w-48 animate-pulse rounded-md bg-surface-2" />
      )}
      <div className="mt-2 break-all font-mono text-xs text-ink-2">{url}</div>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <a href={dataUrl || "#"} download={`${name}-menu-qr.png`} className="btn-ghost">
          Download QR
        </a>
        <a href={url} target="_blank" rel="noopener" className="btn-flat">
          Preview menu
        </a>
      </div>
    </div>
  );
}
