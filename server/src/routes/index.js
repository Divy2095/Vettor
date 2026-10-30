import { Router } from "express";

import authRoutes from "./authRoutes.js";
import adminRoutes from "./adminRoutes.js";
import questionRoutes from "./questionRoutes.js";
import mlRoutes from "./mlRoutes.js";
import resumeRoutes from "./resumeRoutes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/admin", adminRoutes);
router.use("/questions", questionRoutes);
router.use("/ml", mlRoutes);
router.use("/resume", resumeRoutes);

export default router;
