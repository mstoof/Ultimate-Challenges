/** Het logo van Ultimate Challenges: een badge met U boven C. Schaalt scherp
 *  mee als SVG en gebruikt de merkkleuren pine + hi-vis. */
export default function Brand({ size = 44 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label="Ultimate Challenges"
    >
      <rect width="48" height="48" rx="11" fill="#17251E" />
      <text
        x="24"
        y="22"
        textAnchor="middle"
        fontFamily="'Barlow Condensed', sans-serif"
        fontWeight="700"
        fontSize="23"
        letterSpacing="1"
        fill="#D9E021"
      >
        U
      </text>
      <text
        x="24"
        y="42"
        textAnchor="middle"
        fontFamily="'Barlow Condensed', sans-serif"
        fontWeight="700"
        fontSize="23"
        letterSpacing="1"
        fill="#D9E021"
      >
        C
      </text>
    </svg>
  );
}
