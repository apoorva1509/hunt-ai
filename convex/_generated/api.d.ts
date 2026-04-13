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
import type * as companyResearch from "../companyResearch.js";
import type * as connectResearch from "../connectResearch.js";
import type * as crons from "../crons.js";
import type * as followUpCron from "../followUpCron.js";
import type * as followUpReminders from "../followUpReminders.js";
import type * as helpers_access from "../helpers/access.js";
import type * as helpers_auth from "../helpers/auth.js";
import type * as helpers_encryption from "../helpers/encryption.js";
import type * as helpers_seeds from "../helpers/seeds.js";
import type * as http from "../http.js";
import type * as outreach from "../outreach.js";
import type * as outreachCompanies from "../outreachCompanies.js";
import type * as outreachConnect from "../outreachConnect.js";
import type * as outreachContacts from "../outreachContacts.js";
import type * as outreachGuidance from "../outreachGuidance.js";
import type * as outreachJobs from "../outreachJobs.js";
import type * as outreachMessages from "../outreachMessages.js";
import type * as outreachSeed from "../outreachSeed.js";
import type * as outreachSteps from "../outreachSteps.js";
import type * as outreachStrategies from "../outreachStrategies.js";
import type * as outreachSuggest from "../outreachSuggest.js";
import type * as people from "../people.js";
import type * as resumeVariations from "../resumeVariations.js";
import type * as secrets from "../secrets.js";
import type * as trackerUrls from "../trackerUrls.js";

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
  companyResearch: typeof companyResearch;
  connectResearch: typeof connectResearch;
  crons: typeof crons;
  followUpCron: typeof followUpCron;
  followUpReminders: typeof followUpReminders;
  "helpers/access": typeof helpers_access;
  "helpers/auth": typeof helpers_auth;
  "helpers/encryption": typeof helpers_encryption;
  "helpers/seeds": typeof helpers_seeds;
  http: typeof http;
  outreach: typeof outreach;
  outreachCompanies: typeof outreachCompanies;
  outreachConnect: typeof outreachConnect;
  outreachContacts: typeof outreachContacts;
  outreachGuidance: typeof outreachGuidance;
  outreachJobs: typeof outreachJobs;
  outreachMessages: typeof outreachMessages;
  outreachSeed: typeof outreachSeed;
  outreachSteps: typeof outreachSteps;
  outreachStrategies: typeof outreachStrategies;
  outreachSuggest: typeof outreachSuggest;
  people: typeof people;
  resumeVariations: typeof resumeVariations;
  secrets: typeof secrets;
  trackerUrls: typeof trackerUrls;
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
