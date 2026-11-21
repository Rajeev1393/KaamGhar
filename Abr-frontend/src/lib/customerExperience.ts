export const ticketStatuses = {
  open: "Open", assigned: "Assigned", in_progress: "In Progress", waiting: "Waiting", resolved: "Resolved", closed: "Closed",
};
export const ticketCategories = {
  service_quality: "Service quality", late_no_show: "Late / no-show", customer_no_show: "Customer no-show",
  payment: "Payment", refund: "Refund", behaviour: "Behaviour", safety: "Safety", app_issue: "App issue",
  booking_issue: "Booking issue", other: "Other",
};
export const ticketLevels = { support: "Support Executive", operations: "Operations Manager", management: "Admin / Management" };
export const ticketPriorities = { low: "Low", normal: "Normal", high: "High", urgent: "Urgent" };
export type TicketStatus = keyof typeof ticketStatuses;
export type TicketLevel = keyof typeof ticketLevels;

export type Ticket = {
  _id: string;
  kind: "complaint" | "dispute";
  category: keyof typeof ticketCategories;
  priority: keyof typeof ticketPriorities;
  subject: string;
  details: string;
  status: TicketStatus;
  level: TicketLevel;
  response?: string;
  createdAt: string;
  updatedAt: string;
  booking?: string;
  customer?: { name: string };
  professional?: { name: string };
  assignedAgent?: { name: string };
  responseDueAt: string;
  resolutionDueAt: string;
  responseSla: string;
  resolutionSla: string;
  firstResponseAt?: string;
  resolvedAt?: string;
  notes?: { _id: string; text: string; author: string; createdAt: string }[];
  evidence: { _id: string; name: string }[];
  refund?: { status?: "requested" | "approved" | "rejected" | "recorded"; amount: number; reason?: string; decision?: string; reference?: string };
};

export const refundStatuses = { requested: "Awaiting approval", approved: "Approved", rejected: "Rejected", recorded: "Refund recorded" };
