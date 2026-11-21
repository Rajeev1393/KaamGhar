const mongoose = require("mongoose");
const { categories, levels, transitions, slaHours } = require("../utils/ticketWorkflow");

const reviewSchema = new mongoose.Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true, unique: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  worker: { type: mongoose.Schema.Types.ObjectId, ref: "Worker", required: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  text: { type: String, trim: true, maxlength: 1000 }
}, { timestamps: true });
reviewSchema.index({ worker: 1, createdAt: -1 });

const complaintSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", index: true },
  kind: { type: String, enum: ["complaint", "dispute"], required: true },
  professional: { type: mongoose.Schema.Types.ObjectId, ref: "Worker" },
  category: { type: String, enum: categories },
  priority: { type: String, enum: Object.keys(slaHours) },
  assignedAgent: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  level: { type: String, enum: levels },
  responseDueAt: Date,
  resolutionDueAt: Date,
  firstResponseAt: Date,
  resolvedAt: Date,
  closedAt: Date,
  subject: { type: String, required: true, maxlength: 100 },
  details: { type: String, required: true, maxlength: 2000 },
  status: { type: String, enum: [...Object.keys(transitions), "in_review"], default: "open" },
  response: { type: String, maxlength: 2000 },
  notes: [{ text: String, author: String, createdAt: Date }],
  evidenceCount: Number,
  refund: {
    status: { type: String, enum: ["requested", "approved", "rejected", "recorded"] },
    amount: Number,
    reason: String,
    decision: String,
    reference: String,
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    requestedAt: Date,
    decidedAt: Date,
    recordedAt: Date
  },
  refundReserved: Boolean
}, { timestamps: true });
complaintSchema.index({ customer: 1, createdAt: -1 });
complaintSchema.index({ status: 1, updatedAt: -1 });

complaintSchema.index({ booking: 1, refundReserved: 1 }, {
  unique: true, partialFilterExpression: { refundReserved: true }
});

const evidenceSchema = new mongoose.Schema({
  ticket: { type: mongoose.Schema.Types.ObjectId, ref: "Complaint", required: true, index: true },
  name: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  data: { type: Buffer, required: true, select: false }
}, { timestamps: true });

module.exports = {
  TicketEvidence: mongoose.model("TicketEvidence", evidenceSchema),
  Review: mongoose.model("Review", reviewSchema),
  Complaint: mongoose.model("Complaint", complaintSchema)
};
