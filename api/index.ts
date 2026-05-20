import app from "../artifacts/api-server/src/app";
import { handle } from "@vercel/node";

export default handle(app);
