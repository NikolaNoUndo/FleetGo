"use client";

import { useEffect } from "react";
import { Printer, X } from "lucide-react";

/** Opens the print dialog once the report has rendered; the bar itself never prints. */
export function PrintToolbar({ locale }: { locale: "sr" | "en" }) {
  const sr = locale === "sr";
  useEffect(() => {
    const id = setTimeout(() => window.print(), 400);
    return () => clearTimeout(id);
  }, []);
  return (
    <div className="mx-auto mb-4 flex max-w-[1120px] items-center justify-between gap-3 px-4 text-[13px] print:hidden">
      <span className="text-[#555]">{sr ? "U prozoru za štampu izaberi štampač ili „Sačuvaj kao PDF“." : "In the print dialog pick a printer or “Save as PDF”."}</span>
      <div className="flex gap-2">
        <button type="button" onClick={() => window.print()} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#4540d6] px-3 font-medium text-white">
          <Printer size={14} /> {sr ? "Štampaj" : "Print"}
        </button>
        <button type="button" onClick={() => window.close()} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#ccc] bg-white px-3 font-medium text-[#333]">
          <X size={14} /> {sr ? "Zatvori" : "Close"}
        </button>
      </div>
    </div>
  );
}
