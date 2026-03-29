import { generateMaterialExplanation } from "../services/aiService.js";
import { getMaterialRecommendations } from "../services/materialService.js";
import { parseFloorPlanWithCV } from "../services/cvService.js";
import { classifyStructuralElements } from "../utils/structureClassifier.js";

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