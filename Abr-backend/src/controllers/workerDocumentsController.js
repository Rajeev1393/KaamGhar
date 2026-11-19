const fs = require("node:fs/promises");
const Worker = require("../models/Worker");
const httpError = require("../utils/httpError");
const {
  documentTypes,
  isValidFileSignature,
  saveWorkerDocument
} = require("../utils/workerDocuments");

const maximumDocuments = 10;

async function upload(req, res) {
  if (!req.file || !isValidFileSignature(req.file)) {
    throw httpError(400, "The file content does not match a supported PDF, JPG, or PNG document.");
  }
  if (!documentTypes.includes(req.body.type)) {
    throw httpError(400, "Choose a supported verification document type.");
  }

  const worker = await Worker.findOne({ _id: req.user.worker, user: req.user._id });
  if (!worker) throw httpError(404, "Professional profile was not found.");
  if (worker.verificationDocuments.length >= maximumDocuments) {
    throw httpError(400, `You can upload up to ${maximumDocuments} verification documents.`);
  }

  const saved = await saveWorkerDocument(req.file);
  try {
    worker.verificationDocuments.push({
      type: req.body.type,
      originalName: saved.originalName,
      storageName: saved.storageName,
      mimeType: req.file.mimetype,
      size: req.file.size,
      status: "pending"
    });
    await worker.save();
  } catch (error) {
    await fs.unlink(saved.filePath).catch((cleanupError) => {
      if (cleanupError.code !== "ENOENT") throw cleanupError;
    });
    throw error;
  }

  const document = worker.verificationDocuments[worker.verificationDocuments.length - 1];
  res.status(201).json({
    message: "Document uploaded for verification.",
    document: {
      _id: document._id,
      type: document.type,
      originalName: document.originalName,
      mimeType: document.mimeType,
      size: document.size,
      status: document.status,
      uploadedAt: document.uploadedAt
    }
  });
}

module.exports = { upload };
