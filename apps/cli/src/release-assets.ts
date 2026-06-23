export const MIN_NODE_MAJOR = 24;

export interface ReleaseFileInfo {
  file: string;
  sha256: string;
  size: number;
}

export interface ReleaseSkillAsset extends ReleaseFileInfo {
  name: "agent-artifacts";
}

export interface ReleaseManifest {
  schemaVersion: 2;
  version: string;
  generatedAt: string;
  node: {
    minMajor: typeof MIN_NODE_MAJOR;
  };
  cli: {
    baseUrl: string;
    webUrl: string;
  } & ReleaseFileInfo;
  skill: ReleaseSkillAsset;
  installer: ReleaseFileInfo;
}

export function releaseCliAssetName(version: string): string {
  return `artifacts-${version}`;
}

export function releaseSkillArchiveName(version: string): string {
  return `agent-artifacts-skill-${version}.tar.gz`;
}

export function createReleaseManifest(args: {
  version: string;
  generatedAt: string;
  cli: Pick<ReleaseManifest["cli"], "baseUrl" | "webUrl"> & ReleaseFileInfo;
  skill: ReleaseFileInfo;
  installer: ReleaseFileInfo;
}): ReleaseManifest {
  return {
    schemaVersion: 2,
    version: args.version,
    generatedAt: args.generatedAt,
    node: {
      minMajor: MIN_NODE_MAJOR
    },
    cli: args.cli,
    skill: {
      name: "agent-artifacts",
      ...args.skill
    },
    installer: args.installer
  };
}
