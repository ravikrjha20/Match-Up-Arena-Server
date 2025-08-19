require(`dotenv`).config();
const { Server } = require("socket.io");
const http = require("http");
const express = require("express");
const { v4: uuidv4 } = require("uuid");
const mongoose = require("mongoose");
const User = require("../model/userModel"); // adjust path to your model
const {
  getReceiverSocketId,
  createMatch,
  getMatchByPlayerId,
  removeMatch,
  userSocketMap,
  matchQueue,
  currentMatches,
  cancelPlayerSearch,
  addPlayerToQueue,
} = require("./storeSocket");

const allowedOrigins = process.env.CLIENT_URLS.split(",");
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
  },
});

io.on("connection", async (socket) => {
  console.log("A user connected", userSocketMap);

  const userId = socket.handshake.query.userId;

  if (userId) {
    userSocketMap[userId] = socket.id;

    // Mark user as online in DB
    try {
      await User.findByIdAndUpdate(userId, { isOnline: true });
      console.log(`✅ User ${userId} is now online`);
    } catch (err) {
      console.error(`❌ Failed to update online status for ${userId}:`, err);
    }
  }

  socket.on("cancelSearch", () => {
    if (userId && matchQueue.has(userId)) {
      clearTimeout(matchQueue.get(userId));
      matchQueue.delete(userId);
      console.log(`🚫 User ${userId} cancelled their search.`);
    }
  });

  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  socket.on("disconnect", async () => {
    console.log("A user disconnected", socket.id);

    if (userId) {
      // Mark user as offline in DB
      try {
        await User.findByIdAndUpdate(userId, { isOnline: false });
        console.log(`🚪 User ${userId} is now offline`);
      } catch (err) {
        console.error(`❌ Failed to update offline status for ${userId}:`, err);
      }
    }

    // If they were in match queue, remove them
    if (userId && matchQueue.has(userId)) {
      clearTimeout(matchQueue.get(userId));
      matchQueue.delete(userId);
      console.log(
        `👻 User ${userId} removed from match queue due to disconnect.`
      );
    }

    // If they were in a match, remove match and notify opponent
    const match = getMatchByPlayerId(userId);
    if (match) {
      currentMatches.delete(match.matchId);

      const opponentId =
        match.player1Id === userId ? match.player2Id : match.player1Id;
      const opponentSocketId = getReceiverSocketId(opponentId);

      if (opponentSocketId) {
        io.to(opponentSocketId).emit("opponentLeft", {
          matchId: match.matchId,
          opponentId: userId,
          message: "Your opponent has left the match.",
        });
      }

      console.log(
        `❌ Match ${match.matchId} ended because ${userId} disconnected.`
      );
    }

    delete userSocketMap[userId];
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

module.exports = {
  io,
  app,
  server,
  getReceiverSocketId,
  matchQueue,
  currentMatches,
  createMatch,
  getMatchByPlayerId,
  removeMatch,
  cancelPlayerSearch,
  addPlayerToQueue,
};
