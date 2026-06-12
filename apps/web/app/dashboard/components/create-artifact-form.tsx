"use client";

import { useRouter } from "next/navigation";
import { FileUp, Plus, X } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { FormErrorMessage } from "../../components/form-error-message";
import { useDashboardWorkspace } from "./dashboard-workspace-data";
import { readApiFormError, type ApiFormError } from "../../../lib/api-error";

type ArtifactType = "md" | "html" | "jsx";

const TYPE_LABEL: Record<ArtifactType, string> = {
  md: "Markdown",
  html: "HTML",
  jsx: "JSX"
};

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function inferType(fileName: string, content: string): ArtifactType {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "html";
  if (lower.endsWith(".jsx") || lower.endsWith(".tsx")) return "jsx";
  if (/<html[\s>]/i.test(content) || /<!doctype html/i.test(content)) return "html";
  return "md";
}

function titleFromFile(fileName: string, content: string): string {
  const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (heading) return heading.slice(0, 200);
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .slice(0, 200);
}

export function CreateArtifactForm({ initialProjectSlug }: { initialProjectSlug?: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const { workspace, projects } = useDashboardWorkspace();
  const initialProject = projects.find((project) => project.slug === initialProjectSlug) ?? projects[0];

  const [fileName, setFileName] = useState("");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [type, setType] = useState<ArtifactType>("md");
  const [content, setContent] = useState("");
  const [projectSlug, setProjectSlug] = useState(initialProject?.slug ?? "");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiFormError | null>(null);

  const hasFile = content.trim().length > 0;
  const selectedProject = projects.find((project) => project.slug === projectSlug) ?? projects[0];

  async function loadFile(file: File) {
    const text = await file.text();
    const inferredTitle = titleFromFile(file.name, text);
    setFileName(file.name);
    setTitle(inferredTitle);
    setSlug(slugify(inferredTitle || file.name));
    setType(inferType(file.name, text));
    setContent(text);
    setError(null);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files[0];
    if (file) void loadFile(file);
  }

  function openProjectDialog() {
    if (!hasFile) {
      setError({ message: "Drop a file first." });
      return;
    }
    if (projects.length === 0) {
      setError({ message: "Create a project from the sidebar first." });
      return;
    }
    setProjectSlug(selectedProject?.slug ?? projects[0]?.slug ?? "");
    setDialogOpen(true);
  }

  async function createArtifact() {
    if (!selectedProject) return;
    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/workspaces/${encodeURIComponent(workspace.id)}/artifacts`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectSlug: selectedProject.slug,
          slug,
          type,
          title,
          content
        })
      });

      if (!response.ok) {
        setError(await readApiFormError(response, "Could not create artifact."));
        setPending(false);
        return;
      }

      const body = (await response.json().catch(() => ({}))) as { artifact?: { url?: string }; url?: string };
      const url = body.artifact?.url ?? body.url;
      if (!url) {
        setError({ message: "Could not create artifact." });
        setPending(false);
        return;
      }

      router.push(new URL(url, window.location.origin).pathname);
      router.refresh();
    } catch (error) {
      setError({
        message: error instanceof Error ? `Could not create artifact: ${error.message}` : "Could not create artifact."
      });
      setPending(false);
    }
  }

  return (
    <div className="relative">
      <div
        data-active={dragActive}
        onDragLeave={() => setDragActive(false)}
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDrop={onDrop}
        className="grid min-h-[22rem] place-items-center border border-dashed border-[var(--wb-line-strong)] px-6 py-12 text-center transition-colors data-[active=true]:border-[var(--wb-accent-orange)] data-[active=true]:bg-[color-mix(in_oklch,var(--wb-accent-orange)_7%,transparent)]"
      >
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept=".md,.markdown,.html,.htm,.jsx,.tsx,text/markdown,text/html,text/plain"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void loadFile(file);
          }}
        />

        <div className="max-w-xl">
          <FileUp className="mx-auto size-9 text-[var(--wb-accent-orange)]" />
          <h2 className="mt-5 font-pixel text-[1.75rem] font-normal tracking-[-0.045em] text-foreground/92">
            Drop an artifact file here.
          </h2>
          <p className="mx-auto mt-3 max-w-[54ch] text-sm leading-6 text-foreground/50">
            HTML, Markdown, and JSX files are read locally, then Artifacts infers the type, title, and slug before upload.
          </p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="primary-button mt-6 inline-flex items-center gap-2 rounded-none border px-3 py-2 font-pixel text-[13px] uppercase tracking-[-0.035em]"
          >
            Choose file
            <Plus className="size-4" />
          </button>
        </div>
      </div>

      {hasFile ? (
        <div className="mt-8 grid gap-6 border-t border-[var(--wb-line)] pt-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="grid gap-4 sm:grid-cols-[1fr_14rem_8rem]">
            <label className="space-y-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-foreground/35">Title</span>
              <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label className="space-y-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-foreground/35">Slug</span>
              <input className="input font-mono" value={slug} onChange={(event) => setSlug(slugify(event.target.value))} />
            </label>
            <label className="space-y-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-foreground/35">Type</span>
              <select className="input" value={type} onChange={(event) => setType(event.target.value as ArtifactType)}>
                <option value="md">Markdown</option>
                <option value="html">HTML</option>
                <option value="jsx">JSX</option>
              </select>
            </label>
          </div>
          <button
            type="button"
            onClick={openProjectDialog}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-none border border-foreground/30 bg-[oklch(0.96_0_0)] px-4 font-pixel text-[13px] font-normal uppercase leading-none tracking-[-0.035em] text-primary-foreground shadow-[inset_0_0_0_1px_oklch(1_0_0_/_0.42),0_1px_0_oklch(1_0_0_/_0.18)] transition-colors hover:bg-[oklch(0.92_0_0)]"
          >
            Add
            <Plus className="size-4 text-[var(--wb-accent-orange)]" />
          </button>
          <p className="font-mono text-[11px] text-foreground/38 sm:col-span-3 lg:col-span-2">
            {fileName} · {TYPE_LABEL[type]} · {content.length.toLocaleString()} chars
          </p>
        </div>
      ) : null}

      <FormErrorMessage error={error} className="mt-4" />

      {dialogOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/62 px-4" role="dialog" aria-modal="true" aria-label="Choose project">
          <div className="workbench w-full max-w-2xl rounded-[0.625rem] border border-[var(--wb-line-strong)] bg-[var(--wb-tile-raised)] p-5 text-foreground shadow-[0_22px_60px_oklch(0.08_0_0/0.55)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-foreground/35">Save to project</p>
                <h2 className="mt-2 font-pixel text-[1.6rem] font-normal tracking-[-0.045em]">Choose a destination.</h2>
              </div>
              <button
                type="button"
                aria-label="Close project chooser"
                onClick={() => setDialogOpen(false)}
                className="grid size-8 place-items-center rounded-[0.3rem] text-foreground/45 transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {projects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  data-selected={project.slug === projectSlug}
                  onClick={() => setProjectSlug(project.slug)}
                  className="flex items-center gap-3 rounded-[0.45rem] border border-[var(--wb-line)] bg-[var(--wb-canvas)] p-3 text-left transition-colors hover:border-foreground/25 data-[selected=true]:border-[var(--wb-accent-orange)] data-[selected=true]:bg-[color-mix(in_oklch,var(--wb-accent-orange)_8%,var(--wb-canvas))]"
                >
                  <span className="grid size-8 place-items-center rounded-[0.35rem] bg-foreground/[0.05] text-[15px] text-[var(--wb-accent-orange)]">
                    {project.icon ?? "✦"}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground/88">{project.title}</span>
                    <span className="mt-0.5 block truncate font-mono text-[11px] text-foreground/38">/{project.slug}</span>
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                disabled={pending || !selectedProject}
                onClick={() => void createArtifact()}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-none border border-foreground/30 bg-[oklch(0.96_0_0)] px-4 font-pixel text-[13px] font-normal uppercase leading-none tracking-[-0.035em] text-primary-foreground shadow-[inset_0_0_0_1px_oklch(1_0_0_/_0.42),0_1px_0_oklch(1_0_0_/_0.18)] transition-colors hover:bg-[oklch(0.92_0_0)] disabled:cursor-wait disabled:opacity-70"
              >
                {pending ? "Adding..." : "Add artifact"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
