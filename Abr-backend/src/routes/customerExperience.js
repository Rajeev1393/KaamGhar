const express = require("express");
const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const Worker = require("../models/Worker");
const { Review } = require("../models/CustomerExperience");
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

require("./supportTickets")(customer, admin);

module.exports = { customer, admin, publicReviews };
