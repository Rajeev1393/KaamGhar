export type Role = "customer" | "worker" | "admin";

export interface ServiceCategory {
  name: string;
  label: string;
  price: number;
}

export interface VerificationDocument {
  _id: string;
  type: "identity" | "address" | "certificate" | "other";
  originalName: string;
  mimeType: string;
  size: number;
  status: "pending" | "verified" | "rejected";
  uploadedAt: string;
  reviewedAt?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  worker?: string;
}

export interface Worker {
  _id: string;
  name: string;
  profession: string;
  category: string;
  city: string;
  experience: number;
  rating: number;
  reviewCount: number;
  price: number;
  priceUnit?: string;
  description?: string;
  available: boolean;
  approvalStatus: "pending" | "approved" | "rejected";
  earnings?: { total: number; pending: number; cleared: number };
  verificationDocuments?: VerificationDocument[];
  user?: { name: string; email: string; phone: string; active?: boolean };
}

export interface ProviderEarnings {
  total: number;
  pending: number;
  cleared: number;
}

export interface Booking {
  _id: string;
  customerName: string;
  phone: string;
  email: string;
  address: string;
  notes?: string;
  scheduledAt: string;
  durationHours: number;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  totalAmount?: number;
  paymentStatus?: "unpaid" | "paid" | "refund_required";
  providerPayoutStatus?: "pending" | "cleared";
  paymentOrderId?: string;
  paymentOrderExpiresAt?: string;
  customer?: { name: string; phone: string; email: string };
  worker?: { _id?: string; name: string; profession: string; category?: string; city?: string; price?: number };
}

export interface ApiResponse {
  message?: string;
}
