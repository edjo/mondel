export type MondelPullFormat = "ts" | "json";

export interface MondelPullConfig {
  uri?: string;
  format?: MondelPullFormat;
  outFile?: string;
  outDir?: string;
  perCollectionFiles?: boolean;
}

export interface MondelPushConfig {
  uri?: string;
  schemaFile?: string;
  manifestFile?: string;
  schemaExport?: string;
  applyValidators?: boolean;
  dropIndexes?: boolean;
  dryRun?: boolean;
}

export interface MondelCliConfig {
  uri?: string;
  pull?: MondelPullConfig;
  push?: MondelPushConfig;
}
