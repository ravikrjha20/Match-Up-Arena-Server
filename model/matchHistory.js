const mongoose = require("mongoose");

const matchHistorySchema = new mongoose.Schema(
  {
    player1: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      result: { type: String, enum: ["win", "loss", "draw"], required: true },
    },
    player2: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      result: { type: String, enum: ["win", "loss", "draw"], required: true },
    },
    playedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
module.exports = mongoose.model("MatchHistory", matchHistorySchema);
