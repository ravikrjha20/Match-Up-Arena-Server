const mongoose = require("mongoose");
const User = require("../model/userModel");
const UserFriend = require("../model/userFriends");
const CustomError = require("../errors");
const { StatusCodes } = require("http-status-codes");
const { io } = require("../db/socket");
const { getReceiverSocketId } = require("../db/storeSocket");
const {
  getCache,
  setCache,
  delCache,
  redisKey,
} = require("../utils/redisHelper");

const emitToUser = (userId, event) => {
  const socketId = getReceiverSocketId(userId);

  if (socketId) io.to(socketId).emit(event);
};

const getUserSafeProfile = async (userId) => {
  const cacheKey = redisKey("user", userId);
  let user = await getCache(cacheKey);

  if (!user) {
    user = await User.findById(userId)
      .select("_id username name avatar isOnline win lost draw")
      .lean();
    if (user) await setCache(cacheKey, user); // cache for later
  }
  return user;
};

// --- WRITE OPERATIONS (with Cache Invalidation) ---

const sendRequest = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const { friendId } = req.params;

    if (userId === friendId)
      throw new CustomError.BadRequestError("Cannot request yourself");

    const [userNet, friendNet, friendExists] = await Promise.all([
      UserFriend.findOneAndUpdate(
        { userId },
        { userId },
        { upsert: true, new: true }
      ),
      UserFriend.findOneAndUpdate(
        { userId: friendId },
        { userId: friendId },
        { upsert: true, new: true }
      ),
      User.findById(friendId),
    ]);
    if (!friendExists) throw new CustomError.NotFoundError("User not found");
    if (userNet.friends.some((f) => f.friendId.equals(friendId)))
      throw new CustomError.BadRequestError("Already friends");
    if (userNet.outgoingRequests.some((r) => r.friendId.equals(friendId)))
      throw new CustomError.BadRequestError("Already requested");
    if (userNet.incomingRequests.some((r) => r.friendId.equals(friendId)))
      throw new CustomError.BadRequestError("They already sent you a request");

    userNet.outgoingRequests.push({ friendId });
    friendNet.incomingRequests.push({ friendId: userId });

    await Promise.all([userNet.save(), friendNet.save()]);

    // Invalidate caches
    await delCache([
      redisKey("requests:outgoing", userId),
      redisKey("requests:incoming", friendId),
    ]);

    emitToUser(friendId, "updateIncomingRequest");
    emitToUser(userId, "updateOutgoingReq");

    res.status(StatusCodes.OK).json({ msg: "Request sent" });
  } catch (err) {
    next(err);
  }
};

const cancelRequest = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const { friendId } = req.params;

    const [senderNet, recipientNet] = await Promise.all([
      UserFriend.findOne({ userId }),
      UserFriend.findOne({ userId: friendId }),
    ]);

    if (!senderNet?.outgoingRequests.some((r) => r.friendId.equals(friendId))) {
      throw new CustomError.NotFoundError("Friend request not found.");
    }

    senderNet.outgoingRequests.pull({ friendId });
    recipientNet?.incomingRequests.pull({ friendId: userId });

    await Promise.all([senderNet.save(), recipientNet?.save()].filter(Boolean));

    // Invalidate caches
    await delCache([
      redisKey("requests:outgoing", userId),
      redisKey("requests:incoming", friendId),
    ]);

    emitToUser(friendId, "updateIncomingRequest");
    emitToUser(userId, "updateOutgoingReq");

    res.status(StatusCodes.OK).json({ msg: "Request canceled" });
  } catch (err) {
    next(err);
  }
};

const acceptRequest = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const { friendId } = req.params;

    const [userNet, friendNet, user, friend] = await Promise.all([
      UserFriend.findOne({ userId }),
      UserFriend.findOne({ userId: friendId }),
      User.findById(userId).select("username").lean(),
      User.findById(friendId).select("username").lean(),
    ]);

    if (!userNet || !friendNet)
      throw new CustomError.NotFoundError("Network not found");
    if (!userNet.incomingRequests.some((r) => r.friendId.equals(friendId)))
      throw new CustomError.BadRequestError("No such request");

    userNet.incomingRequests.pull({ friendId });
    friendNet.outgoingRequests.pull({ friendId: userId });
    userNet.friends.push({ friendId });
    friendNet.friends.push({ friendId: userId });

    await Promise.all([userNet.save(), friendNet.save()]);

    // Invalidate all relevant caches for both users
    await delCache([
      redisKey("requests:incoming", userId),
      redisKey("requests:outgoing", friendId),
      redisKey("friends", user.username),
      redisKey("friends", friend.username),
    ]);

    emitToUser(userId, "updateFriendList");
    emitToUser(friendId, "updateFriendList");

    res.status(StatusCodes.OK).json({ msg: "Friend request accepted" });
  } catch (err) {
    next(err);
  }
};

const declineRequest = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const { friendId } = req.params;

    const [userNet, friendNet] = await Promise.all([
      UserFriend.findOne({ userId }),
      UserFriend.findOne({ userId: friendId }),
    ]);

    if (!userNet?.incomingRequests.some((r) => r.friendId.equals(friendId))) {
      throw new CustomError.BadRequestError("No such request");
    }

    userNet.incomingRequests.pull({ friendId });
    friendNet?.outgoingRequests.pull({ friendId: userId });

    await Promise.all([userNet.save(), friendNet?.save()].filter(Boolean));

    // Invalidate caches
    await delCache([
      redisKey("requests:incoming", userId),
      redisKey("requests:outgoing", friendId),
    ]);

    emitToUser(userId, "updateIncomingRequest");
    emitToUser(friendId, "updateOutgoingReq");

    res.status(StatusCodes.OK).json({ msg: "Friend request declined" });
  } catch (err) {
    next(err);
  }
};

