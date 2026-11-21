const path = require("node:path");
const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const User = require("../models/User");
const { Complaint, TicketEvidence } = require("../models/CustomerExperience");
const { requireAdminAccess } = require("../utils/adminAccess");
const { uploadSupportDocument } = require("../middleware/workerDocumentUpload");
const { requiredString } = require("../middleware/validate");
const { isValidFileSignature } = require("../utils/workerDocuments");
const asyncHandler = require("../utils/asyncHandler");
const httpError = require("../utils/httpError");
const { categories, levels, transitions, slaHours, initialPriority, deadlines, ticketStatus, agentLevel, canHandle } = require("../utils/ticketWorkflow");

const publicFields = "booking kind professional category priority subject details status response level assignedAgent responseDueAt resolutionDueAt firstResponseAt resolvedAt closedAt createdAt updatedAt refund.status refund.amount";
const rolesByLevel = { support: ["support"], operations: ["operations"], management: ["owner", "super-admin", null] };

function id(value) {
  if (!mongoose.isObjectIdOrHexString(value)) throw httpError(400, "Choose a valid record.");
  return value;
}

function slaState(due, completed, now) {
  if (completed) return completed <= due ? "Met" : "Missed";
  return now > due ? "Overdue" : "Pending";
}

function serialize(ticket) {
  const priority = ticket.priority ?? "normal";
  const due = deadlines(ticket.createdAt, priority);
  const responseDueAt = ticket.responseDueAt ?? due.responseDueAt;
  const resolutionDueAt = ticket.resolutionDueAt ?? due.resolutionDueAt;
  const firstResponseAt = ticket.firstResponseAt ?? (ticket.response ? ticket.updatedAt : undefined);
  const resolvedAt = ticket.resolvedAt ?? (["resolved", "closed"].includes(ticket.status) ? ticket.updatedAt : undefined);
  const now = new Date();
  return {
    ...ticket,
    priority,
    category: ticket.category ?? "other",
    level: ticket.level ?? "support",
    responseDueAt,
    resolutionDueAt,
    firstResponseAt,
    resolvedAt,
    responseSla: slaState(responseDueAt, firstResponseAt, now),
    resolutionSla: slaState(resolutionDueAt, resolvedAt, now),
    status: ticketStatus(ticket.status)
  };
}

async function list(query, staff = false) {
  const request = Complaint.find(query).sort({ updatedAt: -1 }).limit(100)
    .populate("professional", "name profession").populate("assignedAgent", "name");
  if (staff) request.populate("customer", "name");
  else request.select(publicFields);
  const tickets = await request.lean();
  const files = await TicketEvidence.find({ ticket: { $in: tickets.map(({ _id }) => _id) } })
    .select("ticket name size").sort({ createdAt: 1 }).lean();
  const evidenceByTicket = new Map();
  for (const file of files) {
    const key = String(file.ticket);
    if (!evidenceByTicket.has(key)) evidenceByTicket.set(key, []);
    evidenceByTicket.get(key).push(file);
  }
  return tickets.map(ticket => ({ ...serialize(ticket), evidence: evidenceByTicket.get(String(ticket._id)) ?? [] }));
}

async function create(req, res) {
  const { kind, bookingId, category = "other" } = req.body;
  if (!["complaint", "dispute"].includes(kind)) throw httpError(400, "Choose complaint or booking dispute.");
  if (!categories.includes(category)) throw httpError(400, "Choose a valid ticket category.");
  if (kind === "dispute" && !bookingId) throw httpError(400, "Choose the booking you want to dispute.");
  const subject = requiredString(req.body.subject, "Subject", 3, 100);
  const details = requiredString(req.body.details, "Details", 10, 2000);
  const booking = bookingId && await Booking.findOne({ _id: id(bookingId), customer: req.user._id }).select("worker").lean();
  if (bookingId && !booking) throw httpError(404, "Booking not found.");
  const priority = initialPriority(category);
  const createdAt = new Date();
  const ticket = await Complaint.create({ customer: req.user._id, kind, subject, details, category, priority,
    level: "support", booking: bookingId || undefined, professional: booking?.worker, createdAt, ...deadlines(createdAt, priority) });
  res.status(201).json({ id: ticket.id });
}

function visibleLevels(user) {
  return levels.slice(0, levels.indexOf(agentLevel(user)) + 1);
}

