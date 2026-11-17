const jwt = require("jsonwebtoken");

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be set to a random secret of at least 32 characters.");
  }
  return secret;
}

function signToken(user) {
  return jwt.sign({ sub: user.id.toString(), role: user.role }, getSecret(), {
    expiresIn: "12h",
    issuer: "kaamghar"
  });
}

function verifyToken(token) {
  return jwt.verify(token, getSecret(), { issuer: "kaamghar" });
}

module.exports = { signToken, verifyToken };
