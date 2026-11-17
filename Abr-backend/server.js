require("dotenv").config();

const mongoose = require("mongoose");
const app = require("./src/app");
const ServiceCategory = require("./src/models/ServiceCategory");
const {
  serviceCategories: defaultServiceCategories,
  setServiceCategories
} = require("./src/config/serviceCategories");

const port = Number(process.env.PORT) || 3000;
const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  console.error("MONGODB_URI is missing. Add it to your .env file.");
  process.exit(1);
}
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error("JWT_SECRET must be set to a random secret of at least 32 characters.");
  process.exit(1);
}

async function start() {
  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB.");
  await Promise.all(defaultServiceCategories.map(({ name, label }) =>
    ServiceCategory.updateOne(
      { normalizedName: name.toLowerCase() },
      { $setOnInsert: { name, label } },
      { upsert: true }
    )
  ));
  const categories = await ServiceCategory.find().select("name label").sort({ name: 1 }).lean();
  setServiceCategories(categories);
  app.listen(port, () => {
    console.log(`KaamGhar is running at http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error("Could not start the backend:", error.message);
  process.exit(1);
});
