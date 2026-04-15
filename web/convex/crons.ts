import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "check follow-ups",
  { hours: 6 },
  internal.followUpCron.checkAll
);

export default crons;
