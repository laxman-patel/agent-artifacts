import { CliError } from "./errors.js";

export function requirePositional(
  positionals: string[],
  index: number,
  name: string,
  example?: string
): string {
  const value = positionals[index];
  if (value === undefined) {
    const hint = example ? `\n  Example: ${example}` : "";
    throw new CliError("invalid_request", `Missing required argument <${name}>.${hint}`, 2);
  }
  return value;
}

export interface ResourceArgSpec {
  positionalIndex: number;
  optionKey: string;
  label: string;
  flag: string;
  example: string;
}

export function resolveResourceArg(
  positionals: string[],
  options: Record<string, unknown>,
  spec: ResourceArgSpec
): string {
  const fromPos = positionals[spec.positionalIndex];
  const fromFlag = options[spec.optionKey] as string | undefined;

  if (fromPos && fromFlag && fromPos !== fromFlag) {
    throw new CliError(
      "invalid_request",
      `Conflicting ${spec.label}: positional "${fromPos}" vs ${spec.flag} "${fromFlag}".\n  Example: ${spec.example}`,
      2
    );
  }

  const value = fromPos ?? fromFlag;
  if (!value) {
    throw new CliError(
      "invalid_request",
      `Missing required ${spec.label} (positional or ${spec.flag}).\n  Example: ${spec.example}`,
      2
    );
  }
  return value;
}

export interface PathArgSpec {
  positionalIndex: number;
  optionKey: string;
  label: string;
  flag: string;
}

export function resolvePathArg(
  positionals: string[],
  options: Record<string, unknown>,
  spec: PathArgSpec,
  example: string
): string {
  return resolveResourceArg(positionals, options, { ...spec, example });
}
