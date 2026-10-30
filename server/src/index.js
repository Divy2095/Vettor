// import app from "./app.js";
// import { env } from "./config/env.js";
// import { connectDatabase } from "./config/database.js";

// const PORT = process.env.PORT || 5000;

// const bootstrap = async () => {
//   await connectDatabase(env.MONGODB_URI);

//   app.listen(PORT, () => console.log(`Server running on ${PORT}`));
//   // app.listen(env.PORT, () => {
//   //   console.log(`Server running on http://localhost:${env.PORT}`);
//   // });
// };

// bootstrap().catch((error) => {
//   console.error("Server failed to start:", error.message);
//   process.exit(1);
// });





import app from "./app.js";
import dotenv from "dotenv";
import connectDatabase from "./config/database.js";

dotenv.config();

const PORT = process.env.PORT || 5000;

const bootstrap = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is missing in environment variables");
    }

    await connectDatabase(process.env.MONGODB_URI);

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

  } catch (error) {
    console.error("❌ Server failed to start:", error.message);
    process.exit(1);
  }
};

bootstrap();