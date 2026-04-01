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

const buildRecommendationSummary = (recommendations = []) => {
  if (!Array.isArray(recommendations)) return [];

  return recommendations.map((entry) => ({
    element: entry.element,
    span: entry.span,
    topChoice: entry.topChoice,
    tradeoffInsight: entry.tradeoffInsight,
    topOptions: (entry.rankedOptions || []).map((material) => ({
      name: material.name,
      score: material.score,
      cost: material.costLabel || material.cost,
      costPerSqMInr: material.cost,
      strength: material.strength,
      durability: material.durability,
      thermalEfficiency: material.thermalEfficiency,
      rawMetrics: material.rawMetrics,
    })),
  }));
};

const extractRelevantMaterialsCatalog = (materialsCatalog = []) => {
  if (!Array.isArray(materialsCatalog)) {
    return [];
  }

  return materialsCatalog.map((material) => ({
    name: material.name,
    costPerSqMInr: material.costPerSqMInr,
    strengthMPa: material.strengthMPa,
    serviceLifeYears: material.serviceLifeYears,
    thermalConductivityWmK: material.thermalConductivityWmK,
    bestUse: material.bestUse,
  }));
};

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

const PIPELINE_STEPS = [
  { key: "preparing_image", label: "Preparing image" },
  { key: "parsing_2d_layout", label: "Parsing 2D layout" },
  {
    key: "detecting_structural_geometry",
    label: "Detecting structural geometry",
  },
  { key: "estimating_materials", label: "Estimating materials" },
  { key: "evaluating_tradeoffs", label: "Evaluating trade-offs" },
  { key: "generating_final_report", label: "Generating final report" },
];

const createProgressEmitter = (res) => {
  const sendEvent = (payload) => {
    res.write(`${JSON.stringify(payload)}\n`);
  };

  const findStep = (stepKey) =>
    PIPELINE_STEPS.findIndex((step) => step.key === stepKey);

  return {
    start: (message = "Pipeline started") => {
      sendEvent({
        type: "pipeline_start",
        message,
        totalSteps: PIPELINE_STEPS.length,
      });
    },
    stepStarted: (stepKey, message) => {
      const stepIndex = findStep(stepKey);
      sendEvent({
        type: "step_started",
        stepKey,
        stepIndex,
        totalSteps: PIPELINE_STEPS.length,
        message,
      });
    },
    stepCompleted: (stepKey, message) => {
      const stepIndex = findStep(stepKey);
      sendEvent({
        type: "step_completed",
        stepKey,
        stepIndex,
        totalSteps: PIPELINE_STEPS.length,
        message,
      });
    },
    done: (result) => {
      sendEvent({
        type: "completed",
        totalSteps: PIPELINE_STEPS.length,
        result,
      });
    },
    fail: (message) => {
      sendEvent({
        type: "error",
        message,
      });
    },
  };
};

export const analyzeFloorPlanStream = async (req, res) => {
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");

  const progress = createProgressEmitter(res);

  try {
    if (!req.file) {
      progress.fail("No floor plan image uploaded");
      res.end();
      return;
    }

    progress.start("Upload received. Starting analysis...");

    progress.stepStarted("preparing_image", "Validating uploaded image");
    progress.stepCompleted("preparing_image", "Image ready for CV processing");

    progress.stepStarted("parsing_2d_layout", "Parsing 2D layout geometry");
    const parsedLayout = await parseFloorPlanWithCV(req.file.path);
    progress.stepCompleted("parsing_2d_layout", "Layout parsing completed");

    progress.stepStarted(
      "detecting_structural_geometry",
      "Detecting walls and structural geometry",
    );
    const structuralElements = classifyStructuralElements(parsedLayout);
    progress.stepCompleted(
      "detecting_structural_geometry",
      "Structural element detection completed",
    );

    progress.stepStarted(
      "estimating_materials",
      "Estimating material recommendations",
    );
    const recommendations = getMaterialRecommendations(structuralElements);
    progress.stepCompleted(
      "estimating_materials",
      "Material recommendation pass completed",
    );

    progress.stepStarted(
      "evaluating_tradeoffs",
      "Evaluating cost and durability trade-offs",
    );
    const aiExplanation = await generateMaterialExplanation({
      buildingSummary: {
        totalWalls: parsedLayout.walls,
        floorHeight: "3m",
      },
      recommendations,
    });
    progress.stepCompleted(
      "evaluating_tradeoffs",
      "Trade-off analysis completed",
    );

    progress.stepStarted(
      "generating_final_report",
      "Compiling final analysis payload",
    );

    const result = {
      success: true,
      parsedLayout,
      structuralElements,
      recommendations,
      aiExplanation,
    };

    progress.stepCompleted("generating_final_report", "Final report ready");
    progress.done(result);
    res.end();
  } catch (error) {
    console.error("Pipeline Stream Error:", error.message);
    progress.fail("Error analyzing floor plan");
    res.end();
  }
};

export const chatWithAssistant = async (req, res) => {
  try {
    const {
      message,
      aiExplanation,
      recommendations,
      recommendationSummary,
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

    const normalizedRecommendationSummary =
      Array.isArray(recommendations) && recommendations.length
        ? buildRecommendationSummary(recommendations)
        : Array.isArray(recommendationSummary)
          ? recommendationSummary
          : [];

    const normalizedStructuralElements =
      Array.isArray(structuralElements) && structuralElements.length
        ? structuralElements
        : normalizedRecommendationSummary.map((entry) => ({
            elementType: entry.element,
            span: entry.span,
          }));

    const relevantMaterialsCatalog =
      extractRelevantMaterialsCatalog(materialsCatalog);

    const projectData = {
      buildingSummary: {
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
      structuralElements: normalizedStructuralElements,
      recommendations,
      recommendationSummary: normalizedRecommendationSummary,
      materialsCatalog: relevantMaterialsCatalog,
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
