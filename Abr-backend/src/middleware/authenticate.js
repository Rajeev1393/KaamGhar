const User = require("../models/User");
const { verifyToken } = require("../utils/jwt");

async function authenticate(req, res, next) {
  try {
    const requestPath = (req.originalUrl || "").split("?")[0];
    const cookieName = requestPath === "/api/admin" || requestPath.startsWith("/api/admin/")
      ? "kg_admin_session"
      : "kg_session";
    const token = req.cookies && req.cookies[cookieName];
    if (!token) {
      return res.status(401).json({ message: "Please sign in to continue." });
    }

    const payload = verifyToken(token);
    const user = await User.findById(payload.sub);
    if (!user || !user.active || user.role !== payload.role) {
      return res.status(401).json({ message: "Your session is no longer valid. Please sign in again." });
    }

    req.user = user;
    return next();
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Please sign in again." });
    }
    return next(error);
  }
}

function authorize(...roles) {
  return function roleGuard(req, res, next) {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "You do not have permission to perform this action." });
    }
    return next();
  };
}

module.exports = { authenticate, authorize };
