"use client";

import { useState } from "react";

/** Klein event-logo voor de homepage. Toont de merk-afbeelding; laadt die niet
 *  (hotlink geblokkeerd, kapotte URL), dan valt hij terug op de sport-emoji. */
export default function Logo({
  src,
  emoji,
  className = "home__logo",
}: {
  src: string | null;
  emoji: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <span className={className} aria-hidden="true">
        {emoji}
      </span>
    );
  }

  return (
    <span className={`${className} ${className}--img`} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" onError={() => setFailed(true)} />
    </span>
  );
}
