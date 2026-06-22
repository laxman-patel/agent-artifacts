export const RELEASE_TARGETS = [
  { platform: "linux-x64", bunTarget: "bun-linux-x64" },
  { platform: "linux-arm64", bunTarget: "bun-linux-arm64" },
  { platform: "darwin-x64", bunTarget: "bun-darwin-x64" },
  { platform: "darwin-arm64", bunTarget: "bun-darwin-arm64" }
] as const;

export type ReleasePlatform = (typeof RELEASE_TARGETS)[number]["platform"];

export interface ReleaseFileInfo {
  file: string;
  sha256: string;
  size: number;
}

export interface ReleaseBinaryAsset extends ReleaseFileInfo {
  target: (typeof RELEASE_TARGETS)[number]["bunTarget"];
}

export interface ReleaseSkillAsset extends ReleaseFileInfo {
  name: "agent-artifacts";
}

export interface ReleaseManifest {
  schemaVersion: 1;
  version: string;
  generatedAt: string;
  cli: {
    baseUrl: string;
    webUrl: string;
  };
  binaries: Record<ReleasePlatform, ReleaseBinaryAsset>;
  skill: ReleaseSkillAsset;
  installer: ReleaseFileInfo;
}

export function releaseBinaryName(version: string, platform: ReleasePlatform): string {
  return `artifacts-${version}-${platform}`;
}

export function releaseSkillArchiveName(version: string): string {
  return `agent-artifacts-skill-${version}.tar.gz`;
}

export function createReleaseManifest(args: {
  version: string;
  generatedAt: string;
  cli: ReleaseManifest["cli"];
  binaries: Record<ReleasePlatform, ReleaseFileInfo>;
  skill: ReleaseFileInfo;
  installer: ReleaseFileInfo;
}): ReleaseManifest {
  const binaries = Object.fromEntries(
    RELEASE_TARGETS.map((target) => [
      target.platform,
      {
        ...args.binaries[target.platform],
        target: target.bunTarget
      }
    ])
  ) as Record<ReleasePlatform, ReleaseBinaryAsset>;

  return {
    schemaVersion: 1,
    version: args.version,
    generatedAt: args.generatedAt,
    cli: args.cli,
    binaries,
    skill: {
      name: "agent-artifacts",
      ...args.skill
    },
    installer: args.installer
  };
}
