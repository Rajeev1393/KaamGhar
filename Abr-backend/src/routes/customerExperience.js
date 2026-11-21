const express = require("express");
const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const Worker = require("../models/Worker");
const { Review, Complaint } = require("../models/CustomerExperience");
const { requireAdminAccess } = require("../utils/adminAccess");
const { authenticate, authorize } = require("../middleware/authenticate");
const { requiredString } = require("../middleware/validate");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");

const customer = express.Router();
const admin = express.Router();
customer.use(authenticate, authorize("customer"));

function recordId(value) {
  if (!mongoose.isObjectIdOrHexString(value)) throw httpError(400, "Choose a valid record.");
  return value;
}

customer.get("/reviews", asyncHandler(async (req, res) => {
  const [reviews, bookings] = await Promise.all([
    Review.find({ customer: req.user._id }).select("booking worker rating text createdAt").sort({ createdAt: -1 })
      .limit(200).populate("worker", "name profession").lean(),
    Booking.find({ customer: req.user._id, status: "completed" }).select("worker scheduledAt")
      .sort({ scheduledAt: -1 }).limit(200).populate({
        path: "worker", select: "name profession", match: { deletedAt: { $exists: false } }
      }).lean()
  ]);
  const reviewedBookings = new Set((await Review.distinct("booking", {
    customer: req.user._id, booking: { $in: bookings.map(({ _id }) => _id) }
  })).map(String));
  res.json({ reviews, eligible: bookings.filter(({ _id, worker }) => worker && !reviewedBookings.has(String(_id))) });
}));

customer.post("/reviews", asyncHandler(async (req, res) => {
  const bookingId = recordId(req.body.bookingId);
  const { rating } = req.body;
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw httpError(400, "Choose a rating from 1 to 5.");
  const text = req.body.text == null || req.body.text === "" ? "" : requiredString(req.body.text, "Review", 1, 1000);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const booking = await Booking.findOne({ _id: bookingId, customer: req.user._id, status: "completed" }).select("worker").session(session);
      if (!booking) throw httpError(404, "Completed booking not found.");
      await Review.create([{ booking: bookingId, worker: booking.worker, customer: req.user._id, rating, text }], { session });
      const [summary] = await Review.aggregate([
        { $match: { worker: booking.worker } },
        { $group: { _id: null, average: { $avg: "$rating" }, count: { $sum: 1 } } }
      ]).session(session);
      const result = await Worker.updateOne(
        { _id: booking.worker, deletedAt: { $exists: false } },
        { $set: { rating: Math.round(summary.average * 10) / 10, reviewCount: summary.count } },
        { session }
      );
      if (!result.matchedCount) throw httpError(409, "This professional is no longer available for reviews.");
    });
  } catch (error) {
    if (error.code === 11000) throw httpError(409, "You already reviewed this booking.");
    throw error;
  } finally {
    await session.endSession();
  }
  res.status(201).json({ message: "Review published." });
}));

async function publicReviews(req, res) {
  const worker = await Worker.findOne({ _id: recordId(req.params.id), approvalStatus: "approved", deletedAt: { $exists: false } }).select("_id").lean();
  if (!worker) throw httpError(404, "Professional not found.");
  const reviews = await Review.find({ worker: worker._id }).select("rating text createdAt").sort({ createdAt: -1, _id: -1 }).limit(20).lean();
  res.json({ reviews });
}

customer.get("/complaints", asyncHandler(async (req, res) => {
  const complaints = await Complaint.find({ customer: req.user._id }).sort({ createdAt: -1 }).limit(100).lean();
  res.json({ complaints });
}));

customer.post("/complaints", asyncHandler(async (req, res) => {
  const { kind, bookingId } = req.body;
  if (!["complaint", "dispute"].includes(kind)) throw httpError(400, "Choose complaint or booking dispute.");
  if (kind === "dispute" && !bookingId) throw httpError(400, "Choose the booking you want to dispute.");
  const subject = requiredString(req.body.subject, "Subject", 3, 100);
  const details = requiredString(req.body.details, "Details", 10, 2000);
  if (bookingId && !(await Booking.exists({ _id: recordId(bookingId), customer: req.user._id }))) {
    throw httpError(404, "Booking not found.");
  }
  const complaint = await Complaint.create({ customer: req.user._id, kind, subject, details, booking: bookingId || undefined });
  res.status(201).json({ complaint });
}));

admin.get("/complaints", requireAdminAccess("support"), asyncHandler(async (req, res) => {
  const status = req.query.status ?? "open";
  if (!["open", "in_review", "resolved"].includes(status)) throw httpError(400, "Choose a complaint status.");
  const complaints = await Complaint.find({ status }).sort({ updatedAt: -1 })
    .limit(100).populate("customer", "name").lean();
  res.json({ complaints });
}));

admin.patch("/complaints/:id", requireAdminAccess("support"), asyncHandler(async (req, res) => {
  const { status, previousStatus } = req.body;
  const updatedAt = typeof req.body.updatedAt === "string" ? new Date(req.body.updatedAt) : null;
  const nextStatuses = { open: ["in_review", "resolved"], in_review: ["in_review", "resolved"], resolved: ["in_review", "resolved"] };
  if (!updatedAt || Number.isNaN(updatedAt.getTime()) || typeof previousStatus !== "string" || !Object.hasOwn(nextStatuses, previousStatus) || !nextStatuses[previousStatus].includes(status)) {
    throw httpError(400, "Choose a valid case status.");
  }
  const response = requiredString(req.body.response, "Customer update", 1, 2000);
  const complaint = await Complaint.findOneAndUpdate(
    { _id: recordId(req.params.id), status: previousStatus, updatedAt }, { $set: { status, response } }, { new: true }
  );
  if (!complaint) throw httpError(409, "This case changed. Refresh before saving.");
  res.json({ complaint });
}));

module.exports = { customer, admin, publicReviews };
