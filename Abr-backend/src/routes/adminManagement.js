const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/User");
const { Location, AuditLog } = require("../models/AdminManagement");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");

const roles = [
  { id: "owner", name: "Owner", permissions: ["Marketplace operations", "Manage locations", "Manage admin users", "View audit logs", "Manage own settings"] },
  { id: "operations", name: "Operations", permissions: ["Marketplace operations", "View locations", "Manage own settings"] },
  { id: "locations", name: "Location manager", permissions: ["Manage locations", "Manage own settings"] }
];
const delegatedRoles = roles.slice(1).map(({ id }) => id);
const router = express.Router();
const adminFields = "name email phone active adminRole";

function requireAdminRole(...allowed) {
  return (req, res, next) => {
    if (!allowed.includes(req.user.adminRole ?? "owner")) {
      return res.status(403).json({ message: "Your admin role does not have access to this action." });
    }
    next();
  };
}

function recordAdminChange(req, res, next) {
  if (["POST", "PATCH", "PUT", "DELETE"].includes(req.method)) {
    res.once("finish", () => {
      if (!req.route) return;
      AuditLog.create({
        actor: req.user.email,
        method: req.method,
        route: req.baseUrl + req.route.path,
        target: (res.locals.auditTarget ?? Object.values(req.params)).map(value => String(value).slice(0, 254)),
        status: res.statusCode
      }).catch(error => console.error("Could not write admin audit log:", error.name));
    });
  }
  next();
}

function validId(id) {
  if (!mongoose.isObjectIdOrHexString(id)) throw httpError(400, "Invalid record ID.");
  return id;
}

function requiredText(value, max, label) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
    throw httpError(400, `${label} must contain 1 to ${max} characters.`);
  }
  return value.trim();
}

function delegatedRole(value) {
  if (!delegatedRoles.includes(value)) throw httpError(400, "Choose a delegated admin role.");
  return value;
}

const locationChange = (handler) => asyncHandler(async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    if (error.code === 11000) throw httpError(409, "That location name already exists at this level.");
    throw error;
  }
});

router.get("/roles", (req, res) => res.json({ roles }));

router.get("/locations", asyncHandler(async (req, res) => {
  const locations = await Location.find().sort({ name: 1 }).lean();
  res.json({ locations });
}));

router.post("/locations", requireAdminRole("owner", "locations"), locationChange(async (req, res) => {
  const name = requiredText(req.body.name, 100, "Location name");
  const parent = req.body.parent == null ? null : validId(req.body.parent);
  if (parent && !(await Location.exists({ _id: parent, parent: null }))) {
    throw httpError(404, "State not found.");
  }
  const location = await Location.create({ name, parent });
  res.locals.auditTarget = [location.id];
  res.status(201).json({ location });
}));

router.patch("/locations/:id", requireAdminRole("owner", "locations"), locationChange(async (req, res) => {
  const changes = {};
  if (req.body.name !== undefined) changes.name = requiredText(req.body.name, 100, "Location name");
  if (typeof req.body.active === "boolean") changes.active = req.body.active;
  if (!Object.keys(changes).length) throw httpError(400, "Provide a name or status.");
  const location = await Location.findByIdAndUpdate(validId(req.params.id), changes, { new: true, runValidators: true });
  if (!location) throw httpError(404, "Location not found.");
  res.json({ location });
}));

router.get("/admin-users", requireAdminRole("owner"), asyncHandler(async (req, res) => {
  const admins = await User.find({ role: "admin" }).select(adminFields).sort({ name: 1 }).lean();
  res.json({ admins });
}));

router.post("/admin-users", requireAdminRole("owner"), asyncHandler(async (req, res) => {
  const { password, adminRole } = req.body;
  const email = requiredText(req.body.email, 254, "Email").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw httpError(400, "Enter a valid email.");
  if (typeof password !== "string" || password.length < 8 || Buffer.byteLength(password) > 72) {
    throw httpError(400, "Password must be at least 8 characters and at most 72 bytes.");
  }
  const admin = await User.create({
    name: requiredText(req.body.name, 80, "Name"),
    email,
    phone: requiredText(req.body.phone, 20, "Phone"),
    password,
    role: "admin",
    adminRole: delegatedRole(adminRole)
  });
  res.locals.auditTarget = [admin.id];
  res.status(201).json({ id: admin.id });
}));

router.patch("/admin-users/:id", requireAdminRole("owner"), asyncHandler(async (req, res) => {
  const changes = {};
  if (req.body.adminRole !== undefined) changes.adminRole = delegatedRole(req.body.adminRole);
  if (typeof req.body.active === "boolean") changes.active = req.body.active;
  if (!Object.keys(changes).length) throw httpError(400, "Provide a role or status.");
  const admin = await User.findOneAndUpdate(
    { _id: validId(req.params.id), role: "admin", adminRole: { $in: delegatedRoles } },
    { $set: changes, $inc: { sessionVersion: 1 } },
    { new: true, runValidators: true }
  ).select(adminFields);
  if (!admin) throw httpError(404, "Delegated admin account not found.");
  res.json({ admin });
}));

router.get("/settings", (req, res) => {
  res.json({ timeZone: req.user.adminTimeZone ?? "Asia/Kolkata" });
});

router.patch("/settings", asyncHandler(async (req, res) => {
  const timeZone = requiredText(req.body.timeZone, 100, "Time zone");
  try {
    new Intl.DateTimeFormat("en", { timeZone });
  } catch {
    throw httpError(400, "Choose a valid time zone.");
  }
  await User.updateOne({ _id: req.user.id }, { adminTimeZone: timeZone });
  res.json({ timeZone });
}));

router.get("/audit-logs", requireAdminRole("owner"), asyncHandler(async (req, res) => {
  const filter = req.query.before ? { _id: { $lt: validId(req.query.before) } } : {};
  const logs = await AuditLog.find(filter).sort({ _id: -1 }).limit(51).lean();
  res.json({
    timeZone: req.user.adminTimeZone ?? "Asia/Kolkata",
    next: logs.length > 50 ? logs[49]._id : null,
    logs: logs.slice(0, 50)
  });
}));

module.exports = { router, requireAdminRole, recordAdminChange };
