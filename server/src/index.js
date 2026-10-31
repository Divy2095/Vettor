import app from "./app.js";
import dotenv from "dotenv";
import connectDatabase from "./config/database.js";
import { env } from "./config/env.js";

dotenv.config();

const PORT = env.PORT || process.env.PORT || 5000;

const bootstrap = async () => {
  try {
    if (process.env.MONGODB_URI) {
      try {
        await connectDatabase(process.env.MONGODB_URI);
        console.log("🍃 MongoDB connected (legacy transition mode)");
      } catch (dbErr) {
        console.warn("⚠️ MongoDB connection failed, continuing in Supabase mode:", dbErr.message);
      }
    } else {
      console.log("⚡ Running in Supabase standalone mode (no MongoDB URI configured)");
    }

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Server failed to start:", error.message);
    process.exit(1);
  }
};

bootstrap();
