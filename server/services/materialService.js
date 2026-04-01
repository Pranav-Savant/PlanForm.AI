import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  calculateMaterialScore,
  getWeightsByElementType,
  getMetricBounds,
  normalizeMetric,
  ratingFromNormalized,
} from "../utils/scoring.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const materialsPath = path.join(__dirname, "../../data/materials.json");
const materials = JSON.parse(fs.readFileSync(materialsPath, "utf-8"));

const inrFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 0,
});

const resolveEffectiveType = (elementType, span) => {
  if (elementType === "beam") {
    return "beam";
  }

  if (span > 5 && elementType !== "slab" && elementType !== "column") {
    return "long_span";
  }

  return elementType;
};

const filterByTypeSuitability = (candidateMaterials, effectiveType) => {
  if (effectiveType === "long_span") {
    return candidateMaterials.filter(
      (material) => !material.bestUse.includes("column"),
    );
  }

  if (effectiveType === "beam") {
    return candidateMaterials.filter(
      (material) =>
        material.bestUse.includes("beam") ||
        (material.bestUse.includes("long_span") &&
          !material.bestUse.includes("column")),
    );
  }

  return candidateMaterials;
};

const buildTradeoffInsight = (best, second) => {
  if (!best || !second) {
    return "Balanced recommendation based on realistic material performance and cost.";
  }

  if (
    best.cost > second.cost &&
    best.rawMetrics.strengthMPa > second.rawMetrics.strengthMPa
  ) {
    return `${best.name} costs more than ${second.name}, but offers higher structural capacity.`;
  }

  if (
    best.cost < second.cost &&
    best.rawMetrics.strengthMPa < second.rawMetrics.strengthMPa
  ) {
    return `${best.name} is more economical than ${second.name}, with a moderate strength compromise.`;
  }

  if (best.rawMetrics.serviceLifeYears > second.rawMetrics.serviceLifeYears) {
    return `${best.name} was prioritized for better long-term service life.`;
  }

  if (
    best.rawMetrics.thermalConductivityWmK <
    second.rawMetrics.thermalConductivityWmK
  ) {
    return `${best.name} was favored for stronger thermal insulation performance.`;
  }

  return "Balanced recommendation based on realistic material performance and cost.";
};

export const getMaterialRecommendations = (structuralElements) => {
  const recommendations = [];
  for (const element of structuralElements) {
    const { elementType, span = 0 } = element;

    const effectiveType = resolveEffectiveType(elementType, span);

    let candidateMaterials = materials.filter((material) =>
      material.bestUse.includes(effectiveType),
    );

    candidateMaterials = filterByTypeSuitability(
      candidateMaterials,
      effectiveType,
    );

    if (!candidateMaterials.length && effectiveType === "beam") {
      candidateMaterials = materials.filter((material) =>
        material.bestUse.includes("long_span"),
      );
      candidateMaterials = filterByTypeSuitability(
        candidateMaterials,
        effectiveType,
      );
    }

    if (!candidateMaterials.length && effectiveType === "long_span") {
      candidateMaterials = materials.filter((material) =>
        material.bestUse.includes("beam"),
      );
      candidateMaterials = filterByTypeSuitability(
        candidateMaterials,
        effectiveType,
      );
    }

    if (!candidateMaterials.length) {
      recommendations.push({
        element: elementType,
        span,
        topChoice: "No suitable material found",
        alternatives: [],
        rankedOptions: [],
        tradeoffInsight: "No candidate materials found for this element type.",
      });
      continue;
    }

    const costBounds = getMetricBounds(candidateMaterials, "costPerSqMInr");
    const strengthBounds = getMetricBounds(candidateMaterials, "strengthMPa");
    const durabilityBounds = getMetricBounds(
      candidateMaterials,
      "serviceLifeYears",
    );
    const thermalBounds = getMetricBounds(
      candidateMaterials,
      "thermalConductivityWmK",
    );

    const weights = getWeightsByElementType(effectiveType);

    const rankedMaterials = candidateMaterials
      .map((material) => {
        const affordabilityNorm = normalizeMetric(
          material.costPerSqMInr,
          costBounds.min,
          costBounds.max,
          { higherIsBetter: false },
        );
        const strengthNorm = normalizeMetric(
          material.strengthMPa,
          strengthBounds.min,
          strengthBounds.max,
        );
        const durabilityNorm = normalizeMetric(
          material.serviceLifeYears,
          durabilityBounds.min,
          durabilityBounds.max,
        );
        const thermalNorm = normalizeMetric(
          material.thermalConductivityWmK,
          thermalBounds.min,
          thermalBounds.max,
          { higherIsBetter: false },
        );

        const score = calculateMaterialScore(
          {
            affordability: affordabilityNorm,
            strength: strengthNorm,
            durability: durabilityNorm,
            thermalPerformance: thermalNorm,
          },
          weights,
        );

        const strengthRating = ratingFromNormalized(strengthNorm);
        const durabilityRating = ratingFromNormalized(durabilityNorm);
        const thermalRating = ratingFromNormalized(thermalNorm);
        const affordabilityRating = ratingFromNormalized(affordabilityNorm);

        return {
          ...material,
          cost: material.costPerSqMInr,
          costLabel: `INR ${inrFormatter.format(material.costPerSqMInr)}/m2`,
          strength: strengthRating,
          durability: durabilityRating,
          thermalEfficiency: thermalRating,
          affordability: affordabilityRating,
          score: +score.toFixed(2),
          rawMetrics: {
            costPerSqMInr: material.costPerSqMInr,
            strengthMPa: material.strengthMPa,
            serviceLifeYears: material.serviceLifeYears,
            thermalConductivityWmK: material.thermalConductivityWmK,
          },
          tradeoffSummary: {
            costPerSqMInr: material.costPerSqMInr,
            affordability: affordabilityRating,
            strengthMPa: material.strengthMPa,
            serviceLifeYears: material.serviceLifeYears,
            thermalConductivityWmK: material.thermalConductivityWmK,
          },
        };
      })
      .sort((a, b) => b.score - a.score);

    const best = rankedMaterials[0];
    const second = rankedMaterials[1];
    const tradeoffInsight = buildTradeoffInsight(best, second);

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