async function staffList(req, res) {
  const status = req.query.status ?? "open";
  if (!Object.hasOwn(transitions, status)) throw httpError(400, "Choose a ticket status.");
  const visible = visibleLevels(req.user);
  const [complaints, agents] = await Promise.all([
    list({ status: status === "in_progress" ? { $in: [status, "in_review"] } : status, level: { $in: [...visible, null] } }, true),
    User.find({ role: "admin", active: true, adminRole: { $in: visible.flatMap(level => rolesByLevel[level]) } })
      .select("name adminRole").sort({ name: 1 }).lean()
  ]);
  res.json({ complaints, agents: agents.map(agent => ({ _id: agent._id, name: agent.name, level: agentLevel(agent) })), level: agentLevel(req.user) });
}

async function scopedTicket(req, staff, session) {
  const filter = { _id: id(req.params.id) };
  if (!staff) filter.customer = req.user._id;
  const query = Complaint.findOne(filter);
  if (session) query.session(session);
  const ticket = await query.lean();
  if (!ticket || (staff && !canHandle(req.user, ticket.level))) throw httpError(404, "Ticket not found.");
  return ticket;
}

async function setRefund(req, ticket, set, now) {
  const { refundAction, amount, reason, reference } = req.body;
  if (!ticket.booking) throw httpError(400, "Link a booking before requesting a refund.");
  const status = ticket.refund?.status;
  if (refundAction === "request") {
    if (status && status !== "rejected") throw httpError(409, "This ticket already has a refund in progress.");
    if (!Number.isSafeInteger(amount) || amount < 1) throw httpError(400, "Enter a positive refund amount.");
    const booking = await Booking.findOne({
      _id: ticket.booking, customer: ticket.customer, paymentStatus: { $in: ["paid", "refund_required"] }, paymentId: { $type: "string" }
    }).select("totalAmount").lean();
    if (!booking || amount > Math.round((booking.totalAmount ?? 0) * 100)) {
      throw httpError(400, "Refund amount cannot exceed the captured booking payment.");
    }
    set.refund = { status: "requested", amount, reason: requiredString(reason, "Refund reason", 3, 500), requestedBy: req.user._id, requestedAt: now };
    return;
  }
  if (agentLevel(req.user) !== "management") throw httpError(403, "Management must approve, reject or record refunds.");
  if (refundAction === "approve" || refundAction === "reject") {
    if (status !== "requested") throw httpError(409, "This refund request has already changed.");
    set["refund.status"] = refundAction === "approve" ? "approved" : "rejected";
    set["refund.decision"] = requiredString(reason, "Decision reason", 3, 500);
    set["refund.decidedAt"] = now;
    set["refund.decidedBy"] = req.user._id;
    if (refundAction === "approve") set.refundReserved = true;
  } else if (refundAction === "record") {
    if (status !== "approved") throw httpError(409, "Approve the refund before recording it.");
    set["refund.status"] = "recorded";
    set["refund.reference"] = requiredString(reference, "Refund reference", 3, 100);
    set["refund.recordedAt"] = now;
  } else throw httpError(400, "Choose a refund action.");
}

