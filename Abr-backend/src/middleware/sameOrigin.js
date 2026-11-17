function sameOrigin(req, res, next) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();

  const origin = req.get("origin");
  if (!origin) return next();

  try {
    const parsedOrigin = new URL(origin);
    if (
      !["http:", "https:"].includes(parsedOrigin.protocol) ||
      parsedOrigin.host !== req.get("host")
    ) {
      return res.status(403).json({ message: "Cross-origin requests are not allowed." });
    }
    return next();
  } catch (error) {
    return res.status(403).json({ message: "Invalid request origin." });
  }
}

module.exports = sameOrigin;
