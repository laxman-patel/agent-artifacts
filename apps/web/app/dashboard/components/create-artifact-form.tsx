"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { FormErrorMessage } from "../../components/form-error-message";
import { useDashboardWorkspace } from "./dashboard-workspace-data";
import { readApiFormError, type ApiFormError } from "../../../lib/api-error";

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function CreateArtifactForm({ initialProjectSlug }: { initialProjectSlug?: string }) {
  const router = useRouter();
  const { workspace, projects } = useDashboardWorkspace();
  const defaultProject = useMemo(
    () => projects.find((project) => project.slug === initialProjectSlug) ?? projects[0],
    [initialProjectSlug, projects]
  );
  const [projectSlug, setProjectSlug] = useState(defaultProject?.slug ?? "");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [type, setType] = useState<"md" | "html" | "jsx">("md");
  const [content, setContent] = useState("# New artifact\n\nStart writing here.");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<ApiFormError | null>(null);
  const [pending, setPending] = useState(false);

  function updateTitle(value: string) {
    setTitle(value);
    if (!slug) {
      setSlug(slugify(value));
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const response = await fetch("/api/artifacts", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ownerUsername: workspace.slug,
          projectSlug,
          slug,
          type,
          title,
          description: description.trim() || undefined,
          content
        })
      });

      if (!response.ok) {
        setError(await readApiFormError(response, "Could not create artifact."));
        setPending(false);
        return;
      }

      const body = (await response.json().catch(() => ({}))) as { url?: string };
      if (!body.url) {
        setError({ message: "Could not create artifact." });
        setPending(false);
        return;
      }

      router.push(new URL(body.url, window.location.origin).pathname);
      router.refresh();
    } catch (error) {
      setError({
        message: error instanceof Error ? `Could not create artifact: ${error.message}` : "Could not create artifact."
      });
      setPending(false);
    }
  }

  if (projects.length === 0) {
    return (
      <section className="card flat stack">
        <div className="section-header">
          <h2>No projects yet</h2>
          <p className="muted small">Create a project from the CLI or MCP before adding artifacts here.</p>
        </div>
      </section>
    );
  }

  return (
    <form className="card flat stack" onSubmit={(event) => void onSubmit(event)}>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="stack tight">
          <span className="label">Title</span>
          <input className="input" onChange={(event) => updateTitle(event.target.value)} required value={title} />
        </label>
        <label className="stack tight">
          <span className="label">Slug</span>
          <input
            autoCapitalize="none"
            className="input"
            onChange={(event) => setSlug(slugify(event.target.value))}
            pattern="[a-z0-9][a-z0-9-]*[a-z0-9]"
            required
            value={slug}
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="stack tight">
          <span className="label">Project</span>
          <select className="input" onChange={(event) => setProjectSlug(event.target.value)} required value={projectSlug}>
            {projects.map((project) => (
              <option key={project.id} value={project.slug}>
                {project.title}
              </option>
            ))}
          </select>
        </label>
        <label className="stack tight">
          <span className="label">Type</span>
          <select className="input" onChange={(event) => setType(event.target.value as typeof type)} value={type}>
            <option value="md">Markdown</option>
            <option value="html">HTML</option>
            <option value="jsx">JSX</option>
          </select>
        </label>
      </div>

      <label className="stack tight">
        <span className="label">Description</span>
        <input className="input" onChange={(event) => setDescription(event.target.value)} value={description} />
      </label>

      <label className="stack tight">
        <span className="label">Content</span>
        <textarea
          className="textarea min-h-72 font-mono text-sm"
          onChange={(event) => setContent(event.target.value)}
          required
          value={content}
        />
      </label>

      <FormErrorMessage error={error} />

      <div className="flex justify-end">
        <button
          className="inline-flex h-8 items-center gap-2 rounded-none border border-foreground/30 bg-[oklch(0.96_0_0)] px-3 font-pixel text-[13px] font-normal uppercase leading-none tracking-[-0.035em] text-primary-foreground shadow-[inset_0_0_0_1px_oklch(1_0_0_/_0.42),0_1px_0_oklch(1_0_0_/_0.18)] transition-colors hover:bg-[oklch(0.92_0_0)] disabled:cursor-wait disabled:opacity-70"
          disabled={pending}
          type="submit"
        >
          <span>{pending ? "Creating..." : "Create artifact"}</span>
          <Plus className="size-4 text-[var(--wb-accent-orange)]" strokeWidth={2} />
        </button>
      </div>
    </form>
  );
}
