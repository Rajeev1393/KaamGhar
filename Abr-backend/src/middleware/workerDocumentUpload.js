const multer = require("multer");
const httpError = require("../utils/httpError");

const allowedTypes = new Map([
  [".pdf", "application/pdf"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"]
]);

const parser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(req, file, callback) {
    const extension = file.originalname.slice(file.originalname.lastIndexOf(".")).toLowerCase();
    if (!allowedTypes.has(extension) || allowedTypes.get(extension) !== file.mimetype) {
      callback(new Error("Upload a PDF, JPG, JPEG, or PNG document."));
      return;
    }
    callback(null, true);
  }
}).single("document");

function uploadWorkerDocument(req, res, next) {
  parser(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return next(httpError(413, "Each verification document must be 5 MB or smaller."));
    }
    if (error instanceof multer.MulterError) {
      return next(httpError(400, "Upload one verification document at a time."));
    }
    return next(httpError(400, error.message));
  });
}

module.exports = uploadWorkerDocument;
