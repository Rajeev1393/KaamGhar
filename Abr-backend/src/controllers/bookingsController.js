const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const httpError = require("../utils/httpError");

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
  if (
    status === "cancelled" &&
    booking.providerPayoutStatus === "cleared"
  ) {
    throw httpError(409, "This provider payout was cleared. Contact support before cancelling this booking.");
  }
  if (
    status === "cancelled" &&
    ((booking.paymentStatus === "paid" && isOwner) ||
      (booking.paymentStatus !== "paid" && booking.paymentOrderId))
  ) {
    throw httpError(
      409,
      booking.paymentStatus === "paid" && isOwner
        ? "This booking has been paid. Contact support to request a refund."
        : "A payment order has already been created. Contact support before cancelling this booking."
    );
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
  if (status === "cancelled" && booking.paymentStatus === "paid") {
    booking.paymentStatus = "refund_required";
  }
  await booking.save();
  res.json({ message: "Booking updated.", booking });
}

module.exports = { listMine, changeStatus };
