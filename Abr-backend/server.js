require("dotenv").config();

const mongoose = require("mongoose");
const app = require("./src/app");
const ServiceCategory = require("./src/models/ServiceCategory");
const SupportMessage = require("./src/models/SupportMessage");
const { startDelivery } = require("./src/utils/supportWhatsApp");
const {
  serviceCategories: defaultServiceCategories,
  setServiceCategories
} = require("./src/config/serviceCategories");

const PORT = process.env.PORT || 3000;
const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  console.error("MONGODB_URI is missing. Add it to your .env file.");
  process.exit(1);
}
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error("JWT_SECRET must be set to a random secret of at least 32 characters.");
  process.exit(1);
}

async function start(requestHandler = app) {
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
  await SupportMessage.init();
  startDelivery();
  return require("node:http").createServer(requestHandler).listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

if (require.main === module) {
  start().catch((error) => {
    console.error("Could not start the backend:", error.message);
    process.exit(1);
  });
}

module.exports = start;
