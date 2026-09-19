"use client";

import { useEffect, useState } from "react";

/** Klein event-logo voor de homepage. Toont de merk-afbeelding; laadt die niet
 *  (hotlink geblokkeerd, kapotte URL), dan valt hij terug op de sport-emoji. */
export default function Logo({
  src,
  fallbackSrc = null,
  emoji,
  className = "home__logo",
}: {
  src: string | null;
  fallbackSrc?: string | null;
  emoji: string;
  className?: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  useEffect(() => setFailedUrl(null), [src, fallbackSrc]);

  const imageSrc = (src && failedUrl === src && fallbackSrc) || src || fallbackSrc;

  if (!imageSrc || failedUrl === imageSrc) {
    return (
      <span className={className} aria-hidden="true">
        {emoji}
      </span>
    );
  }

  return (
    <span className={`${className} ${className}--img`} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageSrc} alt="" onError={() => setFailedUrl(imageSrc)} />
    </span>
  );
}
