const User = require("../models/User");
const Worker = require("../models/Worker");
const { signToken } = require("../utils/jwt");
const httpError = require("../utils/httpError");

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/",
  maxAge: 12 * 60 * 60 * 1000
};

async function findUserWithCredentials(req, allowedRoles) {
  const user = await User.findOne({ email: req.body.email }).select("+password");
  if (
    !user ||
    !user.active ||
    !allowedRoles.includes(user.role) ||
    !(await user.comparePassword(req.body.password))
  ) {
    throw httpError(401, "Email or password is incorrect.");
  }
  return user;
}

async function register(req, res) {
  const { name, email, phone, password, role = "customer" } = req.body;
  if (await User.exists({ email })) {
    throw httpError(409, "An account with this email already exists.");
  }

  const user = new User({ name, email, phone, password, role });
  await user.save();

  let createdWorker;
  try {
    if (role === "worker") {
      createdWorker = await Worker.create({
        user: user._id,
        name,
        profession: req.body.profession,
        category: req.body.category,
        city: req.body.city,
        experience: req.body.experience,
        price: req.body.price,
        priceUnit: "hour",
        description: req.body.description,
        approvalStatus: "pending",
        available: false
      });
      user.worker = createdWorker._id;
      await user.save();
    }
  } catch (error) {
    try {
      if (createdWorker) await Worker.deleteOne({ _id: createdWorker._id });
    } finally {
      await User.deleteOne({ _id: user._id });
    }
    throw error;
  }

  res.cookie("kg_session", signToken(user), cookieOptions);
  res.status(201).json({
    message: role === "worker"
      ? "Professional account created. Your profile is awaiting admin approval."
      : "Your account is ready.",
    user: user.toSafeObject()
  });
}

async function login(req, res) {
  const user = await findUserWithCredentials(req, ["customer", "worker"]);
  res.cookie("kg_session", signToken(user), cookieOptions);
  res.json({ message: "Welcome back.", user: user.toSafeObject() });
}

async function adminLogin(req, res) {
  const user = await findUserWithCredentials(req, ["admin"]);
  res.cookie("kg_admin_session", signToken(user), cookieOptions);
  res.json({ message: "Welcome back.", user: user.toSafeObject() });
}

function logout(req, res) {
  res.clearCookie("kg_session", { ...cookieOptions, maxAge: undefined });
  res.json({ message: "You have been signed out." });
}

function logoutAdmin(req, res) {
  res.clearCookie("kg_admin_session", { ...cookieOptions, maxAge: undefined });
  res.json({ message: "You have been signed out." });
}

function me(req, res) {
  res.json({ user: req.user.toSafeObject() });
}

module.exports = { register, login, adminLogin, logout, logoutAdmin, me };
