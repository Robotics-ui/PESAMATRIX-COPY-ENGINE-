import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import publicRouter from "./public.js";
import adminRouter from "./admin.js";
import masterRouter from "./master.js";
import mt5Router from "./mt5.js";
import copyFactoryRouter from "./copyfactory.js";
import paymentsRouter from "./payments.js";
import subscriptionsRouter from "./subscriptions.js";
import adminSubscriptionsRouter from "./admin-subscriptions.js";
import tradingRouter from "./trading.js";
import queueRouter from "./queue.js";
import mediaRouter from "./media.js";
import resourcesRouter from "./resources.js";
import newsRouter from "./news.js";
import { authenticate } from "../middlewares/authenticate.js";
import { requireRole } from "../middlewares/requireRole.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use("/public", publicRouter);
router.use("/admin", authenticate, requireRole("admin"), adminRouter);
router.use("/admin", authenticate, requireRole("admin"), masterRouter);
router.use("/admin", authenticate, requireRole("admin"), copyFactoryRouter);
router.use("/admin", authenticate, requireRole("admin"), adminSubscriptionsRouter);
router.use("/admin", authenticate, requireRole("admin"), queueRouter);
router.use("/mt5", authenticate, mt5Router);
router.use("/payments", paymentsRouter);
router.use("/subscriptions", subscriptionsRouter);
router.use("/trading", authenticate, tradingRouter);
router.use("/media", mediaRouter);
router.use("/resources", resourcesRouter);
router.use("/news", newsRouter);

export default router;
