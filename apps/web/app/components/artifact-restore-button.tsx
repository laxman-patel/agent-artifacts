"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { readApiFormError, type ApiFormError } from "../../lib/api-error";
import { FormErrorMessage } from "./form-error-message";

export function ArtifactRestoreButton({
  artifactId,
  versionNumber
}: {
  artifactId: string;
  versionNumber: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiFormError | null>(null);

  async function restore() {
    setPending(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/artifacts/${encodeURIComponent(artifactId)}/versions/${encodeURIComponent(String(versionNumber))}/restore`,
        {
          method: "POST",
          credentials: "include"
        }
      );

      if (!response.ok) {
        setError(await readApiFormError(response, `Could not restore v${versionNumber}.`));
        return;
      }

      router.refresh();
    } catch (error) {
      setError({
        message: error instanceof Error ? `Could not restore v${versionNumber}: ${error.message}` : `Could not restore v${versionNumber}.`
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="stack tight">
      <button className="ghost-button" disabled={pending} onClick={() => void restore()} type="button">
        {pending ? "Restoring..." : "Restore"}
      </button>
      <FormErrorMessage error={error} className="error small" />
    </span>
  );
}
