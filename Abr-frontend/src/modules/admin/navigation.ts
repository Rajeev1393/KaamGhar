import type { User } from "@/lib/types";
import { BriefcaseBusiness, ClipboardList, LayoutDashboard, MapPin, MessageCircle, Settings, ShieldCheck, Users } from "lucide-react";

export const marketplaceTabs = [
  { id: "overview", label: "Overview", permission: "overview", icon: LayoutDashboard },
  { id: "pending", label: "Pending", permission: "professionals", icon: Users },
  { id: "approved", label: "Approved", permission: "professionals", icon: Users },
  { id: "rejected", label: "Rejected", permission: "professionals", icon: Users },
  { id: "categories", label: "Categories", permission: "categories", icon: BriefcaseBusiness },
  { id: "users", label: "Users", permission: "accounts", icon: Users },
  { id: "bookings", label: "Bookings", permission: "bookings", icon: ClipboardList },
  { id: "support", label: "Support inbox", permission: "support", icon: MessageCircle },
  { id: "profile", label: "My profile", icon: BriefcaseBusiness },
] as const;

export const managementTabs = [
  { id: "locations", label: "Locations & Cities", icon: MapPin, permission: "locations-read" },
  { id: "admin-users", label: "Admin Users", icon: Users, permission: "staff" },
  { id: "roles", label: "Roles & Permissions", icon: ShieldCheck },
  { id: "audit-logs", label: "Audit Logs", icon: ClipboardList, permission: "audit" },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

export type ManagementTab = (typeof managementTabs)[number]["id"];
export type AdminTab = (typeof marketplaceTabs)[number]["id"] | ManagementTab;

export function canAccess(user: User, permission: string) {
  const permissions = user.adminPermissions ?? (user.adminRole === undefined || user.adminRole === "owner" ? ["*"] : []);
  return permissions.includes("*") || permissions.includes(permission);
}

export function availableTabs(user: User) {
  return [...marketplaceTabs, ...managementTabs].filter((tab) =>
    !("permission" in tab) || canAccess(user, tab.permission));
}
