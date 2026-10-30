import { Router } from "express";

import {
    accessSession,
    createSubmission,
    deleteSession,
    generateQuestions,
    createSession,
    listQuestionHistory,
    listMySubmissions,
    practiceAnswerFeedback,
    renameSession,
    uploadResumeAndExtractSkills,
} from "../controllers/questionController.js";
import { authenticate } from "../middleware/authenticate.js";
import { handleUploadResume } from "../middleware/uploadResume.js";
import { validate } from "../middleware/validate.js";
import {
    createSubmissionSchema,
    generateQuestionsSchema,
    practiceAnswerSchema,
} from "../validators/questionSchemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const questionRouter = Router();

questionRouter.post(
    "/submissions",
    authenticate,
    validate(createSubmissionSchema),
    asyncHandler(createSubmission),
);
questionRouter.get(
    "/submissions/me",
    authenticate,
    asyncHandler(listMySubmissions),
);
questionRouter.post(
    "/generate",
    authenticate,
    validate(generateQuestionsSchema),
    asyncHandler(generateQuestions),
);
questionRouter.post("/create", authenticate, asyncHandler(createSession));
questionRouter.get("/history", authenticate, asyncHandler(listQuestionHistory));
questionRouter.post(
    "/practice",
    authenticate,
    validate(practiceAnswerSchema),
    asyncHandler(practiceAnswerFeedback),
);
questionRouter.post(
    "/resume/skills",
    authenticate,
    handleUploadResume,
    asyncHandler(uploadResumeAndExtractSkills),
);
questionRouter.post(
    "/:sessionId/access",
    authenticate,
    asyncHandler(accessSession),
);
questionRouter.patch(
    "/:sessionId/rename",
    authenticate,
    asyncHandler(renameSession),
);
questionRouter.delete("/:sessionId", authenticate, asyncHandler(deleteSession));

export default questionRouter;
