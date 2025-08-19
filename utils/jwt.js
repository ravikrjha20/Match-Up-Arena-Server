require("dotenv").config();
const jwt = require("jsonwebtoken");

const createJWT = ({ payload, expiresIn }) => {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
};

const attachCookiesToResponse = ({ res, user, refreshToken }) => {
  // Short-lived access token (e.g., 15 minutes)
  const accessTokenJWT = createJWT({
    payload: { user },
    expiresIn: process.env.JWT_LIFETIME || "15m",
  });

  // Long-lived refresh token (e.g., 30 days)
  const refreshTokenJWT = createJWT({
    payload: { user, refreshToken },
    expiresIn: process.env.REFRESH_TOKEN_LIFETIME || "30d",
  });

  const oneDay = 1000 * 60 * 60 * 24;
  const longerExp = 1000 * 60 * 60 * 24 * 30;

  res.cookie("accessToken", accessTokenJWT, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    signed: true,
    expires: new Date(Date.now() + oneDay),
  });

  res.cookie("refreshToken", refreshTokenJWT, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    signed: true,
    expires: new Date(Date.now() + longerExp),
  });
};

const isTokenValid = ({ token }) => jwt.verify(token, process.env.JWT_SECRET);

module.exports = { createJWT, isTokenValid, attachCookiesToResponse };
