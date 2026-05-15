import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import clientsRouter from "./clients";
import installmentsRouter from "./installments";
import eventsRouter from "./events";
import tasksRouter from "./tasks";
import notesRouter from "./notes";
import dashboardRouter from "./dashboard";
import rankingRouter from "./ranking";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(clientsRouter);
router.use(installmentsRouter);
router.use(eventsRouter);
router.use(tasksRouter);
router.use(notesRouter);
router.use(dashboardRouter);
router.use(rankingRouter);

export default router;
