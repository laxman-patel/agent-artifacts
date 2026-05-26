"use client";

import { LogLevel } from "@logtail/next";
import { useLogger } from "@logtail/next/hooks";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();
  const log = useLogger({ source: "error.tsx" });

  useEffect(() => {
    log.logHttpRequest(
      LogLevel.error,
      "client_error_boundary",
      {
        host: window.location.href,
        path: pathname,
        statusCode: 500
      },
      {
        message: error.message,
        error: error.name,
        cause: error.cause,
        stack: error.stack,
        digest: error.digest
      }
    );
  }, [error, log, pathname]);

  return (
    <div className="site-main">
      <h1>Something went wrong</h1>
      <button type="button" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
