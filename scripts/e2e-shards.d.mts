// Types of e2e-shards.mjs for the TypeScript that imports it (playwright.config.ts).
export declare function parseShard(
  value: string | undefined,
): { current: number; total: number } | null;
export declare function shardFilter(
  ids: readonly string[],
  shard: { current: number; total: number },
): { grep?: RegExp; grepInvert?: RegExp };
export declare function checkGateShards(job: unknown): string[];
