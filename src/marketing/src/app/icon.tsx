import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0F1117",
          color: "#EF4444",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22,
          fontWeight: 800,
          fontFamily: "system-ui, sans-serif",
          letterSpacing: -1,
        }}
      >
        S
      </div>
    ),
    size,
  );
}
