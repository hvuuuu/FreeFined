import { siteConfig } from "@/lib/seo";
import { ImageResponse } from "next/og";

export const alt = "FreeFined - Free AI Image Enhancer and Background Remover";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#111111",
          color: "#ffffff",
          padding: 72,
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 18,
              background: "linear-gradient(135deg, #ef4444, #fb7185)",
              fontSize: 34,
              fontWeight: 800,
            }}
          >
            F
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <div style={{ fontSize: 34, fontWeight: 800 }}>
              {siteConfig.name}
            </div>
            <div style={{ color: "#d4d4d4", fontSize: 24 }}>
              Browser-based AI image tools
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 28,
          }}
        >
          <div
            style={{
              maxWidth: 900,
              fontSize: 76,
              fontWeight: 900,
              lineHeight: 0.95,
              letterSpacing: 0,
            }}
          >
            Free AI image enhancer and background remover
          </div>
          <div
            style={{
              display: "flex",
              gap: 14,
              color: "#ffffff",
              fontSize: 24,
              fontWeight: 700,
            }}
          >
            {["No account", "JPG, PNG, WEBP", "Runs in browser"].map(
              (label) => (
                <div
                  key={label}
                  style={{
                    border: "1px solid rgba(255,255,255,0.22)",
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.08)",
                    padding: "12px 20px",
                  }}
                >
                  {label}
                </div>
              ),
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: "#a3a3a3",
            fontSize: 22,
          }}
        >
          <span>{siteConfig.url.replace("https://", "")}</span>
          <span>Upscale. Denoise. Remove backgrounds.</span>
        </div>
      </div>
    ),
    size,
  );
}
