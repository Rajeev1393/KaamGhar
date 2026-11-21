import type { AdminRole } from "@/lib/types";
import { ClipboardList, MapPin, Settings, ShieldCheck, Users } from "lucide-react";

export const managementTabs = [
  { id: "locations", label: "Locations & Cities", icon: MapPin },
  { id: "admin-users", label: "Admin Users", icon: Users, ownerOnly: true },
  { id: "roles", label: "Roles & Permissions", icon: ShieldCheck },
  { id: "audit-logs", label: "Audit Logs", icon: ClipboardList, ownerOnly: true },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

export type ManagementTab = (typeof managementTabs)[number]["id"];

export function availableManagementTabs(role: AdminRole) {
  return managementTabs.filter((tab) => !("ownerOnly" in tab) || role === "owner");
}
