"use client";

import { useState } from "react";

/** Kopieert een kant-en-klaar blok (naam, wanneer, locatie, beschrijving + link)
 *  naar het klembord, zodat je het zo in een WhatsApp-event kunt plakken. */
export default function CopyEventButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" onClick={copy} className="btn">
      {copied ? "Gekopieerd ✓" : "Kopieer voor WhatsApp-event"}
    </button>
  );
}
