const express = require("express");
const { authenticate, authorize } = require("../middleware/authenticate");
const asyncHandler = require("../utils/asyncHandler");
const support = require("../controllers/supportController");
const { uploadSupportDocument } = require("../middleware/workerDocumentUpload");

const router = express.Router();
router.use(authenticate, authorize("customer"));
router.get("/", asyncHandler(support.customerThread));
router.post("/", uploadSupportDocument, asyncHandler(support.customerMessage));
router.get("/:messageId/attachment", asyncHandler(support.customerAttachment));

module.exports = router;
