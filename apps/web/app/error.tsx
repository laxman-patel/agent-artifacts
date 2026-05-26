"use client";

import { useLogger } from "@logtail/next/hooks";
import { useEffect } from "react";

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const log = useLogger();

  useEffect(() => {
    log.error("client_error_boundary", {
      message: error.message,
      digest: error.digest,
      stack: error.stack
    });
  }, [error, log]);

  return (
    <div className="site-main">
      <h1>Something went wrong</h1>
      <button type="button" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
