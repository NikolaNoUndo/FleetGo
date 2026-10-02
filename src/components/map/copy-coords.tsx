"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { usePrefs } from "../prefs";

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // older browsers / non-secure pages
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

export function CopyCoords({ lat, lng }: { lat: number; lng: number }) {
  const { locale } = usePrefs();
  const [copied, setCopied] = useState(false);
  const text = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  return (
    <button
      type="button"
      onClick={async () => {
        if (await copyText(text)) {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }
      }}
      title={locale === "sr" ? "Kopiraj koordinate" : "Copy coordinates"}
      className="group -mx-1 inline-flex items-center gap-1.5 rounded px-1 py-0.5 text-xs whitespace-nowrap text-ink-3 tnum hover:bg-surface-2 hover:text-ink"
    >
      {copied ? (
        <span className="text-good-ink">{locale === "sr" ? "Koordinate kopirane" : "Coordinates copied"}</span>
      ) : (
        <>
          {lat.toFixed(5)}, {lng.toFixed(5)}
        </>
      )}
      {copied ? <Check size={13} className="text-good" /> : <Copy size={13} className="text-ink-4 group-hover:text-ink-2" />}
    </button>
  );
}
