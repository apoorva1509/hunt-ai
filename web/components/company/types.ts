import type { Id } from "@/convex/_generated/dataModel";

export interface NextStep {
  id: string;
  type: "follow_up" | "send_message" | "thank_accepted";
  connectionId: Id<"connectionRequests">;
  personName: string;
  description: string;
  urgency: number;
}

export interface NextStepsPanelProps {
  connections: any[];
  people: Map<string, string>;
}

export interface ApplicationsSectionProps {
  leads: any[];
}

export interface TimelineEvent {
  date: number;
  icon: "connection" | "message" | "application" | "outreach";
  description: string;
}

export interface ActivityTimelineProps {
  connections: any[];
  leads: any[];
  drafts: any[];
  people: Map<string, string>;
}
