const { Location } = require("../models/AdminManagement");

const roles = [
  { id: "owner", name: "Super Admin", permissions: ["Full control"], access: ["*"] },
  { id: "super-admin", name: "Super Admin", permissions: ["Full control"], access: ["*"] },
  { id: "operations", name: "Operations Manager", permissions: ["Bookings", "Professional accounts"], access: ["bookings", "professionals", "create-professional", "locations-read", "accounts", "booking-status"] },
  { id: "support", name: "Customer Support", permissions: ["Customer accounts", "Support inbox and complaints"], access: ["accounts", "support"] },
  { id: "finance", name: "Finance", permissions: ["Booking transactions and refund status", "Provider payouts"], access: ["bookings", "professionals", "payouts", "transactions"] },
  { id: "city-manager", name: "City Manager", permissions: ["Assigned city and its linked professionals only"], access: ["locations-read", "professionals"] },
  { id: "verification", name: "Verification Team", permissions: ["Documents and professional verification"], access: ["professionals", "verify"] },
  { id: "marketing", name: "Marketing Team", permissions: ["Offers and coupons", "Referrals"], access: ["coupons", "referrals"] },
  { id: "locations", name: "Location Manager (legacy)", permissions: ["Manage the locations catalog"], access: ["locations-read", "locations-write"] }
];

function adminAccess(user) {
  return roles.find(({ id }) => id === (user.adminRole ?? "owner"))?.access ?? [];
}

function hasAdminAccess(user, permission) {
  const access = adminAccess(user);
  return access.includes("*") || access.includes(permission);
}

function requireAdminAccess(permission) {
  return (req, res, next) => {
    if (!hasAdminAccess(req.user, permission)) {
      return res.status(403).json({ message: "Your employee role does not have access to this action." });
    }
    next();
  };
}

async function activeAssignedCity(id) {
  if (!id) return null;
  const city = await Location.findOne({ _id: id, deletedAt: null, active: true, parent: { $ne: null } }).lean();
  if (!city || !(await Location.exists({ _id: city.parent, parent: null, deletedAt: null, active: true }))) {
    return null;
  }
  return city;
}

module.exports = { roles, adminAccess, hasAdminAccess, requireAdminAccess, activeAssignedCity };
