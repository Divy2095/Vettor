import multer from "multer";

import { ApiError } from "../utils/apiError.js";

const MAX_PDF_SIZE_BYTES = 5 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_PDF_SIZE_BYTES,
  },
  fileFilter: (_req, file, callback) => {
    const isPdfMime = file.mimetype === "application/pdf";
    const hasPdfExtension = file.originalname.toLowerCase().endsWith(".pdf");

    if (!isPdfMime && !hasPdfExtension) {
      callback(new ApiError(400, "Only PDF files are allowed"));
      return;
    }

    callback(null, true);
  },
});

export const uploadResumeSingle = upload.single("resume");

export const handleUploadResume = (req, res, next) => {
  uploadResumeSingle(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error.code === "LIMIT_FILE_SIZE") {
      next(new ApiError(400, "PDF file size must be 5MB or smaller"));
      return;
    }

    next(error);
  });
};
