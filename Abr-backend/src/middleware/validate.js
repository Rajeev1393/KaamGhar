const httpError = require("../utils/httpError");
const { findServiceCategory, getServiceCategories } = require("../config/serviceCategories");

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[+]?[\d\s()-]{8,20}$/;

function requiredString(value, name, min = 1, max = 300) {
  if (typeof value !== "string" || value.trim().length < min || value.trim().length > max) {
    throw httpError(400, `${name} must be between ${min} and ${max} characters.`);
  }
  return value.trim();
}

function validateRegister(req, res, next) {
  try {
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw httpError(400, "Please submit valid account details.");
    }
    body.name = requiredString(body.name, "Name", 2, 80);
    body.email = requiredString(body.email, "Email", 3, 254).toLowerCase();
    body.phone = requiredString(body.phone, "Phone", 8, 20);
    if (!emailPattern.test(body.email) || !phonePattern.test(body.phone)) {
      throw httpError(400, "Please enter a valid email address and phone number.");
    }
    if (typeof body.password !== "string" || body.password.length < 8 || body.password.length > 72) {
      throw httpError(400, "Password must be 8 to 72 characters long.");
    }
    if (body.role !== undefined && !["customer", "worker"].includes(body.role)) {
      throw httpError(400, "Choose either a customer or professional account.");
    }
    if (body.role === "worker") {
      body.profession = requiredString(body.profession, "Profession", 2, 80);
      body.category = requiredString(body.category, "Service category", 2, 60);
      const serviceCategory = findServiceCategory(body.category);
      if (!serviceCategory) {
        throw httpError(400, `Choose a service category: ${getServiceCategories().map(({ name }) => name).join(", ")}.`);
      }
      body.category = serviceCategory.name;
      body.city = requiredString(body.city, "City", 2, 80);
      body.description = requiredString(body.description, "Professional introduction", 10, 300);
      const experience = Number(body.experience);
      const price = Number(body.price);
      if (!Number.isInteger(experience) || experience < 0 || experience > 60) {
        throw httpError(400, "Experience must be between 0 and 60 years.");
      }
      if (!Number.isFinite(price) || price < 1 || price > 1000000) {
        throw httpError(400, "Starting price must be greater than zero.");
      }
      body.experience = experience;
      body.price = price;
      body.priceUnit = "hour";
    }
    return next();
  } catch (error) {
    return next(error);
  }
}

function validateLogin(req, res, next) {
  try {
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw httpError(400, "Please submit valid login details.");
    }
    body.email = requiredString(body.email, "Email", 3, 254).toLowerCase();
    if (!emailPattern.test(body.email) || typeof body.password !== "string" || !body.password) {
      throw httpError(400, "Enter a valid email and password.");
    }
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = { validateRegister, validateLogin, requiredString, emailPattern, phonePattern };
