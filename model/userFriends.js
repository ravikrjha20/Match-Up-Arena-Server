const mongoose = require("mongoose");

// Accepted friends with game stats
const friendStatsSchema = new mongoose.Schema({
  friendId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  draws: { type: Number, default: 0 },
});

// Incoming pending requests
const incomingRequestSchema = new mongoose.Schema({
  friendId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  requestedAt: { type: Date, default: Date.now },
});

// Outgoing requests pending
const outgoingRequestSchema = new mongoose.Schema({
  friendId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  requestedAt: { type: Date, default: Date.now },
});

const userFriendSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  friends: [friendStatsSchema],
  incomingRequests: [incomingRequestSchema],
  outgoingRequests: [outgoingRequestSchema],
});

userFriendSchema.index({ userId: 1 });

module.exports = mongoose.model("UserFriend", userFriendSchema);
