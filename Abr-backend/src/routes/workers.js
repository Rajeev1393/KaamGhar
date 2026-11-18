const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { authenticate, authorize } = require("../middleware/authenticate");
const workersController = require("../controllers/workersController");
const workerDocumentsController = require("../controllers/workerDocumentsController");
const uploadWorkerDocument = require("../middleware/workerDocumentUpload");

const router = express.Router();

router.get("/categories", asyncHandler(workersController.listCategories));
router.get("/me", authenticate, authorize("worker"), asyncHandler(workersController.getOwnProfile));
router.get("/me/earnings", authenticate, authorize("worker"), asyncHandler(workersController.getOwnEarnings));
router.post(
  "/me/documents",
  authenticate,
  authorize("worker"),
  uploadWorkerDocument,
  asyncHandler(workerDocumentsController.upload)
);
router.get("/", asyncHandler(workersController.listPublic));
router.patch("/me", authenticate, authorize("worker"), asyncHandler(workersController.updateOwnProfile));

module.exports = router;
