const mongoose = require("mongoose");

const attachmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  data: { type: Buffer, required: true, select: false }
}, { _id: false });

const schema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  sender: { type: String, enum: ["customer", "support"], required: true },
  text: { type: String, trim: true, maxlength: 1000, default: "" },
  attachment: attachmentSchema,
  whatsappMessageId: String,
  whatsappAttempts: Number,
  whatsappNextAttempt: Date
}, { timestamps: { createdAt: true, updatedAt: false } });

schema.index({ customer: 1, _id: -1 });
schema.index({ whatsappMessageId: 1 }, { unique: true, sparse: true });
schema.index({ whatsappNextAttempt: 1 }, { sparse: true });

module.exports = mongoose.model("SupportMessage", schema);
