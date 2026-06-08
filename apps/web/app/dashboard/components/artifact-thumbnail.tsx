"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import useMeasure from "react-use-measure";
import { wrapHtmlWithCsp } from "../../components/html-csp";
import { MarkdownViewer } from "../../components/markdown-viewer";
import { artifactKind } from "./artifact-kind";

// Logical render widths the preview is laid out at before being scaled down to
// the tile. HTML reads like a shrunk browser page; Markdown like a document
// column. Picked to look right at a ~280px tile.
const BASE_WIDTH: Record<string, number> = { html: 1180, md: 860 };

// Cap the source we hand to a thumbnail. A preview never needs the whole file,
// and oversized Markdown/JSX would render far more DOM than a tile shows.
const PREVIEW_CHARS = 24_000;
const thumbnailContentCache = new Map<string, string>();

type Status = "pending" | "loading" | "ready" | "empty" | "error";

export function ArtifactThumbnail({
  artifactId,
  cacheKey = artifactId,
  type,
  content
}: {
  artifactId: string;
  cacheKey?: string;
  type: string;
  content?: string;
}) {
  const initialContent = content ?? thumbnailContentCache.get(cacheKey) ?? null;
  const [boxRef, bounds] = useMeasure();
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [loaded, setLoaded] = useState<string | null>(initialContent);
  const [status, setStatus] = useState<Status>(initialContent !== null ? "ready" : "pending");
  const fetchedRef = useRef(false);

  const setRefs = useCallback(
    (element: HTMLDivElement | null) => {
      boxRef(element);
      setNode(element);
    },
    [boxRef]
  );

  useEffect(() => {
    if (content !== undefined || fetchedRef.current || !node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting) || fetchedRef.current) return;
        fetchedRef.current = true;
        observer.disconnect();
        setStatus("loading");

        void fetch(`/api/artifacts/${artifactId}/content`, { credentials: "include" })
          .then(async (response) => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.text();
          })
          .then((text) => {
            const trimmed = text.trim();
            if (trimmed.length > 0) thumbnailContentCache.set(cacheKey, trimmed);
            setLoaded(trimmed);
            setStatus(trimmed.length === 0 ? "empty" : "ready");
          })
          .catch((error) => {
            console.error("Artifact thumbnail failed to load", { artifactId, error });
            setStatus("error");
          });
      },
      { rootMargin: "200px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [artifactId, cacheKey, content, node]);

  const kind = artifactKind(type);
  // Fall back to an approximate tile size for the first paint so a preview is
  // never blank while ResizeObserver settles; the measured size corrects it.
  const width = bounds.width || 240;
  const height = bounds.height || 180;

  return (
    <div ref={setRefs} className="wb-thumb">
      {status === "ready" && loaded !== null ? (
        <ThumbnailBody type={type} content={loaded} width={width} height={height} />
      ) : status === "error" || status === "empty" ? (
        <div className="grid h-full place-items-center">
          <kind.Icon className="size-7" style={{ color: kind.accent, opacity: 0.5 }} aria-hidden />
        </div>
      ) : (
        <div className="wb-skeleton h-full w-full" />
      )}
    </div>
  );
}

function ThumbnailBody({
  type,
  content,
  width,
  height
}: {
  type: string;
  content: string;
  width: number;
  height: number;
}) {
  if (type === "html") {
    const base = BASE_WIDTH.html ?? 1180;
    const scale = width / base;
    return (
      <iframe
        title="Artifact preview"
        aria-hidden
        tabIndex={-1}
        referrerPolicy="no-referrer"
        sandbox=""
        srcDoc={wrapHtmlWithCsp(content)}
        className="wb-thumb-frame"
        style={{ width: base, height: height > 0 ? height / scale : 760, transform: `scale(${scale})` }}
      />
    );
  }

  if (type === "md") {
    const base = BASE_WIDTH.md ?? 860;
    const scale = width / base;
    return (
      <div
        className="wb-thumb-fade pointer-events-none origin-top-left bg-[var(--wb-tile)]"
        style={{ width: base, transform: `scale(${scale})` }}
      >
        <MarkdownViewer content={content.slice(0, PREVIEW_CHARS)} />
      </div>
    );
  }

  return (
    <pre className="wb-thumb-fade pointer-events-none m-0 h-full overflow-hidden whitespace-pre-wrap break-words p-3 font-mono text-[7px] leading-[1.5] text-foreground/65">
      {content.slice(0, PREVIEW_CHARS)}
    </pre>
  );
}
