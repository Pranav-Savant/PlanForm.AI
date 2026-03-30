import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  calculateMaterialScore,
  getWeightsByElementType,
  normalizeCost,
} from "../utils/scoring.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const materialsPath = path.join(__dirname, "../../data/materials.json");
const materials = JSON.parse(fs.readFileSync(materialsPath, "utf-8"));

export const getMaterialRecommendations = (structuralElements) => {
  const recommendations = [];
  for (const element of structuralElements) {
    const { elementType, span = 0 } = element;

    let effectiveType = elementType;
    if (span > 5) effectiveType = "long_span";

    const candidateMaterials = materials.filter((material) =>
      material.bestUse.includes(effectiveType)
    );

    const weights = getWeightsByElementType(effectiveType);

    const rankedMaterials = candidateMaterials
      .map((material) => {
        const affordability = normalizeCost(material.cost);
        const score = calculateMaterialScore(material, weights);

        return {
          ...material,
          affordability,
          score: +score.toFixed(2),
          tradeoffSummary: {
            cost: material.cost,
            affordability,
            strength: material.strength,
            durability: material.durability,
            thermalEfficiency: material.thermalEfficiency,
          },
        };
      })
      .sort((a, b) => b.score - a.score);

    const best = rankedMaterials[0];
    const second = rankedMaterials[1];

    let tradeoffInsight = "Balanced recommendation based on available criteria.";

    if (best && second) {
      if (best.cost > second.cost && best.strength > second.strength) {
        tradeoffInsight =
          `${best.name} is more expensive than ${second.name}, but offers higher structural strength.`;
      } else if (best.cost < second.cost && best.strength < second.strength) {
        tradeoffInsight =
          `${best.name} is more affordable than ${second.name}, but slightly compromises on strength.`;
      } else if (best.durability > second.durability) {
        tradeoffInsight =
          `${best.name} was prioritized for better long-term durability.`;
      }
    }

    recommendations.push({
      element: elementType,
      span,
      topChoice: best?.name || "No suitable material found",
      alternatives: rankedMaterials.slice(1, 3).map((m) => m.name),
      rankedOptions: rankedMaterials,
      tradeoffInsight,
    });
  }

  return recommendations;
};