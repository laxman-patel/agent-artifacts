"use client";

import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { readApiFormError, type ApiFormError } from "../../lib/api-error";
import { FormErrorMessage } from "./form-error-message";

export function AccessSettingsForm(props: {
  artifactId: string;
  initialPublicView: boolean;
  initialPublicEdit: boolean;
  initialViewerEmails: string[];
}) {
  const router = useRouter();
  const initialEmailsText = useMemo(() => props.initialViewerEmails.join("\n"), [props.initialViewerEmails]);
  const [publicView, setPublicView] = useState(props.initialPublicView);
  const [publicEdit, setPublicEdit] = useState(props.initialPublicEdit);
  const [viewerEmailsText, setViewerEmailsText] = useState(initialEmailsText);
  const [error, setError] = useState<ApiFormError | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const viewerEmails = viewerEmailsText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const response = await fetch(`/api/artifacts/${props.artifactId}/access`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        publicView,
        publicEdit,
        viewerEmails
      })
    });

    if (!response.ok) {
      setError(await readApiFormError(response, "Could not update access rules."));
      return;
    }

    router.refresh();
  }

  return (
    <form className="stack" onSubmit={(event) => void onSubmit(event)}>
      <label className="inline">
        <input checked={publicView} onChange={(event) => setPublicView(event.target.checked)} type="checkbox" />
        <span>Public view (anyone with the link can read)</span>
      </label>
      <label className="inline">
        <input checked={publicEdit} onChange={(event) => setPublicEdit(event.target.checked)} type="checkbox" />
        <span>Public edit (signed-in editors only, use carefully)</span>
      </label>
      <label className="stack tight">
        <span className="label">Viewer emails (restricted mode)</span>
        <textarea
          className="textarea"
          onChange={(event) => setViewerEmailsText(event.target.value)}
          placeholder={"friend@company.com\npartner@example.org"}
          rows={6}
          value={viewerEmailsText}
        />
        <span className="muted small">
          One email per line. Ignored when public viewing is enabled. Viewers are not emailed automatically; send them the artifact link.
        </span>
      </label>
      <FormErrorMessage error={error} />
      <button className="primary-button" type="submit">
        Save access rules
      </button>
    </form>
  );
}
