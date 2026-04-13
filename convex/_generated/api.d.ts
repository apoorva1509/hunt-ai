/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agentActions from "../agentActions.js";
import type * as agentItems from "../agentItems.js";
import type * as agentRuns from "../agentRuns.js";
import type * as agentSkills from "../agentSkills.js";
import type * as agents from "../agents.js";
import type * as companies from "../companies.js";
import type * as connectionRequests from "../connectionRequests.js";
import type * as helpers_access from "../helpers/access.js";
import type * as helpers_auth from "../helpers/auth.js";
import type * as helpers_encryption from "../helpers/encryption.js";
import type * as helpers_seeds from "../helpers/seeds.js";
import type * as linkedinLog from "../linkedinLog.js";
import type * as outreachStrategies from "../outreachStrategies.js";
import type * as people from "../people.js";
import type * as personCompanyLinks from "../personCompanyLinks.js";
import type * as resumeVariations from "../resumeVariations.js";
import type * as secrets from "../secrets.js";
import type * as seed from "../seed.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agentActions: typeof agentActions;
  agentItems: typeof agentItems;
  agentRuns: typeof agentRuns;
  agentSkills: typeof agentSkills;
  agents: typeof agents;
  companies: typeof companies;
  connectionRequests: typeof connectionRequests;
  "helpers/access": typeof helpers_access;
  "helpers/auth": typeof helpers_auth;
  "helpers/encryption": typeof helpers_encryption;
  "helpers/seeds": typeof helpers_seeds;
  linkedinLog: typeof linkedinLog;
  outreachStrategies: typeof outreachStrategies;
  people: typeof people;
  personCompanyLinks: typeof personCompanyLinks;
  resumeVariations: typeof resumeVariations;
  secrets: typeof secrets;
  seed: typeof seed;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
