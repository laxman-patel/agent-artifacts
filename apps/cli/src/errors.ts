export type ErrorKind =
  | "auth"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "invalid_request"
  | "payload_too_large"
  | "network"
  | "unknown";

export class CliError extends Error {
  readonly kind: ErrorKind;
  readonly exitCode: number;
  readonly details?: unknown;

  constructor(kind: ErrorKind, message: string, exitCode: number, details?: unknown) {
    super(message);
    this.name = "CliError";
    this.kind = kind;
    this.exitCode = exitCode;
    this.details = details;
  }
}

export function errorKindFromApi(error: string | undefined): ErrorKind {
  switch (error) {
    case "forbidden":
      return "forbidden";
    case "not_found":
      return "not_found";
    case "conflict":
      return "conflict";
    case "invalid_request":
      return "invalid_request";
    case "payload_too_large":
      return "payload_too_large";
    case "csrf_blocked":
      return "auth";
    default:
      return "unknown";
  }
}

export function exitCodeForKind(kind: ErrorKind): number {
  switch (kind) {
    case "not_found":
      return 3;
    case "conflict":
      return 5;
    case "forbidden":
    case "auth":
      return 4;
    case "invalid_request":
    case "payload_too_large":
      return 2;
    case "network":
      return 69;
    default:
      return 1;
  }
}
