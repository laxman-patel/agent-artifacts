import Link from "next/link";
import type { CSSProperties } from "react";
import type { ApiFormError } from "../../lib/api-error";

export function FormErrorMessage({
  error,
  className = "error",
  style
}: {
  error: ApiFormError | null;
  className?: string;
  style?: CSSProperties;
}) {
  if (!error) {
    return null;
  }

  return (
    <p className={className} style={style}>
      {error.message}
      {error.upgradeHref ? (
        <>
          {" "}
          <Link href={error.upgradeHref}>Upgrade</Link>
        </>
      ) : null}
    </p>
  );
}
