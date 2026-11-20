const mongoose = require("mongoose");
const path = require("node:path");
const SupportMessage = require("../models/SupportMessage");
const User = require("../models/User");
const httpError = require("../utils/httpError");
const { queuedDelivery } = require("../utils/supportWhatsApp");
const { isValidFileSignature } = require("../utils/workerDocuments");

function serialize({ _id, sender, text, createdAt, attachment }) {
  return {
    _id, sender, text, createdAt,
    ...(attachment && { attachment: { name: attachment.name, size: attachment.size, mimeType: attachment.mimeType } })
  };
}

async function readThread(customer, res) {
  const messages = await SupportMessage.find({ customer }).sort({ _id: -1 }).limit(100).lean();
  res.json({ messages: messages.reverse().map(serialize) });
}

async function postMessage(customer, sender, req, res) {
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  if (text.length > 1000) throw httpError(400, "Messages can be up to 1000 characters.");
  if (!text && !req.file) throw httpError(400, "Type a message or attach a document.");
  if (req.file && !isValidFileSignature(req.file)) {
    throw httpError(400, "The file content does not match a supported PDF, JPG, or PNG document.");
  }
  const attachment = req.file && {
    name: path.win32.basename(req.file.originalname).replace(/[^\w.-]/g, "_").slice(0, 180) || "document",
    mimeType: req.file.mimetype,
    size: req.file.size,
    data: req.file.buffer
  };
  const message = await SupportMessage.create({
    customer, sender, text, attachment, ...(sender === "customer" ? queuedDelivery() : {})
  });
  res.status(201).json({ message: serialize(message) });
}

async function downloadAttachment(customer, messageId, res) {
  if (!mongoose.isObjectIdOrHexString(messageId)) throw httpError(404, "Attachment not found.");
  const message = await SupportMessage.findOne({ _id: messageId, customer })
    .select("attachment.name attachment.mimeType +attachment.data");
  if (!message?.attachment?.data) throw httpError(404, "Attachment not found.");
  const { name, mimeType, data } = message.attachment;
  res.set("Cache-Control", "private, no-store");
  res.set("X-Content-Type-Options", "nosniff");
  res.attachment(name).type(mimeType).send(Buffer.from(data));
}

async function findCustomer(id) {
  if (!mongoose.isObjectIdOrHexString(id)) throw httpError(404, "Conversation not found.");
  const customer = await User.findOne({ _id: id, role: "customer" }).select("_id").lean();
  if (!customer) throw httpError(404, "Conversation not found.");
  return customer._id;
}

async function inbox(req, res) {
  const threads = await SupportMessage.aggregate([
    { $sort: { customer: 1, _id: -1 } },
    { $group: { _id: "$customer", latest: { $first: {
      _id: "$_id", sender: "$sender", text: "$text", createdAt: "$createdAt", attachmentName: "$attachment.name"
    } } } },
    { $sort: { "latest._id": -1 } },
    { $lookup: { from: User.collection.name, localField: "_id", foreignField: "_id", as: "customer" } },
    { $unwind: "$customer" },
    { $match: { "customer.role": "customer" } },
    { $limit: 100 },
    { $project: {
      name: "$customer.name",
      latest: 1
    } }
  ]);
  res.json({ threads });
}

module.exports = {
  inbox,
  customerThread: (req, res) => readThread(req.user._id, res),
  customerMessage: (req, res) => postMessage(req.user._id, "customer", req, res),
  customerAttachment: (req, res) => downloadAttachment(req.user._id, req.params.messageId, res),
  adminThread: async (req, res) => readThread(await findCustomer(req.params.customerId), res),
  adminMessage: async (req, res) => postMessage(await findCustomer(req.params.customerId), "support", req, res),
  adminAttachment: async (req, res) => downloadAttachment(await findCustomer(req.params.customerId), req.params.messageId, res)
};
