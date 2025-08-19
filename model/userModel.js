const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const matchHistorySchema = new mongoose.Schema(
  {
    opponent: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    result: { type: String, enum: ["win", "loss", "draw"], required: true },
    date: { type: Date, default: Date.now },
    mode: { type: String, enum: ["1v1", "bot"], default: "1v1" },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, minlength: 3 },
    username: { type: String, required: true, unique: true, minlength: 3 },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true, minlength: 8 },

    // Gameplay stats
    rating: { type: Number, default: 0 },
    coins: { type: Number, default: 500 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    draws: { type: Number, default: 0 },

    // Match history
    matches: [matchHistorySchema],

    // Real-time presence
    isOnline: { type: Boolean, default: false },

    // Optional avatar
    image: { type: String, default: "" },
  },
  { timestamps: true }
);

userSchema.pre(`save`, async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  const isMatch = await bcrypt.compare(candidatePassword, this.password);
  return isMatch;
};
module.exports = mongoose.model("User", userSchema);
