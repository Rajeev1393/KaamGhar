const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  parent: { type: mongoose.Schema.Types.ObjectId, default: null },
  active: { type: Boolean, default: true },
  deletedAt: Date
}, { timestamps: true });

locationSchema.index({ parent: 1, name: 1 }, {
  unique: true,
  collation: { locale: "en", strength: 2 }
});

const auditSchema = new mongoose.Schema({
  actor: String,
  method: String,
  route: String,
  target: [String],
  status: Number
}, { timestamps: true });

module.exports = {
  Location: mongoose.model("ServiceLocation", locationSchema),
  AuditLog: mongoose.model("AdminAuditLog", auditSchema)
};
