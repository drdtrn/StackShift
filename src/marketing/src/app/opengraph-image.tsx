import { ImageResponse } from "next/og";

export const alt =
  "StackSift — AI root-cause analysis for your logs. Tell me what just broke.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0F1117",
          color: "#F1F3F9",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 32,
            color: "#8B90A7",
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          StackSift
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            marginTop: 32,
            fontSize: 84,
            fontWeight: 700,
            lineHeight: 1.05,
          }}
        >
          <span style={{ color: "#F1F3F9" }}>Tell me what&nbsp;</span>
          <span style={{ color: "#EF4444" }}>just broke.</span>
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 84,
            fontWeight: 700,
            lineHeight: 1.05,
            color: "#F1F3F9",
            marginTop: 8,
          }}
        >
          In plain English. In seconds.
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 32,
            marginTop: 48,
            color: "#8B90A7",
          }}
        >
          stacksift.io
        </div>
      </div>
    ),
    size,
  );
}
