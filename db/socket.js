require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const User = require("../model/userModel");
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

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URLS.split(","),
    credentials: true,
  },
  transports: ["websocket"], // ← no polling ⇒ no 400
});

/* ---------------- socket handlers ---------------- */
io.on("connection", async (socket) => {
  const userId = socket.handshake.query.userId;
  console.log("⚡ socket connected:", socket.id, userId);

  if (userId) {
    userSocketMap[userId] = socket.id;
    await User.findByIdAndUpdate(userId, { isOnline: true }).catch(
      console.error
    );
  }

  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  socket.on("cancelSearch", () => cancelPlayerSearch(userId));
  socket.on("disconnect", async () => {
    console.log("🚪 socket disconnected:", socket.id);
    if (userId) {
      await User.findByIdAndUpdate(userId, { isOnline: false }).catch(
        console.error
      );
      removeMatch(userId, io);
      matchQueue.delete(userId);
      delete userSocketMap[userId];
    }
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});
/* -------------------------------------------------- */

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
