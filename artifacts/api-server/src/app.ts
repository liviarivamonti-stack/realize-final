import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
// @ts-ignore
import router from "./routes.js";
// @ts-ignore
import { logger } from "./lib/logger.js";

const app = express();

// Fix for "This expression is not callable" and implicit any types
const pinoMiddleware: any = (pinoHttp as any).default || pinoHttp;

app.use(
  pinoMiddleware({
    logger,
    serializers: {
      req: (req: any) => {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res: (res: any) => {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  })
);

app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
