const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/User");
const Booking = require("../models/Booking");
const Worker = require("../models/Worker");
const { Coupon, MembershipPlan, ReferralProgram } = require("../models/Commerce");
const { requireAdminAccess } = require("../utils/adminAccess");
const { requiredString } = require("../middleware/validate");
const { normalizeCode } = require("../utils/commerce");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");

const router = express.Router();

function numberInRange(value, min, max, label, integer = false) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max ||
      (integer ? !Number.isInteger(value) : Math.abs(value * 100 - Math.round(value * 100)) > 0.000001)) {
    throw httpError(400, `${label} must be between ${min} and ${max}.`);
  }
  return value;
}

function activeFlag(value) {
  if (typeof value !== "boolean") throw httpError(400, "Choose whether this record is active.");
  return value;
}

function couponFields(body) {
  if (!["fixed", "percent"].includes(body.kind)) throw httpError(400, "Choose a coupon discount type.");
  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
  if (expiresAt && (typeof body.expiresAt !== "string" || Number.isNaN(expiresAt.getTime()))) {
    throw httpError(400, "Choose a valid expiration date.");
  }
  return {
    code: normalizeCode(body.code),
    description: requiredString(body.description, "Offer", 1, 160),
    kind: body.kind,
    value: numberInRange(body.value, 0.01, body.kind === "percent" ? 100 : 100000, "Discount"),
    expiresAt,
    active: activeFlag(body.active)
  };
}

function membershipFields(body) {
  return {
    name: requiredString(body.name, "Plan name", 1, 80),
    benefits: requiredString(body.benefits, "Benefits", 1, 500),
    price: numberInRange(body.price, 0, 1000000, "Plan price"),
    days: numberInRange(body.days, 1, 3650, "Duration in days", true),
    active: activeFlag(body.active)
  };
}

function growthCatalog(path, Model, fields, permission) {
  router.get(path, requireAdminAccess(permission), asyncHandler(async (req, res) => {
    res.json({ records: await Model.find().sort({ createdAt: -1 }).lean() });
  }));
  async function save(req, res, create) {
    const values = fields(req.body);
    try {
      const record = create
        ? await Model.create(values)
        : await Model.findByIdAndUpdate(req.params.id, values, { new: true, runValidators: true });
      if (!record) throw httpError(404, "Record not found.");
      res.locals.auditTarget = [record.id];
      res.status(create ? 201 : 200).json({ record });
    } catch (error) {
      if (error.code === 11000) throw httpError(409, "A record with this code or name already exists.");
      throw error;
    }
  }
  router.post(path, requireAdminAccess(permission), asyncHandler((req, res) => save(req, res, true)));
  router.patch(`${path}/:id`, requireAdminAccess(permission), asyncHandler((req, res) => save(req, res, false)));
}

growthCatalog("/coupons", Coupon, couponFields, "coupons");
growthCatalog("/memberships", MembershipPlan, membershipFields, "memberships");

router.get("/memberships/enrollments", requireAdminAccess("memberships"), asyncHandler(async (req, res) => {
  const customers = await User.find({ role: "customer", "membership.expiresAt": { $gt: new Date() } })
    .select("name email membership").sort({ "membership.expiresAt": 1 }).limit(100).lean();
  res.json({ customers });
}));

router.post("/memberships/enrollments", requireAdminAccess("memberships"), asyncHandler(async (req, res) => {
  const { planId, email } = req.body;
  if (!mongoose.isObjectIdOrHexString(planId)) throw httpError(400, "Choose a membership plan.");
  const plan = await MembershipPlan.findOne({ _id: planId, active: true }).lean();
  if (!plan) throw httpError(404, "Active membership plan not found.");
  const now = new Date();
  const customer = await User.findOneAndUpdate(
    { role: "customer", email: requiredString(email, "Customer email", 3, 254).toLowerCase(), active: true,
      "membership.expiresAt": { $not: { $gt: now } } },
    { membership: { name: plan.name, benefits: plan.benefits, expiresAt: new Date(now.getTime() + plan.days * 86400000) } }
  );
  if (!customer) throw httpError(409, "Customer is unavailable or already has an active membership.");
  res.locals.auditTarget = [customer.id];
  res.status(201).json({ id: customer.id });
}));

router.get("/referrals", requireAdminAccess("referrals"), asyncHandler(async (req, res) => {
  const [program, total, referrals] = await Promise.all([
    ReferralProgram.findById("referrals").lean(),
    User.countDocuments({ role: "customer", referredBy: { $exists: true } }),
    User.find({ role: "customer", referredBy: { $exists: true } }).select("name referredBy createdAt")
      .populate("referredBy", "name").sort({ createdAt: -1 }).limit(100).lean()
  ]);
  res.json({ enabled: program?.enabled ?? false, total, referrals });
}));

router.patch("/referrals", requireAdminAccess("referrals"), asyncHandler(async (req, res) => {
  const enabled = activeFlag(req.body.enabled);
  await ReferralProgram.updateOne({ _id: "referrals" }, { $set: { enabled } }, { upsert: true });
  res.json({ enabled });
}));

router.get("/payouts", requireAdminAccess("payouts"), asyncHandler(async (req, res) => {
  const payouts = await Booking.aggregate([
    { $match: { paymentStatus: "paid" } },
    { $set: { amount: { $round: [{ $multiply: [{ $subtract: [
      { $ifNull: ["$totalAmount", 0] }, { $ifNull: ["$commissionAmount", 0] }
    ] }, 100] }, 0] } } },
    { $group: {
      _id: "$worker",
      pending: { $sum: { $cond: [{ $eq: ["$providerPayoutStatus", "cleared"] }, 0, "$amount"] } },
      cleared: { $sum: { $cond: [{ $eq: ["$providerPayoutStatus", "cleared"] }, "$amount", 0] } }
    } },
    { $sort: { pending: -1, _id: 1 } },
    { $limit: 300 },
    { $lookup: { from: Worker.collection.name, localField: "_id", foreignField: "_id", as: "professional" } },
    { $set: { professional: { $first: "$professional" } } },
    { $project: { pending: 1, cleared: 1, name: "$professional.name", canClear: {
      $and: [{ $ne: [{ $type: "$professional" }, "missing"] }, { $eq: [{ $type: "$professional.deletedAt" }, "missing"] }]
    } } }
  ]);
  res.json({ payouts });
}));

module.exports = router;
