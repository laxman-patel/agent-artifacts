"use client";

function embedSrc(artifactId: string, version?: number | null): string {
  const params = new URLSearchParams({ artifactId });
  if (version != null) params.set("version", String(version));
  return `/embed/jsx?${params}`;
}

export function JsxViewer({ artifactId, version }: { artifactId: string; version?: number | null }) {
  return (
    <iframe
      className="artifact-frame"
      referrerPolicy="no-referrer"
      sandbox="allow-scripts"
      src={embedSrc(artifactId, version)}
      title="JSX component preview"
    />
  );
}
