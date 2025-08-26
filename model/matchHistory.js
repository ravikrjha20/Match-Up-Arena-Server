const mongoose = require("mongoose");

const matchHistorySchema = new mongoose.Schema(
  {
    player1: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      name: { type: String, required: true }, // Added player1 name
      result: { type: String, enum: ["win", "loss", "draw"], required: true },
    },
    player2: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      name: { type: String, required: true }, // Added player2 name
      result: { type: String, enum: ["win", "loss", "draw"], required: true },
    },
    playedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MatchHistory", matchHistorySchema);
