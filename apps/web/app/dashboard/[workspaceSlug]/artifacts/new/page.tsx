import Link from "next/link";
import { CreateArtifactForm } from "../../../components/create-artifact-form";

export default async function NewArtifactPage(props: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ project?: string }>;
}) {
  const { workspaceSlug } = await props.params;
  const { project } = await props.searchParams;

  return (
    <main className="mx-auto w-full max-w-[980px] px-6 pb-24 pt-16 sm:px-10 lg:pt-12">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-[var(--wb-line)] pb-6">
        <div>
          <h1 className="font-pixel text-[2rem] font-normal leading-none tracking-[-0.045em] text-foreground/95">
            Create artifact
          </h1>
          <p className="mt-3 max-w-[60ch] text-sm leading-relaxed text-foreground/50">
            Add a Markdown, HTML, or JSX artifact directly to this library.
          </p>
        </div>
        <Link className="ghost-button" href={`/dashboard/${workspaceSlug}`}>
          Cancel
        </Link>
      </header>

      <CreateArtifactForm initialProjectSlug={project} />
    </main>
  );
}
