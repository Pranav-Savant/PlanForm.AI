import express from "express";
import {
  analyzeFloorPlan,
  chatWithAssistant,
} from "../controllers/pipelineController.js";
import { upload } from "../config/multer.js";

const router = express.Router();

router.post("/analyze", upload.single("floorPlan"), analyzeFloorPlan);
router.post("/chat", chatWithAssistant);

export default router;
