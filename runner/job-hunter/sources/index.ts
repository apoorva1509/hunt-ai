import type { SourceAdapter, SourceId } from "./types.js";
import { linkedinSource } from "./linkedin.source.js";
import { ycWatsSource } from "./yc-wats.source.js";
import { wellfoundSource } from "./wellfound.source.js";
import { naukriSource } from "./naukri.source.js";
import { instahyreSource } from "./instahyre.source.js";
import { cutshortSource } from "./cutshort.source.js";
import { hnHiringSource } from "./hn-hiring.source.js";
import { topstartupsSource } from "./topstartups.source.js";

const registry = new Map<SourceId, SourceAdapter>([
  ["linkedin", linkedinSource],
  ["yc_wats", ycWatsSource],
  ["wellfound", wellfoundSource],
  ["naukri", naukriSource],
  ["instahyre", instahyreSource],
  ["cutshort", cutshortSource],
  ["hn_hiring", hnHiringSource],
  ["topstartups", topstartupsSource],
]);

export function getAdapter(id: SourceId): SourceAdapter {
  const adapter = registry.get(id);
  if (!adapter) throw new Error(`Unknown source: ${id}`);
  return adapter;
}

export { type SourceId, type SourceAdapter, type SourceQuery } from "./types.js";
export { ALL_SOURCES, SOURCE_NAMES } from "./types.js";
