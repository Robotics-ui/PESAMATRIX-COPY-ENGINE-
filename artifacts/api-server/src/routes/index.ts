import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import adminRouter from "./admin.js";
import masterRouter from "./master.js";
import mt5Router from "./mt5.js";
import copyFactoryRouter from "./copyfactory.js";
import { authenticate } from "../middlewares/authenticate.js";
import { requireRole } from "../middlewares/requireRole.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use("/admin", authenticate, requireRole("admin"), adminRouter);
router.use("/admin", authenticate, requireRole("admin"), masterRouter);
router.use("/admin", authenticate, requireRole("admin"), copyFactoryRouter);
router.use("/mt5", authenticate, mt5Router);

export default router;
