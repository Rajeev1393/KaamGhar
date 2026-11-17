export type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled";

export interface User {
  id: string;
  name: string;
  email: string;
  role: "customer" | "worker" | "admin";
}

export interface Worker {
  _id: string;
  name: string;
  profession: string;
  category: string;
  city: string;
  experience: number;
  price: number;
  available: boolean;
  approvalStatus: "pending" | "approved" | "rejected";
}

export interface Booking {
  _id: string;
  customerName: string;
  phone: string;
  address: string;
  notes?: string;
  scheduledAt: string;
  durationHours: number;
  status: BookingStatus;
  totalAmount?: number;
  customer?: { name: string; phone: string };
}
