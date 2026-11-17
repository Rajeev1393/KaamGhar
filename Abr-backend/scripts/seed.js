require("dotenv").config();

const mongoose = require("mongoose");
const Worker = require("../src/models/Worker");
const User = require("../src/models/User");

const sampleWorkers = [
  {
    name: "Ramesh Kumar",
    profession: "Expert plumber",
    category: "Plumber",
    city: "Delhi",
    experience: 8,
    rating: 4.9,
    reviewCount: 128,
    price: 299,
    priceUnit: "hour",
    approvalStatus: "approved",
    description: "Tap, pipe aur bathroom repairs ka experienced professional."
  },
  {
    name: "Sandeep Sharma",
    profession: "Electrician",
    category: "Electrician",
    city: "Delhi",
    experience: 6,
    rating: 4.8,
    reviewCount: 94,
    price: 249,
    priceUnit: "hour",
    approvalStatus: "approved",
    description: "Safe wiring, switch aur appliance installation."
  },
  {
    name: "Imran Ali",
    profession: "Home cleaning specialist",
    category: "Cleaning",
    city: "Delhi",
    experience: 5,
    rating: 4.9,
    reviewCount: 76,
    price: 499,
    priceUnit: "hour",
    approvalStatus: "approved",
    description: "Ghar ki deep cleaning ke liye reliable service."
  },
  {
    name: "Vikram Singh",
    profession: "AC repair technician",
    category: "AC Repair",
    city: "Delhi",
    experience: 7,
    rating: 4.7,
    reviewCount: 63,
    price: 399,
    priceUnit: "hour",
    approvalStatus: "approved",
    description: "AC servicing, installation aur repair."
  },
  {
    name: "Pooja Verma",
    profession: "Professional beautician",
    category: "Salon",
    city: "Delhi",
    experience: 5,
    rating: 4.9,
    reviewCount: 112,
    price: 599,
    priceUnit: "hour",
    approvalStatus: "approved",
    description: "Convenient salon services at your home."
  },
  {
    name: "Arjun Patel",
    profession: "Carpenter",
    category: "Carpenter",
    city: "Mumbai",
    experience: 9,
    rating: 4.8,
    reviewCount: 88,
    price: 349,
    priceUnit: "hour",
    approvalStatus: "approved",
    description: "Furniture repair, fitting aur custom woodwork."
  },
  {
    name: "Neha Gupta",
    profession: "Home cleaning specialist",
    category: "Cleaning",
    city: "Mumbai",
    experience: 4,
    rating: 4.8,
    reviewCount: 58,
    price: 499,
    priceUnit: "hour",
    approvalStatus: "approved",
    description: "Har kone ki safai, professional equipment ke saath."
  },
  {
    name: "Amit Yadav",
    profession: "Expert plumber",
    category: "Plumber",
    city: "Bengaluru",
    experience: 7,
    rating: 4.7,
    reviewCount: 71,
    price: 299,
    priceUnit: "hour",
    approvalStatus: "approved",
    description: "Leakage aur plumbing installation ka quick solution."
  },
  {
    name: "Karan Mehta",
    profession: "Electrician",
    category: "Electrician",
    city: "Bengaluru",
    experience: 8,
    rating: 4.9,
    reviewCount: 103,
    price: 249,
    priceUnit: "hour",
    approvalStatus: "approved",
    description: "Ghar ki electrical problems, safely handled."
  },
  {
    name: "Rahul Das",
    profession: "AC repair technician",
    category: "AC Repair",
    city: "Mumbai",
    experience: 6,
    rating: 4.8,
    reviewCount: 82,
    price: 399,
    priceUnit: "hour",
    approvalStatus: "approved",
    description: "AC servicing aur repair, ghar par."
  }
];

async function seedWorkers() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing. Add it to your .env file.");
  }

  await mongoose.connect(process.env.MONGODB_URI);
  for (const worker of sampleWorkers) {
    await Worker.updateOne(
      { name: worker.name, city: worker.city },
      { $set: worker },
      { upsert: true, runValidators: true }
    );
  }
  console.log(`Seeded ${sampleWorkers.length} sample professionals.`);

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword || adminPassword.length < 12) {
    console.warn("Admin bootstrap skipped. Set ADMIN_EMAIL and an ADMIN_PASSWORD of at least 12 characters in .env to create the admin account.");
    return;
  }
  const existingAdmin = await User.findOne({ email: adminEmail.toLowerCase() });
  if (existingAdmin) {
    existingAdmin.role = "admin";
    existingAdmin.active = true;
    await existingAdmin.save();
  } else {
    await User.create({
      name: "KaamGhar Admin",
      email: adminEmail,
      phone: "0000000000",
      password: adminPassword,
      role: "admin"
    });
  }
  console.log("Admin account is ready.");
}

seedWorkers()
  .catch((error) => {
    console.error("Could not seed sample professionals:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
