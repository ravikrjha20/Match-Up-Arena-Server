const User = require("../model/userModel");
const CustomError = require("../errors");
const { StatusCodes } = require("http-status-codes");
const { createTokenUser, attachCookiesToResponse } = require("../utils");
const { getCache, setCache } = require("../utils/redisHelper");

// REGISTER
const register = async (req, res) => {
  const { name, username, email, password, avatar } = req.body;

  if (!name || !username || !email || !password) {
    throw new CustomError.BadRequestError(
      "Please provide all required credentials"
    );
  }

  const emailExists = await User.findOne({ email });
  if (emailExists)
    throw new CustomError.BadRequestError("Email already in use");

  const usernameExists = await User.findOne({ username });
  if (usernameExists)
    throw new CustomError.BadRequestError("Username already taken");

  if (/\s/.test(username))
    throw new CustomError.BadRequestError("Username cannot contain spaces");

  const user = await User.create({ name, username, email, password, avatar });

  // Cache in Redis (primary key = userId)
  console.log(user);

  await setCache(`user:${user._id}`, user);
  await setCache(`username:${username}`, user._id.toString());
  await setCache(`email:${email}`, user._id.toString());

  const tokenUser = createTokenUser(user);
  attachCookiesToResponse({ res, user: tokenUser });

  const { password: _, ...safeUser } = user._doc;
  res.status(StatusCodes.CREATED).json({ user: safeUser });
};

// LOGIN
const login = async (req, res) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    throw new CustomError.BadRequestError(
      "Please provide email/username and password"
    );
  }

  let user;
  let userId;

  // 1️⃣ Try fetching userId from Redis
  if (identifier.includes("@")) {
    userId = await getCache(`email:${identifier}`);
  } else {
    userId = await getCache(`username:${identifier}`);
  }

  // 2️⃣ Fetch user from cache if userId found
  if (userId) {
    user = await getCache(`user:${userId}`);
  }

  // 3️⃣ Fallback to Mongo if not cached
  if (!user?.password) {
    user = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }],
    }).select("+password");
    if (!user)
      throw new CustomError.UnauthenticatedError("Invalid credentials");
    userId = user._id.toString();
  }
  console.log(user);
  let a = await getCache(`user:${userId}`);
  console.log(a);

  // 4️⃣ Compare passwords
  const hashedPassword = user.password;
  if (!hashedPassword)
    throw new CustomError.UnauthenticatedError("Invalid credentials");

  const isPasswordCorrect = await User.comparePassword(
    password,
    hashedPassword
  );
  if (!isPasswordCorrect)
    throw new CustomError.UnauthenticatedError("Invalid credentials");

  // 5️⃣ Cache user and mappings
  await setCache(`user:${userId}`, user);
  await setCache(`username:${user.username}`, user._id.toString());
  await setCache(`email:${user.email}`, user._id.toString());

  // 6️⃣ Token + cookies
  const tokenUser = createTokenUser(user);
  attachCookiesToResponse({ res, user: tokenUser });

  const { password: _, ...safeUser } = user._doc || user;
  res.status(StatusCodes.OK).json({ user: safeUser });
};

// LOGOUT
const logout = (req, res) => {
  const isProduction = process.env.NODE_ENV === "production";
  const options = {
    httpOnly: true,
    secure: isProduction,
    signed: true,
    path: "/",
    sameSite: isProduction ? "none" : "lax",
  };
  res.clearCookie("accessToken", options);
  res.clearCookie("refreshToken", options);
  res.status(StatusCodes.OK).json({ msg: "User logged out!" });
};

// UPDATE PROFILE
const updateProfile = async (req, res) => {
  try {
    const { name, username, email, previousPassword, password, avatar } =
      req.body;
    const userId = req.user.userId;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: "User not found" });

    if ((email && email !== user.email) || password) {
      if (!previousPassword)
        return res.status(400).json({
          msg: "Previous password is required to update email or password",
        });

      const isMatch = await user.comparePassword(previousPassword);
      if (!isMatch)
        return res.status(400).json({ msg: "Previous password is incorrect" });
    }

    if (name) user.name = name;
    if (username) user.username = username;
    if (email) user.email = email;
    if (avatar) user.avatar = avatar;
    if (password) user.password = password;

    await user.save();

    // Refresh cache
    await setCache(`user:${user._id}`, user);
    await setCache(`username:${user.username}`, user._id.toString());
    await setCache(`email:${user.email}`, user._id.toString());

    const { password: _, ...updatedUser } = user.toObject();
    res
      .status(200)
      .json({ msg: "Profile updated successfully", user: updatedUser });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Server error" });
  }
};

// CHECK AUTH
const checkAuth = async (req, res) => {
  try {
    const userId = req.user.userId;

    let user = await getCache(`user:${userId}`);
    if (user) {
      if (user.password) delete user.password;
      return res.status(StatusCodes.OK).json({ user });
    }

    const userDoc = await User.findById(userId);
    if (!userDoc) return res.status(404).json({ msg: "User not found" });

    const { password: _, ...safeUser } = userDoc._doc;
    await setCache(`user:${userId}`, safeUser);

    res.status(StatusCodes.OK).json({ user: safeUser });
  } catch (err) {
    console.error("checkAuth error:", err);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ msg: "Server error" });
  }
};

module.exports = { register, login, logout, checkAuth, updateProfile };