const removeFriend = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const { friendId } = req.params;

    const [userNet, friendNet, user, friend] = await Promise.all([
      UserFriend.findOne({ userId }),
      UserFriend.findOne({ userId: friendId }),
      User.findById(userId).select("username").lean(),
      User.findById(friendId).select("username").lean(),
    ]);

    if (!userNet || !friendNet)
      throw new CustomError.NotFoundError("Network not found");

    userNet.friends.pull({ friendId });
    friendNet.friends.pull({ friendId: userId });

    await Promise.all([userNet.save(), friendNet.save()]);

    // Invalidate friend list caches for both users
    await delCache([
      redisKey("friends", user.username),
      redisKey("friends", friend.username),
    ]);
    console.log("done");

    emitToUser(userId, "friendRemoved");
    emitToUser(friendId, "friendRemoved");

    res.status(StatusCodes.OK).json({ msg: "Friend removed" });
  } catch (err) {
    next(err);
  }
};

// --- READ OPERATIONS (Cache-Aside) ---

const searchUsers = async (req, res, next) => {
  try {
    const q = (req.query.name || req.query.username || "").trim();
    if (!q) return res.json({ suggestions: [] });

    const cacheKey = redisKey("search:users", q);
    const cachedUsers = await getCache(cacheKey);

    if (cachedUsers) {
      console.log("found in redis");

      return res.status(200).json({ suggestions: cachedUsers });
    }

    const users = await User.find({
      $or: [
        { username: { $regex: q, $options: "i" } },
        { name: { $regex: q, $options: "i" } },
      ],
    })
      .select("_id name username avatar")
      .limit(20)
      .lean();

    await setCache(cacheKey, users, 300); // 5-min TTL

    res.status(StatusCodes.OK).json({ suggestions: users });
  } catch (err) {
    next(err);
  }
};

const getUserProfile = async (req, res, next) => {
  try {
    const { username } = req.params;
    const cacheKey = redisKey("profile", username);
    let profile = await getCache(cacheKey);

    if (!profile) {
      profile = await User.findOne({ username }).lean();
      if (!profile) throw new CustomError.NotFoundError("User not found");
      await setCache(cacheKey, profile);
    }
    // console.log("found in redis");

    const { password, ...safeProfile } = profile;
    res.status(StatusCodes.OK).json({ profile: safeProfile });
  } catch (error) {
    next(error);
  }
};
// Helper: get full user info from cache or DB

const getIncomingRequests = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const cacheKey = redisKey("requests:incoming", userId);
    let requests = await getCache(cacheKey);

    if (!requests) {
      const userNet = await UserFriend.findOne({ userId })
        .select("incomingRequests")
        .lean();

      requests = userNet?.incomingRequests || [];
      await setCache(cacheKey, requests);
    }

    // Enrich requests with user data
    const detailedRequests = await Promise.all(
      requests.map(async (r) => {
        const friend = await getUserSafeProfile(r.friendId);
        return { ...friend, requestedAt: r.createdAt };
      })
    );

    res.status(StatusCodes.OK).json({ requests: detailedRequests });
  } catch (err) {
    next(err);
  }
};

const getOutgoingRequests = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const cacheKey = redisKey("requests:outgoing", userId);
    let requests = await getCache(cacheKey);

    if (!requests) {
      const userNet = await UserFriend.findOne({ userId })
        .select("outgoingRequests")
        .lean();

      requests = userNet?.outgoingRequests || [];
      await setCache(cacheKey, requests);
    }

    // Enrich with user data
    const detailedRequests = await Promise.all(
      requests.map(async (r) => {
        const friend = await getUserSafeProfile(r.friendId);
        return { ...friend, requestedAt: r.createdAt };
      })
    );

    res.status(StatusCodes.OK).json({ requests: detailedRequests });
  } catch (err) {
    next(err);
  }
};

const getAllFriends = async (req, res, next) => {
  try {
    const { friendUsername } = req.params;
    const cacheKey = redisKey("friends", friendUsername);
    let friends = await getCache(cacheKey);

    if (!friends) {
      const user = await User.findOne({ username: friendUsername })
        .select("_id")
        .lean();
      if (!user) throw new CustomError.NotFoundError("User not found");

      const userNet = await UserFriend.findOne({ userId: user._id })
        .select("friends")
        .lean();

      friends = userNet ? userNet.friends.map((f) => f.friendId) : [];
      await setCache(cacheKey, friends);
    }

    // Enrich with user data
    const detailedFriends = await Promise.all(
      friends.map(async (fid) => await getUserSafeProfile(fid))
    );

    res.status(StatusCodes.OK).json({ friends: detailedFriends });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  sendRequest,
  acceptRequest,
  declineRequest,
  removeFriend,
  searchUsers,
  getIncomingRequests,
  getOutgoingRequests,
  getAllFriends,
  getUserProfile,
  cancelRequest,
};
