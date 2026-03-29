import express from "express";
import { analyzeFloorPlan } from "../controllers/pipelineController.js";
import { upload } from "../config/multer.js";

const router = express.Router();

router.post("/analyze", upload.single("floorPlan"), analyzeFloorPlan);

export default router;