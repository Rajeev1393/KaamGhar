const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const Worker = require("../models/Worker");
const { requiredString } = require("../middleware/validate");
const httpError = require("../utils/httpError");

async function create(req, res) {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    throw httpError(400, "Please submit valid booking details.");
  }
  const workerId = req.body.workerId;
  if (!mongoose.isValidObjectId(workerId)) throw httpError(400, "Choose a valid professional.");
  const address = requiredString(req.body.address, "Address", 8, 300);
  const durationHours = Number(req.body.durationHours);
  if (!Number.isInteger(durationHours) || durationHours < 1 || durationHours > 12) {
    throw httpError(400, "Choose a booking duration between 1 and 12 hours.");
  }
  const notes = req.body.notes === undefined || req.body.notes === ""
    ? ""
    : requiredString(req.body.notes, "Notes", 1, 500);
  const scheduledAt = new Date(req.body.scheduledAt);
  if (!req.body.scheduledAt || Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
    throw httpError(400, "Choose a valid date and time in the future.");
  }

  const worker = await Worker.findOne({
    _id: workerId,
    available: true,
    approvalStatus: "approved",
    deletedAt: { $exists: false }
  });
  if (!worker) throw httpError(404, "This professional is not available.");

  const booking = await Booking.create({
    customer: req.user._id,
    worker: worker._id,
    customerName: req.user.name,
    phone: req.user.phone,
    email: req.user.email,
    address,
    scheduledAt,
    durationHours,
    notes,
    totalAmount: worker.price * durationHours
  });
  res.status(201).json({ message: "Booking request received.", booking });
}

async function listMine(req, res) {
  let filter = {};
  if (req.user.role === "customer") filter.customer = req.user._id;
  if (req.user.role === "worker") {
    if (!req.user.worker) return res.json({ bookings: [] });
    filter.worker = req.user.worker;
  }
  const bookings = await Booking.find(filter)
    .populate("customer", "name email phone")
    .populate("worker", "name profession category city price")
    .sort({ scheduledAt: -1 })
    .limit(200)
    .lean();
  res.json({ bookings });
}

async function changeStatus(req, res) {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    throw httpError(400, "Please submit a valid booking status.");
  }
  const { status } = req.body;
  if (!["confirmed", "completed", "cancelled"].includes(status)) {
    throw httpError(400, "Choose a valid booking status.");
  }
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError(400, "Invalid booking id.");
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw httpError(404, "Booking not found.");

  const isAdmin = req.user.role === "admin";
  const isOwner = booking.customer && booking.customer.equals(req.user._id);
  const isAssignedWorker =
    req.user.role === "worker" &&
    req.user.worker &&
    booking.worker.equals(req.user.worker);
  if (!isAdmin && !isOwner && !isAssignedWorker) {
    throw httpError(403, "You cannot update this booking.");
  }

  const allowed =
    isAdmin ||
    (isOwner && status === "cancelled" && ["pending", "confirmed"].includes(booking.status)) ||
    (isAssignedWorker &&
      ((status === "confirmed" && booking.status === "pending") ||
        (status === "completed" && booking.status === "confirmed") ||
        (status === "cancelled" && ["pending", "confirmed"].includes(booking.status))));
  if (!allowed) throw httpError(409, `A ${booking.status} booking cannot be changed to ${status}.`);

  booking.status = status;
  await booking.save();
  res.json({ message: "Booking updated.", booking });
}

module.exports = { create, listMine, changeStatus };
