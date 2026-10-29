"use client";

/** Opens the browser print dialog — "Save as PDF" is how owners file invoices. */
export default function PrintButton() {
  return (
    <button className="btn-flat" onClick={() => window.print()}>
      Print / Save PDF
    </button>
  );
}
