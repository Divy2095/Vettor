import { Router } from "express";

import {
  approveSubmission,
  createQuestionDirectly,
  getModerationNotifications,
  getModerationStats,
  listPendingSubmissions,
  listReviewedSubmissions,
  rejectSubmission,
} from "../controllers/adminController.js";
import { ROLES } from "../constants/roles.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { validate } from "../middleware/validate.js";
import { createQuestionSchema, moderateSubmissionSchema } from "../validators/questionSchemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const adminRouter = Router();

adminRouter.use(authenticate, authorize(ROLES.ADMIN));

adminRouter.get("/moderation/stats", asyncHandler(getModerationStats));
adminRouter.get("/moderation/notifications", asyncHandler(getModerationNotifications));
adminRouter.get("/moderation/pending", asyncHandler(listPendingSubmissions));
adminRouter.get("/moderation/reviewed", asyncHandler(listReviewedSubmissions));
adminRouter.post(
  "/moderation/submissions/:id/approve",
  validate(moderateSubmissionSchema),
  asyncHandler(approveSubmission),
);
adminRouter.post(
  "/moderation/submissions/:id/reject",
  validate(moderateSubmissionSchema),
  asyncHandler(rejectSubmission),
);
adminRouter.post("/questions", validate(createQuestionSchema), asyncHandler(createQuestionDirectly));

export default adminRouter;
