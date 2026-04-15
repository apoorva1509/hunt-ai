import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

export const checkAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    const companies = await ctx.db.query("outreachCompanies").collect();
    const activeCompanies = companies.filter((c) => c.status === "active");

    for (const company of activeCompanies) {
      const contacts = await ctx.db
        .query("outreachContacts")
        .withIndex("by_company", (q) => q.eq("companyId", company._id))
        .collect();

      for (const contact of contacts) {
        if (contact.followUpEnabled === false) continue;

        const messages = await ctx.db
          .query("outreachMessages")
          .withIndex("by_contact", (q) => q.eq("contactId", contact._id))
          .order("desc")
          .take(1);

        const latestMessage = messages[0];
        if (!latestMessage) continue;

        // Auto-stop if latest message is inbound (they replied) — but not connection acceptances
        if (latestMessage.direction === "inbound" && latestMessage.channel !== "linkedin_connection") {
          await ctx.db.patch(contact._id, {
            followUpEnabled: false,
            followUpStoppedReason: "replied",
            updatedAt: now,
          });
          await ctx.scheduler.runAfter(
            0,
            internal.followUpReminders.dismissAllForContact,
            { contactId: contact._id }
          );
          continue;
        }

        // Check if follow-up is overdue
        const dueAt = latestMessage.sentAt + TWO_DAYS_MS;
        if (dueAt >= now) continue;

        // Check if an active reminder already exists
        const existingReminders = await ctx.db
          .query("followUpReminders")
          .withIndex("by_contact", (q) => q.eq("contactId", contact._id))
          .collect();

        const hasActiveReminder = existingReminders.some(
          (r) => r.status === "pending" || r.status === "notified"
        );

        if (hasActiveReminder) continue;

        // Determine channel from last outbound message
        let channel: "linkedin_dm" | "linkedin_connection" | "email";
        if (
          latestMessage.channel === "linkedin_dm" ||
          latestMessage.channel === "linkedin_connection" ||
          latestMessage.channel === "email"
        ) {
          channel = latestMessage.channel;
        } else {
          channel = "linkedin_dm";
        }

        await ctx.scheduler.runAfter(
          0,
          internal.followUpReminders.createReminder,
          {
            contactId: contact._id,
            companyId: company._id,
            channel,
            dueAt,
            lastOutboundMessageId: latestMessage._id,
          }
        );
      }
    }
  },
});
