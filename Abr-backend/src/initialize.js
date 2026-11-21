const mongoose = require("mongoose");
const ServiceCategory = require("./models/ServiceCategory");
const SupportMessage = require("./models/SupportMessage");
const { Coupon, MembershipPlan } = require("./models/Commerce");
const { Location } = require("./models/AdminManagement");
const { startDelivery } = require("./utils/supportWhatsApp");
const {
  serviceCategories: defaultServiceCategories,
  setServiceCategories
} = require("./config/serviceCategories");

const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  throw new Error("MONGODB_URI is missing. Add it to your .env file.");
}
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be set to a random secret of at least 32 characters.");
}

async function initialize() {
  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB.");
  await Promise.all(defaultServiceCategories.map(({ name, label, price }) =>
    ServiceCategory.updateOne(
      { normalizedName: name.toLowerCase() },
      { $setOnInsert: { name, label, price, active: true } },
      { upsert: true }
    )
  ));
  await ServiceCategory.updateMany({ price: { $exists: false } }, { $set: { price: 500 } });
  await ServiceCategory.updateMany({ active: { $exists: false } }, { $set: { active: true } });
  const categories = await ServiceCategory.find({ active: true }).select("name label price commission").sort({ name: 1 }).lean();
  setServiceCategories(categories);
  await Promise.all([SupportMessage.init(), Location.init(), Coupon.init(), MembershipPlan.init()]);
  startDelivery();
}

module.exports = initialize;
