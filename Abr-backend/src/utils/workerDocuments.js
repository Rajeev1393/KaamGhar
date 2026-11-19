const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const privateDirectory = path.resolve(__dirname, "..", "..", "private-storage", "worker-documents");
const documentTypes = ["identity", "address", "certificate", "other", "aadhaar", "pan", "police_verification"];

function isValidFileSignature(file) {
  const buffer = file.buffer;
  if (file.mimetype === "application/pdf") return buffer.subarray(0, 5).toString() === "%PDF-";
  if (file.mimetype === "image/jpeg") return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (file.mimetype === "image/png") {
    return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  return false;
}

function safeOriginalName(name) {
  return path.basename(name).replace(/[^\w.-]/g, "_").slice(0, 180) || "document";
}

async function saveWorkerDocument(file) {
  await fs.mkdir(privateDirectory, { recursive: true });
  const extension = path.extname(safeOriginalName(file.originalname)).toLowerCase();
  const storageName = `${crypto.randomUUID()}${extension}`;
  const filePath = path.join(privateDirectory, storageName);
  await fs.writeFile(filePath, file.buffer, { flag: "wx", mode: 0o600 });
  return { storageName, filePath, originalName: safeOriginalName(file.originalname) };
}

function getWorkerDocumentPath(storageName) {
  if (!/^[\w-]+\.(pdf|jpg|jpeg|png)$/i.test(storageName)) return null;
  const filePath = path.resolve(privateDirectory, storageName);
  return path.dirname(filePath) === privateDirectory ? filePath : null;
}

module.exports = { documentTypes, getWorkerDocumentPath, isValidFileSignature, saveWorkerDocument };
