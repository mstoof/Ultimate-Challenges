import { ImageResponse } from "next/og";

// Genereert het browser-tab-icoon: een pine badge met U boven C in hi-vis.
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#17251E",
          color: "#D9E021",
          borderRadius: 14,
          fontFamily: "sans-serif",
          fontWeight: 800,
          lineHeight: 0.86,
        }}
      >
        <div style={{ display: "flex", fontSize: 30 }}>U</div>
        <div style={{ display: "flex", fontSize: 30 }}>C</div>
      </div>
    ),
    { ...size }
  );
}
