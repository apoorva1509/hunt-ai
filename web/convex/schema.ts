import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  people: defineTable({
    clerkTokenIdentifier: v.optional(v.string()),
    email: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    name: v.optional(v.string()),
    pictureUrl: v.optional(v.string()),
    source: v.union(
      v.literal("anonymous"),
      v.literal("clerk_signup"),
      v.literal("agent_discovered"),
      v.literal("manual")
    ),
    updatedAt: v.number(),
  })
    .index("by_clerk_token", ["clerkTokenIdentifier"])
    .index("by_email", ["email"])
    .index("by_linkedin", ["linkedinUrl"]),

  companies: defineTable({
    clerkUserId: v.optional(v.string()),
    domain: v.string(),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    iconUrl: v.optional(v.string()),
    primaryColor: v.optional(v.string()),
    city: v.optional(v.string()),
    country: v.optional(v.string()),
    foundedYear: v.optional(v.number()),
    employees: v.optional(v.number()),
    industries: v.optional(v.array(v.string())),
    socialLinks: v.optional(
      v.array(v.object({ name: v.string(), url: v.string() }))
    ),
    brandfetchId: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
  })
    .index("by_clerk_user", ["clerkUserId"])
    .index("by_domain", ["domain"]),

  personCompanyLinks: defineTable({
    personId: v.id("people"),
    companyId: v.id("companies"),
    type: v.union(
      v.literal("employee"),
      v.literal("contractor"),
      v.literal("intern"),
      v.literal("founder"),
      v.literal("investor"),
      v.literal("board_member"),
      v.literal("advisor"),
      v.literal("client"),
      v.literal("vendor"),
      v.literal("candidate"),
      v.literal("recruiter"),
      v.literal("hiring_manager"),
      v.literal("referral")
    ),
    status: v.union(
      v.literal("active"),
      v.literal("past"),
      v.literal("prospective")
    ),
    title: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    endedAt: v.optional(v.number()),
    source: v.optional(
      v.union(
        v.literal("clerk_signup"),
        v.literal("agent_discovered"),
        v.literal("linkedin"),
        v.literal("manual")
      )
    ),
    notes: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_person", ["personId"])
    .index("by_company", ["companyId"])
    .index("by_person_and_company", ["personId", "companyId"])
    .index("by_person_and_status", ["personId", "status"])
    .index("by_company_and_type", ["companyId", "type"]),

  agents: defineTable({
    ownerPersonId: v.id("people"),
    name: v.string(),
    type: v.union(
      v.literal("job_hunter"),
      v.literal("crypto_trader"),
      v.literal("outreach_scout"),
      v.literal("contact_crafter")
    ),
    status: v.union(
      v.literal("active"),
      v.literal("paused"),
      v.literal("archived")
    ),
    config: v.any(),
    isPublished: v.optional(v.boolean()),
    description: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerPersonId"])
    .index("by_owner_and_status", ["ownerPersonId", "status"])
    .index("by_published", ["isPublished"]),

  agentAccess: defineTable({
    agentId: v.id("agents"),
    personId: v.optional(v.id("people")),
    companyId: v.optional(v.id("companies")),
    grantedBy: v.id("people"),
  })
    .index("by_agent", ["agentId"])
    .index("by_person", ["personId"])
    .index("by_company", ["companyId"]),

  agentForks: defineTable({
    sourceAgentId: v.id("agents"),
    forkedAgentId: v.id("agents"),
    forkedByPersonId: v.id("people"),
    forkedAt: v.number(),
  })
    .index("by_source", ["sourceAgentId"])
    .index("by_forked_agent", ["forkedAgentId"])
    .index("by_person", ["forkedByPersonId"])
    .index("by_source_and_person", ["sourceAgentId", "forkedByPersonId"]),

  agentRuns: defineTable({
    agentId: v.id("agents"),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    triggeredBy: v.union(
      v.literal("schedule"),
      v.literal("manual"),
      v.literal("webhook")
    ),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    summary: v.optional(v.string()),
    error: v.optional(v.string()),
  })
    .index("by_agent", ["agentId"])
    .index("by_agent_and_status", ["agentId", "status"]),

  agentItems: defineTable({
    agentId: v.id("agents"),
    runId: v.optional(v.id("agentRuns")),
    type: v.union(
      v.literal("job_lead"),
      v.literal("contact"),
      v.literal("outreach_draft"),
      v.literal("reply"),
      v.literal("trade_signal"),
      v.literal("trade_order"),
      v.literal("signal"),
      v.literal("company_analysis"),
      v.literal("target_company")
    ),
    parentId: v.optional(v.id("agentItems")),
    personId: v.optional(v.id("people")),
    companyId: v.optional(v.id("companies")),
    title: v.string(),
    subtitle: v.optional(v.string()),
    status: v.union(
      v.literal("new"),
      v.literal("approved"),
      v.literal("actioned"),
      v.literal("done"),
      v.literal("skipped"),
      v.literal("failed")
    ),
    userStatus: v.optional(v.string()),
    data: v.any(),
    actions: v.optional(v.array(v.string())),
    updatedAt: v.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_agent_and_type", ["agentId", "type"])
    .index("by_agent_and_status", ["agentId", "status"])
    .index("by_run", ["runId"])
    .index("by_parent", ["parentId"])
    .index("by_person", ["personId"])
    .index("by_company", ["companyId"]),

  outreachStrategies: defineTable({
    agentId: v.id("agents"),
    name: v.string(),
    description: v.string(),
    angle: v.string(),
    templateNotes: v.string(),
    channel: v.union(
      v.literal("linkedin"),
      v.literal("email"),
      v.literal("whatsapp")
    ),
    goal: v.union(
      v.literal("intro_call"),
      v.literal("connection"),
      v.literal("referral"),
      v.literal("direct_apply"),
      v.literal("reply")
    ),
    regionHints: v.array(v.string()),
    isActive: v.boolean(),
    sortOrder: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_agent_and_channel", ["agentId", "channel"]),

  connectionRequests: defineTable({
    agentId: v.id("agents"),
    personId: v.id("people"),
    companyId: v.id("companies"),
    contactRole: v.string(),
    contactType: v.union(
      v.literal("recruiter"),
      v.literal("hiring_manager"),
      v.literal("peer"),
      v.literal("founder"),
      v.literal("executive"),
      v.literal("other")
    ),
    sentDate: v.number(),
    status: v.union(
      v.literal("suggested"),
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("ignored")
    ),
    noteWithRequest: v.boolean(),
    messageSent: v.boolean(),
    messageDate: v.optional(v.number()),
    linkedToLeadId: v.optional(v.id("agentItems")),
    notes: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_company", ["companyId"])
    .index("by_agent_and_status", ["agentId", "status"])
    .index("by_agent_and_company", ["agentId", "companyId"]),

  agentSkills: defineTable({
    agentId: v.id("agents"),
    skillRef: v.string(),
    isBaseline: v.boolean(),
    isActive: v.boolean(),
    sortOrder: v.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_agent_and_ref", ["agentId", "skillRef"]),

  agentActions: defineTable({
    agentId: v.id("agents"),
    actionRef: v.string(),
    isEnabled: v.boolean(),
    sortOrder: v.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_agent_and_ref", ["agentId", "actionRef"]),

  agentSecrets: defineTable({
    agentId: v.id("agents"),
    key: v.string(),
    iv: v.string(),
    ciphertext: v.string(),
    updatedAt: v.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_agent_and_key", ["agentId", "key"]),

  trackerUrls: defineTable({
    agentId: v.id("agents"),
    url: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("evaluated"),
      v.literal("failed"),
      v.literal("skipped")
    ),
    title: v.optional(v.string()),
    company: v.optional(v.string()),
    score: v.optional(v.number()),
    archetype: v.optional(v.string()),
    location: v.optional(v.string()),
    workMode: v.optional(v.string()),
    salary: v.optional(v.string()),
    notes: v.optional(v.string()),
    reportPath: v.optional(v.string()),
    error: v.optional(v.string()),
    addedAt: v.number(),
    processedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_agent_and_status", ["agentId", "status"])
    .index("by_url", ["url"]),

  resumeVariations: defineTable({
    agentId: v.id("agents"),
    archetype: v.string(),
    googleDocId: v.string(),
    googleDocUrl: v.string(),
    title: v.string(),
    lastSyncedAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_agent_and_archetype", ["agentId", "archetype"]),

  outreachCompanies: defineTable({
    name: v.string(),
    domain: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    isYcBacked: v.boolean(),
    fundingStage: v.optional(v.string()),
    description: v.optional(v.string()),
    userId: v.string(),
    status: v.union(
      v.literal("active"),
      v.literal("paused"),
      v.literal("closed")
    ),
    roleAppliedFor: v.optional(v.string()),
    employeeCount: v.optional(v.number()),
    industry: v.optional(v.string()),
    careersUrl: v.optional(v.string()),
    researchStatus: v.optional(v.union(
      v.literal("pending"),
      v.literal("researching"),
      v.literal("done"),
      v.literal("failed")
    )),
    researchSummary: v.optional(v.string()),
    resumeStorageId: v.optional(v.id("_storage")),
    resumeFileName: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_status", ["userId", "status"])
    .index("by_user_and_domain", ["userId", "domain"]),

  outreachContacts: defineTable({
    companyId: v.id("outreachCompanies"),
    name: v.string(),
    title: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    profilePictureUrl: v.optional(v.string()),
    headline: v.optional(v.string()),
    source: v.union(
      v.literal("manual"),
      v.literal("apollo"),
      v.literal("linkedin")
    ),
    apolloData: v.optional(v.any()),
    followUpEnabled: v.optional(v.boolean()),
    followUpStoppedReason: v.optional(
      v.union(
        v.literal("manual"),
        v.literal("replied"),
        v.literal("closed")
      )
    ),
    tier: v.optional(v.union(
      v.literal("tier1"),
      v.literal("tier2"),
      v.literal("tier3")
    )),
    connectionStatus: v.optional(v.union(
      v.literal("pending"),
      v.literal("accepted")
    )),
    updatedAt: v.number(),
  })
    .index("by_company", ["companyId"])
    .index("by_linkedin_url", ["linkedinUrl"]),

  outreachSteps: defineTable({
    companyId: v.id("outreachCompanies"),
    label: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("done"),
      v.literal("skipped")
    ),
    order: v.number(),
    isAutoGenerated: v.optional(v.boolean()),
    updatedAt: v.number(),
  })
    .index("by_company", ["companyId"]),

  outreachMessages: defineTable({
    contactId: v.id("outreachContacts"),
    companyId: v.id("outreachCompanies"),
    channel: v.union(
      v.literal("linkedin_dm"),
      v.literal("linkedin_connection"),
      v.literal("email"),
      v.literal("whatsapp")
    ),
    body: v.string(),
    sentAt: v.number(),
    direction: v.union(v.literal("outbound"), v.literal("inbound")),
    gmailMessageId: v.optional(v.string()),
    gmailThreadId: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_contact", ["contactId"])
    .index("by_company", ["companyId"])
    .index("by_gmail_message_id", ["gmailMessageId"]),

  outreachGuidance: defineTable({
    contactId: v.id("outreachContacts"),
    channel: v.union(
      v.literal("linkedin"),
      v.literal("email"),
      v.literal("whatsapp")
    ),
    guidance: v.string(),
    updatedAt: v.number(),
  })
    .index("by_contact", ["contactId"])
    .index("by_contact_and_channel", ["contactId", "channel"]),

  followUpReminders: defineTable({
    contactId: v.id("outreachContacts"),
    companyId: v.id("outreachCompanies"),
    channel: v.union(
      v.literal("linkedin_dm"),
      v.literal("linkedin_connection"),
      v.literal("email")
    ),
    dueAt: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("notified"),
      v.literal("acted"),
      v.literal("dismissed")
    ),
    lastOutboundMessageId: v.optional(v.id("outreachMessages")),
    updatedAt: v.number(),
  })
    .index("by_contact", ["contactId"])
    .index("by_status", ["status"])
    .index("by_company", ["companyId"])
    .index("by_due", ["dueAt"]),

  outreachJobs: defineTable({
    companyId: v.id("outreachCompanies"),
    title: v.string(),
    url: v.string(),
    source: v.union(
      v.literal("linkedin"),
      v.literal("careers_page"),
      v.literal("greenhouse"),
      v.literal("lever"),
      v.literal("ashby"),
      v.literal("workable"),
      v.literal("yc"),
      v.literal("wellfound"),
      v.literal("instahyre"),
      v.literal("naukri")
    ),
    location: v.optional(v.string()),
    workMode: v.optional(v.union(
      v.literal("remote"),
      v.literal("hybrid"),
      v.literal("onsite"),
      v.literal("unknown")
    )),
    status: v.union(
      v.literal("new"),
      v.literal("applied"),
      v.literal("skipped")
    ),
    description: v.optional(v.string()),
    postedAt: v.optional(v.number()),
    appliedAt: v.optional(v.number()),
    appliedVia: v.optional(v.string()),
    appliedNotes: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_company", ["companyId"])
    .index("by_status", ["status"])
    .index("by_company_and_status", ["companyId", "status"]),

  connectResearch: defineTable({
    userId: v.string(),
    companyLinkedinUrl: v.string(),
    companyName: v.string(),
    companyDomain: v.optional(v.string()),
    companyIndustry: v.optional(v.string()),
    companyDescription: v.optional(v.string()),
    companyLogoUrl: v.optional(v.string()),
    role: v.string(),
    candidates: v.array(v.object({
      name: v.string(),
      title: v.string(),
      headline: v.string(),
      linkedinUrl: v.string(),
      email: v.optional(v.string()),
      photoUrl: v.optional(v.string()),
      priority: v.number(),
      tier: v.union(v.literal("tier1"), v.literal("tier2"), v.literal("tier3")),
      message: v.string(),
      dmMessage: v.string(),
      status: v.string(),
      mode: v.union(v.literal("connection"), v.literal("dm")),
    })),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_company", ["userId", "companyLinkedinUrl"]),

  linkedinSyncState: defineTable({
    userId: v.string(),
    lastRunAt: v.number(),
    lastConnectionName: v.optional(v.string()),
    lastConnectionDate: v.optional(v.string()),
    totalConnectionsSynced: v.number(),
    lastInvitationName: v.optional(v.string()),
    totalInvitationsSynced: v.number(),
    lastMessageContactName: v.optional(v.string()),
    lastMessageBody: v.optional(v.string()),
    lastMessageTimestamp: v.optional(v.number()),
    totalMessagesSynced: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"]),
});
