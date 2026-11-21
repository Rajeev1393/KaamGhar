const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/User");
const { Location, AuditLog } = require("../models/AdminManagement");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");

const Worker = require("../models/Worker");
const { roles, requireAdminAccess, activeAssignedCity } = require("../utils/adminAccess");

const delegatedRoles = roles.filter(({ id }) => id !== "owner");
const router = express.Router();
const adminFields = "name email phone active adminRole adminCity";

async function assignedCity(id) {
  const city = id ? await activeAssignedCity(validId(id)) : null;
  if (!city) throw httpError(400, "Choose an active city in an active state.");
  return city;
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
  if (!delegatedRoles.some(({ id }) => id === value)) throw httpError(400, "Choose a delegated admin role.");
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

const roleDefinitions = delegatedRoles.map(({ id, name, permissions }) => ({ id, name, permissions }));

router.get("/roles", (req, res) => res.json({ roles: roleDefinitions }));

router.get("/locations", requireAdminAccess("locations-read"), asyncHandler(async (req, res) => {
  const city = req.user.adminRole === "city-manager"
    ? await activeAssignedCity(req.user.adminCity)
    : null;
  const filter = req.user.adminRole === "city-manager"
    ? { _id: { $in: city ? [city._id, city.parent] : [] } }
    : {};
  const locations = await Location.find(filter).sort({ name: 1 }).lean();
  res.json({ locations });
}));

router.post("/locations", requireAdminAccess("locations-write"), locationChange(async (req, res) => {
  const name = requiredText(req.body.name, 100, "Location name");
  const parent = req.body.parent == null ? null : validId(req.body.parent);
  if (parent && !(await Location.exists({ _id: parent, parent: null }))) {
    throw httpError(404, "State not found.");
  }
  const location = await Location.create({ name, parent });
  res.locals.auditTarget = [location.id];
  res.status(201).json({ location });
}));

router.patch("/locations/:id", requireAdminAccess("locations-write"), locationChange(async (req, res) => {
  const changes = {};
  if (req.body.name !== undefined) changes.name = requiredText(req.body.name, 100, "Location name");
  if (typeof req.body.active === "boolean") changes.active = req.body.active;
  if (!Object.keys(changes).length) throw httpError(400, "Provide a name or status.");
  const location = await Location.findByIdAndUpdate(validId(req.params.id), changes, { new: true, runValidators: true });
  if (!location) throw httpError(404, "Location not found.");
  res.json({ location });
}));

router.get("/admin-users", requireAdminAccess("staff"), asyncHandler(async (req, res) => {
  const [admins, locations] = await Promise.all([
    User.find({ role: "admin" }).select(adminFields).sort({ name: 1 }).lean(),
    Location.find().sort({ name: 1 }).lean()
  ]);
  res.json({ admins, roles: roleDefinitions, locations, currentAdminId: req.user.id });
}));

router.post("/admin-users", requireAdminAccess("staff"), asyncHandler(async (req, res) => {
  const { password, adminRole } = req.body;
  const email = requiredText(req.body.email, 254, "Email").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw httpError(400, "Enter a valid email.");
  if (typeof password !== "string" || password.length < 8 || Buffer.byteLength(password) > 72) {
    throw httpError(400, "Password must be at least 8 characters and at most 72 bytes.");
  }
  const role = delegatedRole(adminRole);
  const city = role === "city-manager" ? await assignedCity(req.body.adminCity) : null;
  const admin = await User.create({
    name: requiredText(req.body.name, 80, "Name"),
    email,
    phone: requiredText(req.body.phone, 20, "Phone"),
    password,
    role: "admin",
    adminRole: role,
    adminCity: city?._id
  });
  res.locals.auditTarget = [admin.id];
  res.status(201).json({ id: admin.id });
}));

router.patch("/admin-users/:id", requireAdminAccess("staff"), asyncHandler(async (req, res) => {
  const changes = {};
  const unset = {};
  if (req.body.adminRole !== undefined) {
    changes.adminRole = delegatedRole(req.body.adminRole);
    if (changes.adminRole === "city-manager") {
      changes.adminCity = (await assignedCity(req.body.adminCity))._id;
    } else {
      unset.adminCity = 1;
    }
  }
  if (typeof req.body.active === "boolean") changes.active = req.body.active;
  if (!Object.keys(changes).length) throw httpError(400, "Provide a role or status.");
  const admin = await User.findOneAndUpdate(
    { _id: { $eq: validId(req.params.id), $ne: req.user._id }, role: "admin", adminRole: { $in: delegatedRoles.map(({ id }) => id) } },
    { $set: changes, $unset: unset, $inc: { sessionVersion: 1 } },
    { new: true, runValidators: true }
  ).select(adminFields);
  if (!admin) throw httpError(404, "Delegated admin account not found.");
  res.json({ admin });
}));

router.patch("/professionals/:id/city", requireAdminAccess("staff"), asyncHandler(async (req, res) => {
  if (req.body.cityId !== null && typeof req.body.cityId !== "string") {
    throw httpError(400, "Send a city ID or null to remove the assignment.");
  }
  const city = req.body.cityId === null ? null : await assignedCity(req.body.cityId);
  const update = city ? { $set: { adminCity: city._id } } : { $unset: { adminCity: 1 } };
  const worker = await Worker.findOneAndUpdate({ _id: validId(req.params.id), deletedAt: { $exists: false } }, update);
  if (!worker) throw httpError(404, "Professional profile was not found.");
  res.json({ cityId: city?.id ?? null });
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

router.get("/audit-logs", requireAdminAccess("audit"), asyncHandler(async (req, res) => {
  const filter = req.query.before ? { _id: { $lt: validId(req.query.before) } } : {};
  const logs = await AuditLog.find(filter).sort({ _id: -1 }).limit(51).lean();
  res.json({
    timeZone: req.user.adminTimeZone ?? "Asia/Kolkata",
    next: logs.length > 50 ? logs[49]._id : null,
    logs: logs.slice(0, 50)
  });
}));

module.exports = { router, recordAdminChange };
