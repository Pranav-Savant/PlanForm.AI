import {
  generateChatResponse,
  generateMaterialExplanation,
} from "../services/aiService.js";
import { getMaterialRecommendations } from "../services/materialService.js";
import { parseFloorPlanWithCV } from "../services/cvService.js";
import { classifyStructuralElements } from "../utils/structureClassifier.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MATERIALS_FILE_PATH = path.resolve(
  __dirname,
  "../../data/materials.json",
);

let cachedMaterialsCatalog = null;

const loadMaterialsCatalog = async () => {
  if (cachedMaterialsCatalog) return cachedMaterialsCatalog;

  try {
    const raw = await fs.readFile(MATERIALS_FILE_PATH, "utf-8");
    cachedMaterialsCatalog = JSON.parse(raw);
    return cachedMaterialsCatalog;
  } catch (error) {
    console.error("Materials Catalog Load Error:", error.message);
    return [];
  }
};

export const analyzeFloorPlan = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No floor plan image uploaded",
      });
    }

    const parsedLayout = await parseFloorPlanWithCV(req.file.path);

    const structuralElements = classifyStructuralElements(parsedLayout);

    const recommendations = getMaterialRecommendations(structuralElements);

    const aiExplanation = await generateMaterialExplanation({
      buildingSummary: {
        totalRooms: parsedLayout.rooms,
        totalWalls: parsedLayout.walls,
        floorHeight: "3m",
      },
      recommendations,
    });

    return res.status(200).json({
      success: true,
      parsedLayout,
      structuralElements,
      recommendations,
      aiExplanation,
    });
  } catch (error) {
    console.error("Pipeline Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Error analyzing floor plan",
    });
  }
};

export const chatWithAssistant = async (req, res) => {
  try {
    const {
      message,
      aiExplanation,
      recommendations,
      parsedLayout,
      structuralElements,
      chatHistory,
    } = req.body;

    if (!message || !String(message).trim()) {
      return res.status(400).json({
        success: false,
        message: "Chat message is required",
      });
    }

    if (!aiExplanation || !String(aiExplanation).trim()) {
      return res.status(400).json({
        success: false,
        message: "AI explanation is required to start the chat",
      });
    }

    const materialsCatalog = await loadMaterialsCatalog();

    const projectData = {
      buildingSummary: {
        totalRooms: parsedLayout?.rooms,
        totalWalls: parsedLayout?.walls,
        floorHeight: "3m",
        wallSegmentCount:
          parsedLayout?.wallSegmentCount ?? parsedLayout?.wallSegments?.length,
        roomPolygonCount:
          parsedLayout?.roomPolygonCount ?? parsedLayout?.roomPolygons?.length,
        doorCount: parsedLayout?.doorCount ?? parsedLayout?.doorsData?.length,
        windowCount:
          parsedLayout?.windowCount ?? parsedLayout?.windowsData?.length,
        openingCount:
          parsedLayout?.openingCount ?? parsedLayout?.openingsData?.length,
        totalArea: parsedLayout?.totalArea,
      },
      parsedLayout,
      structuralElements,
      recommendations,
      materialsCatalog,
    };

    const reply = await generateChatResponse({
      question: String(message),
      aiExplanation: String(aiExplanation),
      contextData: projectData,
      chatHistory,
    });

    return res.status(200).json({
      success: true,
      reply,
    });
  } catch (error) {
    console.error("Chat Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Error generating chat response",
    });
  }
};
