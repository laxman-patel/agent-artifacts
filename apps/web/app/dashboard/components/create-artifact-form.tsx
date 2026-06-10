"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { FormErrorMessage } from "../../components/form-error-message";
import { useDashboardWorkspace } from "./dashboard-workspace-data";
import { readApiFormError, type ApiFormError } from "../../../lib/api-error";
import type { ProjectSummary } from "../../../lib/server-api";

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
  const [availableProjects, setAvailableProjects] = useState(projects);
  const defaultProject = useMemo(
    () => availableProjects.find((project) => project.slug === initialProjectSlug) ?? availableProjects[0],
    [initialProjectSlug, availableProjects]
  );
  const [projectSlug, setProjectSlug] = useState(defaultProject?.slug ?? "");
  const [projectTitle, setProjectTitle] = useState("");
  const [newProjectSlug, setNewProjectSlug] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectError, setProjectError] = useState<ApiFormError | null>(null);
  const [projectPending, setProjectPending] = useState(false);
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

  function updateProjectTitle(value: string) {
    setProjectTitle(value);
    if (!newProjectSlug) {
      setNewProjectSlug(slugify(value));
    }
  }

  async function onCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProjectError(null);
    setProjectPending(true);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ownerUsername: workspace.slug,
          slug: newProjectSlug,
          title: projectTitle,
          description: projectDescription.trim() || undefined
        })
      });

      if (!response.ok) {
        setProjectError(await readApiFormError(response, "Could not create project."));
        return;
      }

      const created = (await response.json()) as Partial<ProjectSummary> & {
        projectId?: string;
        normalizedSlug?: string;
      };
      const createdSlug = created.slug ?? created.normalizedSlug ?? newProjectSlug;
      const project: ProjectSummary = {
        id: created.id ?? created.projectId ?? createdSlug,
        ownerUsername: created.ownerUsername ?? workspace.slug,
        workspaceId: created.workspaceId ?? workspace.id,
        workspaceSlug: created.workspaceSlug ?? workspace.slug,
        slug: createdSlug,
        title: created.title ?? projectTitle,
        description: created.description ?? null,
        updatedAt: created.updatedAt ?? new Date().toISOString()
      };

      setAvailableProjects((current) => [...current.filter((item) => item.slug !== project.slug), project]);
      setProjectSlug(project.slug);
      setProjectTitle("");
      setNewProjectSlug("");
      setProjectDescription("");
      router.refresh();
    } catch (error) {
      setProjectError({
        message: error instanceof Error ? `Could not create project: ${error.message}` : "Could not create project."
      });
    } finally {
      setProjectPending(false);
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

  const projectCreateForm = (
    <form className="card flat stack" onSubmit={(event) => void onCreateProject(event)}>
      <div className="section-header">
        <h2>New project</h2>
        <p className="muted small">Create a project here, then publish your first artifact into it.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="stack tight">
          <span className="label">Project name</span>
          <input className="input" onChange={(event) => updateProjectTitle(event.target.value)} required value={projectTitle} />
        </label>
        <label className="stack tight">
          <span className="label">Project slug</span>
          <input
            autoCapitalize="none"
            className="input"
            onChange={(event) => setNewProjectSlug(slugify(event.target.value))}
            pattern="[a-z0-9][a-z0-9-]*[a-z0-9]"
            required
            value={newProjectSlug}
          />
        </label>
      </div>
      <label className="stack tight">
        <span className="label">Description</span>
        <input className="input" onChange={(event) => setProjectDescription(event.target.value)} value={projectDescription} />
      </label>
      <FormErrorMessage error={projectError} />
      <div className="flex justify-end">
        <button className="primary-button" disabled={projectPending} type="submit">
          {projectPending ? "Creating..." : "Create project"}
        </button>
      </div>
    </form>
  );

  if (availableProjects.length === 0) {
    return projectCreateForm;
  }

  return (
    <>
      {projectCreateForm}
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
            {availableProjects.map((project) => (
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
    </>
  );
}
