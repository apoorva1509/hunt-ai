import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api.js";

const CONVEX_URL = process.env.CONVEX_URL ?? "";

let client: ConvexHttpClient | null = null;

function getClient(): ConvexHttpClient {
  if (!client) {
    if (!CONVEX_URL) throw new Error("CONVEX_URL not set");
    client = new ConvexHttpClient(CONVEX_URL);
  }
  return client;
}

export async function listAllContacts(): Promise<
  Array<{
    _id: string;
    companyId: string;
    email?: string;
    linkedinUrl?: string;
    name: string;
  }>
> {
  const c = getClient();
  return await c.query(api.outreachContacts.listAll, {});
}

export async function listMessagesByContact(contactId: string) {
  const c = getClient();
  return await c.query(api.outreachMessages.listByContact, {
    contactId: contactId as any,
  });
}

export async function createMessage(args: {
  contactId: string;
  companyId: string;
  channel: "email";
  body: string;
  sentAt: number;
  direction: "outbound" | "inbound";
  gmailMessageId: string;
  gmailThreadId?: string;
}) {
  const c = getClient();
  await c.mutation(api.outreachMessages.create, {
    contactId: args.contactId as any,
    companyId: args.companyId as any,
    channel: args.channel,
    body: args.body,
    sentAt: args.sentAt,
    direction: args.direction,
    gmailMessageId: args.gmailMessageId,
    gmailThreadId: args.gmailThreadId,
  });
}

export async function checkGmailMessageExists(
  gmailMessageId: string
): Promise<boolean> {
  const c = getClient();
  const result = await c.query(api.outreachMessages.getByGmailMessageId, {
    gmailMessageId,
  });
  return result !== null;
}
