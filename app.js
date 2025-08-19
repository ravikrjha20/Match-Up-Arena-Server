require(`dotenv`).config();
require(`express-async-errors`);
const cors = require(`cors`);
const express = require(`express`);
// const app = express();
const connectDB = require(`./db/connect`);
const { app, server } = require(`./db/socket`);

const fileUpload = require(`express-fileupload`);

// const cloudinary = require(`cloudinary`).v2;
// cloudinary.config({
//   cloud_name: process.env.CLOUD_NAME,
//   api_key: process.env.CLOUD_API_KEY,
//   api_secret: process.env.CLOUD_API_SECRET,
// });
const allowedOrigins = process.env.CLIENT_URLS.split(",");

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

const errorHandlerMiddleware = require(`./middleware/error-handler`);
const notFoundMiddleware = require(`./middleware/not-found`);
const cookieParser = require(`cookie-parser`);
const morgan = require(`morgan`);

const authRoutes = require(`./routes/authRoutes`);
const friendRoute = require("./routes/friendsRoute");
const play1v1Route = require("./routes/Play1v1Route");
app.use(express.json());
// app.use(fileUpload({ useTempFiles: true }));
app.use(cookieParser(process.env.JWT_SECRET));
app.use(morgan(`tiny`));

app.use(`/api/v1/auth`, authRoutes);
app.use(`/api/v1/friend`, friendRoute);
app.use(`/api/v1/play`, play1v1Route);

const port = process.env.PORT || 3000;
app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

const start = async () => {
  try {
    await connectDB(process.env.MONGO_URI);
    console.log("🚀 Connection established ✅");
    server.listen(
      port,
      "0.0.0.0",
      console.log(`🚀 Server listening on port ${port} ✅`)
    );
  } catch (error) {
    console.log(error);
  }
};

start();
