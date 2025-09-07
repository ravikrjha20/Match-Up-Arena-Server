// seedUsers.js
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./model/userModel");

const MONGO_URI = process.env.MONGO_URI;

// Random helpers
const getRandomInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const indianNames = [
  "Ravi",
  "Nirwan",
  "Arya",
  "Ananya",
  "Kabir",
  "Ishita",
  "Aditya",
  "Kavya",
  "Rohan",
  "Priya",
  "Siddharth",
  "Meera",
  "Arjun",
  "Radha",
  "Vikram",
  "Neha",
  "Aarav",
  "Shreya",
  "Dev",
  "Pooja",
  "Manish",
  "Rekha",
  "Lakshya",
  "Sakshi",
  "Krishna",
  "Gauri",
  "Omkar",
  "Anjali",
  "Vivek",
  "Tanvi",
];

// Simple ELO calculation
function calculateElo(currentRating, opponentRating, result) {
  const K = 32;
  const expected =
    1 / (1 + Math.pow(10, (opponentRating - currentRating) / 400));
  let score = 0;
  if (result === "win") score = 1;
  else if (result === "draw") score = 0.5;
  else score = 0;
  return Math.round(currentRating + K * (score - expected));
}

async function seedUsers() {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("✅ MongoDB connected");
    await User.deleteMany({});
    console.log("🗑️ Old users cleared");

    const users = [];

    for (let i = 0; i < 30; i++) {
      const name = indianNames[getRandomInt(0, indianNames.length - 1)];
      const username = `${name.toLowerCase()}${i}`;
      const email = `${username}@example.in`;

      // base stats
      let rating = 1000;
      let wins = getRandomInt(0, 50);
      let losses = getRandomInt(0, 50);
      let draws = getRandomInt(0, 20);

      const totalMatches = wins + losses + draws;

      // simulate matches to adjust rating
      for (let m = 0; m < totalMatches; m++) {
        const opponentRating = getRandomInt(800, 2400);
        let result;
        if (wins > 0) {
          result = "win";
          wins--;
        } else if (losses > 0) {
          result = "loss";
          losses--;
        } else {
          result = "draw";
          draws--;
        }
        rating = calculateElo(rating, opponentRating, result);
      }

      // Reset counts realistically
      const finalWins = getRandomInt(5, 60);
      const finalLosses = getRandomInt(5, 60);
      const finalDraws = getRandomInt(0, 20);

      users.push(
        new User({
          name,
          username,
          email,
          password: "password123",
          rating,
          coins: getRandomInt(500, 5000),
          wins: finalWins,
          losses: finalLosses,
          draws: finalDraws,
          avatar: getRandomInt(0, 5),
        })
      );
    }

    await User.insertMany(users);
    console.log("🎉 Inserted 30 realistic dummy users with ELO-based ratings");

    process.exit();
  } catch (err) {
    console.error("❌ Error seeding users:", err);
    process.exit(1);
  }
}

seedUsers();
