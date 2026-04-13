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

router.use(healthRouter);
router.use(aiPredictionsRouter);
router.use(authorPredictionsRouter);
router.use(statisticsRouter);
router.use(historyRouter);
router.use(matchesRouter);
router.use(dashboardRouter);
router.use(buttonsRouter);
router.use("/admins", adminsRouter);
router.use(generatePredictionRouter);
router.use(liveOddsRouter);
router.use(statsAdminRouter);
router.use(adsRouter);
router.use(storageRouter);
router.use(usersRouter);

export default router;
