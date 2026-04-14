import { Router, type IRouter } from "express";
import healthRouter from "./health";
import aiPredictionsRouter from "./ai-predictions";
import authorPredictionsRouter from "./author-predictions";
import statisticsRouter from "./statistics";
import historyRouter from "./history";
import matchesRouter from "./matches";
import dashboardRouter from "./dashboard";
import buttonsRouter from "./buttons";
import adminsRouter from "./admins";
import generatePredictionRouter from "./generate-prediction";
import liveOddsRouter from "./live-odds";
import statsAdminRouter from "./stats-admin";
import adsRouter from "./ads";
import storageRouter from "./storage";
import usersRouter from "./users";

const router: IRouter = Router();

router.use("/health", healthRouter);
router.use("/ai-predictions", aiPredictionsRouter);
router.use("/author-predictions", authorPredictionsRouter);
router.use("/statistics", statisticsRouter);
router.use("/history", historyRouter);
router.use("/matches", matchesRouter);
router.use("/dashboard", dashboardRouter);
router.use("/buttons", buttonsRouter);
router.use("/admins", adminsRouter);
router.use("/generate-prediction", generatePredictionRouter);
router.use("/live-odds", liveOddsRouter);
router.use("/stats-admin", statsAdminRouter);
router.use("/ads", adsRouter);
router.use("/storage", storageRouter);
router.use("/users", usersRouter);

export default router;
