import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pipelineRoutes from "./routes/pipelineRoutes.js";
import path from "path";

dotenv.config();

const app = express();

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use(cors());
app.use(express.json());

app.use("/api/pipeline", pipelineRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});