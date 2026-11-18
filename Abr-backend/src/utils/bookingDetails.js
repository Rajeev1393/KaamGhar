const mongoose = require("mongoose");
const { requiredString } = require("../middleware/validate");
const httpError = require("./httpError");

function parseBookingDetails(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw httpError(400, "Please submit valid booking details.");
  }
  if (!mongoose.isValidObjectId(body.workerId)) {
    throw httpError(400, "Choose a valid professional.");
  }
  const address = requiredString(body.address, "Address", 8, 300);
  const durationHours = Number(body.durationHours);
  if (!Number.isInteger(durationHours) || durationHours < 1 || durationHours > 12) {
    throw httpError(400, "Choose a booking duration between 1 and 12 hours.");
  }
  const notes = body.notes === undefined || body.notes === ""
    ? ""
    : requiredString(body.notes, "Notes", 1, 500);
  const scheduledAt = new Date(body.scheduledAt);
  if (!body.scheduledAt || Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
    throw httpError(400, "Choose a valid date and time in the future.");
  }
  return { workerId: body.workerId, address, durationHours, notes, scheduledAt };
}

module.exports = { parseBookingDetails };
