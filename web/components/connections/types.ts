import type { Id } from "@/convex/_generated/dataModel";

export interface ConnectionCardProps {
  connection: any;
  personName?: string;
}

export interface QuickAddModalProps {
  companyId: Id<"companies">;
  onClose: () => void;
}
