import type { CSSProperties } from "react";
import type { PublicArtifactPreview } from "./artifact-preview";

export const OG_IMAGE_SIZE = {
  width: 1200,
  height: 630
};

const palette = {
  background: "#080706",
  panel: "#14110d",
  panelRaised: "#1d1710",
  line: "rgba(255, 237, 204, 0.16)",
  lineStrong: "rgba(255, 169, 88, 0.48)",
  text: "#fff5e6",
  muted: "rgba(255, 245, 230, 0.62)",
  dim: "rgba(255, 245, 230, 0.36)",
  orange: "#ff9a3d",
  amber: "#f3c774"
};

const rootStyle: CSSProperties = {
  position: "relative",
  display: "flex",
  width: "100%",
  height: "100%",
  overflow: "hidden",
  background: `radial-gradient(circle at 78% 12%, rgba(255,154,61,0.28), transparent 30%), linear-gradient(135deg, ${palette.background} 0%, #120f0c 48%, #060504 100%)`,
  color: palette.text,
  fontFamily: "Geist"
};

const gridStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  backgroundImage:
    "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
  backgroundSize: "48px 48px",
  opacity: 0.45
};

const shellStyle: CSSProperties = {
  position: "relative",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  width: "100%",
  height: "100%",
  padding: "64px 72px"
};

const topRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  width: "100%"
};

const brandStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 16,
  color: palette.muted,
  fontSize: 25,
  letterSpacing: "-0.03em"
};

const markStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 46,
  height: 46,
  border: `1px solid ${palette.lineStrong}`,
  borderRadius: 14,
  background: "rgba(255,154,61,0.12)",
  color: palette.orange,
  fontFamily: "Geist Mono",
  fontSize: 25
};

const badgeStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  border: `1px solid ${palette.line}`,
  borderRadius: 999,
  background: "rgba(255,255,255,0.035)",
  padding: "10px 16px",
  color: palette.muted,
  fontFamily: "Geist Mono",
  fontSize: 18,
  letterSpacing: "0.04em",
  textTransform: "uppercase"
};

const titleStyle: CSSProperties = {
  display: "flex",
  maxWidth: 790,
  color: palette.text,
  fontSize: 68,
  fontWeight: 650,
  letterSpacing: "-0.055em",
  lineHeight: 0.94
};

const descriptionStyle: CSSProperties = {
  display: "flex",
  maxWidth: 730,
  color: palette.muted,
  fontSize: 28,
  letterSpacing: "-0.025em",
  lineHeight: 1.28
};

const artifactPreviewPanelStyle: CSSProperties = {
  position: "absolute",
  right: 72,
  bottom: 66,
  display: "flex",
  flexDirection: "column",
  width: 410,
  minHeight: 265,
  border: `1px solid ${palette.line}`,
  borderRadius: 28,
  background: `linear-gradient(180deg, ${palette.panelRaised}, ${palette.panel})`,
  boxShadow: "0 28px 80px rgba(0,0,0,0.38)",
  overflow: "hidden"
};

const panelHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "18px 20px",
  borderBottom: `1px solid ${palette.line}`
};

const dotStyle: CSSProperties = {
  display: "flex",
  width: 9,
  height: 9,
  borderRadius: 999,
  background: palette.orange
};

const codeStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 11,
  padding: "20px",
  color: "rgba(255,245,230,0.68)",
  fontFamily: "Geist Mono",
  fontSize: 18,
  lineHeight: 1.32
};

const footerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  color: palette.dim,
  fontFamily: "Geist Mono",
  fontSize: 18
};

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Latest version";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function previewLines(preview: PublicArtifactPreview): string[] {
  const lines = preview.sourceLines.length > 0 ? preview.sourceLines : [preview.excerpt || preview.description];
  return lines.map((line) => (line.length > 72 ? `${line.slice(0, 69)}...` : line));
}

function Brand() {
  return (
    <div style={brandStyle}>
      <div style={markStyle}>A</div>
      <div style={{ display: "flex" }}>Artifacts</div>
    </div>
  );
}

function Background() {
  return (
    <>
      <div style={gridStyle} />
      <div
        style={{
          position: "absolute",
          right: -70,
          top: 84,
          display: "flex",
          width: 420,
          height: 420,
          border: `1px solid ${palette.lineStrong}`,
          borderRadius: 999,
          opacity: 0.42
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 116,
          top: 186,
          display: "flex",
          width: 74,
          height: 360,
          background: "linear-gradient(180deg, rgba(255,154,61,0.9), rgba(255,154,61,0.08))",
          transform: "rotate(34deg)",
          opacity: 0.5
        }}
      />
    </>
  );
}

export function GenericOgCard() {
  return (
    <div style={rootStyle}>
      <Background />
      <div style={shellStyle}>
        <div style={topRowStyle}>
          <Brand />
          <div style={badgeStyle}>Link preview</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={titleStyle}>Agent-native artifact hosting</div>
          <div style={descriptionStyle}>
            Open hosted HTML reports, Markdown specs, and JSX prototypes with permanent URLs and access control.
          </div>
        </div>

        <div style={footerStyle}>
          <div style={{ display: "flex", width: 42, height: 2, background: palette.orange }} />
          <div style={{ display: "flex" }}>Private artifacts stay private in social previews</div>
        </div>
      </div>
    </div>
  );
}

export function ArtifactOgCard({ preview }: { preview: PublicArtifactPreview }) {
  const lines = previewLines(preview);

  return (
    <div style={rootStyle}>
      <Background />
      <div style={shellStyle}>
        <div style={topRowStyle}>
          <Brand />
          <div style={badgeStyle}>{preview.typeLabel} artifact</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={titleStyle}>{preview.title}</div>
          <div style={descriptionStyle}>{preview.description}</div>
        </div>

        <div style={footerStyle}>
          <div style={{ display: "flex", width: 42, height: 2, background: palette.orange }} />
          <div style={{ display: "flex" }}>
            {preview.ownerUsername}/{preview.projectSlug} · Updated {formatDate(preview.updatedAt)}
          </div>
        </div>
      </div>

      <div style={artifactPreviewPanelStyle}>
        <div style={panelHeaderStyle}>
          <div style={dotStyle} />
          <div style={{ ...dotStyle, background: palette.amber, opacity: 0.72 }} />
          <div style={{ ...dotStyle, background: "rgba(255,245,230,0.32)" }} />
          <div style={{ display: "flex", marginLeft: 12, color: palette.dim, fontFamily: "Geist Mono", fontSize: 15 }}>
            {preview.path}
          </div>
        </div>
        <div style={codeStyle}>
          {lines.map((line, index) => (
            <div key={`${line}-${index}`} style={{ display: "flex" }}>
              <span style={{ color: "rgba(255,154,61,0.72)", marginRight: 12 }}>
                {String(index + 1).padStart(2, "0")}
              </span>
              <span>{line}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
