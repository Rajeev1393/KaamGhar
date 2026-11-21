export const complaintStatuses = { open: "Open", in_review: "In review", resolved: "Resolved" };

export type Complaint = {
  _id: string;
  kind: "complaint" | "dispute";
  subject: string;
  details: string;
  status: keyof typeof complaintStatuses;
  response?: string;
  createdAt: string;
  updatedAt: string;
  booking?: string;
  customer?: { name: string };
};
