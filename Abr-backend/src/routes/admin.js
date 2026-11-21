const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { authenticate, authorize } = require("../middleware/authenticate");
const { validateLogin } = require("../middleware/validate");
const loginRateLimiter = require("../middleware/loginRateLimiter");
const authController = require("../controllers/authController");
const adminController = require("../controllers/adminController");
const support = require("../controllers/supportController");
const { uploadSupportDocument } = require("../middleware/workerDocumentUpload");
const { requireAdminAccess } = require("../utils/adminAccess");
const management = require("./adminManagement");

const router = express.Router();
router.post("/auth/login", loginRateLimiter, validateLogin, asyncHandler(authController.adminLogin));
router.post("/auth/logout", asyncHandler(authController.logoutAdmin));
router.get("/auth/me", authenticate, authorize("admin"), asyncHandler(authController.me));
router.use(authenticate, authorize("admin"));
router.use(management.recordAdminChange, management.router);
router.get("/support", requireAdminAccess("support"), asyncHandler(support.inbox));
router.get("/support/:customerId", requireAdminAccess("support"), asyncHandler(support.adminThread));
router.post("/support/:customerId", requireAdminAccess("support"), uploadSupportDocument, asyncHandler(support.adminMessage));
router.get("/support/:customerId/:messageId/attachment", requireAdminAccess("support"), asyncHandler(support.adminAttachment));
router.get("/overview", requireAdminAccess("overview"), asyncHandler(adminController.overview));
router.get("/bookings", requireAdminAccess("bookings"), asyncHandler(adminController.listBookings));
router.get("/categories", requireAdminAccess("create-professional"), asyncHandler(adminController.listCategories));
router.post("/categories", requireAdminAccess("categories"), asyncHandler(adminController.createCategory));
router.patch("/categories/:name", requireAdminAccess("categories"), asyncHandler(adminController.updateCategoryPrice));
router.delete("/categories/:name", requireAdminAccess("categories"), asyncHandler(adminController.deleteCategory));
router.get("/professionals", requireAdminAccess("professionals"), asyncHandler(adminController.listProfessionals));
router.post("/professionals/:id/payouts/clear", requireAdminAccess("payouts"), asyncHandler(adminController.clearProfessionalPayouts));
router.post("/professionals", requireAdminAccess("create-professional"), asyncHandler(adminController.createProfessional));
router.delete("/professionals/:id", requireAdminAccess("staff"), asyncHandler(adminController.deleteProfessional));
router.patch("/professionals/:id/status", requireAdminAccess("verify"), asyncHandler(adminController.updateProfessionalStatus));
router.patch(
  "/professionals/:id/documents/:documentId",
  requireAdminAccess("verify"),
  asyncHandler(adminController.updateDocumentStatus)
);
router.get(
  "/professionals/:id/documents/:documentId/file",
  requireAdminAccess("verify"),
  asyncHandler(adminController.sendDocument)
);
router.get("/users", requireAdminAccess("accounts"), asyncHandler(adminController.listUsers));
router.patch("/users/:id/status", requireAdminAccess("staff"), asyncHandler(adminController.updateUserStatus));

module.exports = router;
