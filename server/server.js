import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pipelineRoutes from "./routes/pipelineRoutes.js";
import path from "path";

dotenv.config();

const app = express();

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

app.use("/api/pipeline", pipelineRoutes);

app.use((err, req, res, next) => {
  if (err?.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      message: "Request payload is too large. Please reduce chat context size.",
    });
  }

  return next(err);
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
