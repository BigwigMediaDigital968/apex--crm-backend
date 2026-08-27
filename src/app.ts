import express from "express";
import http from "http"
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import { env } from "./config/env.js";
import apiRoutes from "./routes/index.js";
import { errorHandler } from "./middleware/error.middleware.js";
import { initSocket } from "./socket/index.js";


const app = express();

const server = http.createServer(app);

// Initialize Socket.io with the HTTP server
initSocket(server);

app.disable("x-powered-by");

app.use(
  helmet()
);

const allowedOrigins = [
  "http://localhost:5173",
  "https://apex-crm-xi.vercel.app",
  "https://www.dealqix.com"
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests without an origin (Postman, server-to-server, etc.)
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(
  express.json({
    limit: "1mb"
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb"
  })
);

app.use(cookieParser());

app.use(
  morgan(env.nodeEnv === "production" ? "combined" : "dev")
);

const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later."
  }
});

app.use(globalRateLimiter);

app.use("/api/v1", apiRoutes);
app.use(errorHandler);


export default app;