async function update(req, res) {
  const ticket = await scopedTicket(req, true);
  const updatedAt = typeof req.body.updatedAt === "string" ? new Date(req.body.updatedAt) : null;
  if (!updatedAt || Number.isNaN(updatedAt.getTime())) throw httpError(400, "Refresh the ticket before making an update.");
  const current = ticketStatus(ticket.status);
  if (current === "closed") throw httpError(409, "This ticket is closed.");
  const level = ticket.level ?? "support";
  const now = new Date();
  const set = {};
  const unset = {};
  const changes = {};
  switch (req.body.action) {
    case "assign": {
      const roles = visibleLevels(req.user).slice(levels.indexOf(level)).flatMap(item => rolesByLevel[item]);
      const agent = await User.findOne({ _id: id(req.body.agentId), role: "admin", active: true, adminRole: { $in: roles } })
        .select("_id").lean();
      if (!agent) throw httpError(400, "Choose an active agent for this escalation level.");
      set.assignedAgent = agent._id;
      if (current === "open") set.status = "assigned";
      break;
    }
    case "escalate":
      if (level === "management" || current === "resolved") throw httpError(409, "This ticket cannot be escalated.");
      set.level = levels[levels.indexOf(level) + 1];
      set.status = "open";
      unset.assignedAgent = 1;
      changes.$push = { notes: { text: `Escalated from ${level} to ${set.level}.`, author: req.user.email, createdAt: now } };
      break;
    case "note":
      if ((ticket.notes?.length ?? 0) >= 100) throw httpError(409, "This ticket has reached its internal note limit.");
      changes.$push = { notes: { text: requiredString(req.body.note, "Internal note", 1, 2000), author: req.user.email, createdAt: now } };
      break;
    case "refund":
      if (current === "resolved") throw httpError(409, "Reopen the ticket before changing the refund.");
      await setRefund(req, ticket, set, now);
      break;
    case "update": {
      const { status, priority, response } = req.body;
      if (status && status !== current) {
        if (!transitions[current]?.includes(status) || status === "assigned") throw httpError(400, "Choose a valid next ticket status.");
        if (["resolved", "closed"].includes(status) && ["requested", "approved"].includes(ticket.refund?.status)) {
          throw httpError(409, "Complete the refund workflow before resolving or closing this ticket.");
        }
        set.status = status;
        if (status === "resolved") set.resolvedAt = now;
        if (status === "closed") set.closedAt = now;
        if (current === "resolved" && status === "in_progress") unset.resolvedAt = 1;
      }
      if (priority && priority !== ticket.priority) {
        if (!Object.hasOwn(slaHours, priority)) throw httpError(400, "Choose a valid priority.");
        Object.assign(set, { priority, ...deadlines(ticket.createdAt, priority) });
      }
      if (response !== undefined && response !== "") {
        set.response = requiredString(response, "Customer reply", 1, 2000);
        if (!ticket.firstResponseAt) set.firstResponseAt = ticket.response ? ticket.updatedAt : now;
      }
      break;
    }
    default: throw httpError(400, "Choose a ticket action.");
  }
  if (Object.keys(set).length) changes.$set = set;
  if (Object.keys(unset).length) changes.$unset = unset;
  if (!Object.keys(changes).length) throw httpError(400, "Enter a change before saving.");
  try {
    const changed = await Complaint.updateOne({ _id: ticket._id, updatedAt }, changes);
    if (!changed.matchedCount) throw httpError(409, "This ticket changed. Refresh before saving.");
  } catch (error) {
    if (error.code === 11000) throw httpError(409, "A refund was already approved or recorded for this booking.");
    throw error;
  }
  res.json({ id: ticket._id });
}

async function addEvidence(req, res, staff) {
  if (!req.file || !isValidFileSignature(req.file)) throw httpError(400, "Upload a valid PDF, JPG or PNG file.");
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const ticket = await scopedTicket(req, staff, session);
      if (ticket.status === "closed") throw httpError(409, "This ticket is closed.");
      if ((ticket.evidenceCount ?? 0) >= 5) throw httpError(409, "Each ticket can hold up to five attachments.");
      await Complaint.updateOne({ _id: ticket._id }, { $inc: { evidenceCount: 1 } }, { session });
      await TicketEvidence.create([{
        ticket: ticket._id,
        name: path.win32.basename(req.file.originalname).replace(/[^\w.-]/g, "_").slice(0, 180) || "evidence",
        mimeType: req.file.mimetype, size: req.file.size, data: req.file.buffer
      }], { session });
    });
  } finally {
    await session.endSession();
  }
  res.status(201).json({ message: "Evidence attached." });
}

async function download(req, res, staff) {
  const ticket = await scopedTicket(req, staff);
  const file = await TicketEvidence.findOne({ _id: id(req.params.fileId), ticket: ticket._id }).select("name mimeType +data");
  if (!file) throw httpError(404, "Evidence not found.");
  res.set("Cache-Control", "private, no-store");
  res.set("X-Content-Type-Options", "nosniff");
  res.attachment(file.name).type(file.mimeType).send(Buffer.from(file.data));
}

module.exports = function registerTickets(customer, admin) {
  const staff = requireAdminAccess("tickets");
  customer.get("/complaints", asyncHandler(async (req, res) => res.json({ complaints: await list({ customer: req.user._id }) })));
  customer.post("/complaints", asyncHandler(create));
  admin.get("/complaints", staff, asyncHandler(staffList));
  admin.patch("/complaints/:id", staff, asyncHandler(update));
  for (const [router, guard, isStaff] of [[customer, [], false], [admin, [staff], true]]) {
    router.post("/complaints/:id/evidence", ...guard, uploadSupportDocument, asyncHandler((req, res) => addEvidence(req, res, isStaff)));
    router.get("/complaints/:id/evidence/:fileId", ...guard, asyncHandler((req, res) => download(req, res, isStaff)));
  }
};
