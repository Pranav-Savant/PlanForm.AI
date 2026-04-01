const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

export const getMetricBounds = (materials, key) => {
  const values = materials
    .map((material) => Number(material[key]))
    .filter((value) => Number.isFinite(value));

  if (!values.length) {
    return { min: 0, max: 1 };
  }

  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
};

export const normalizeMetric = (
  value,
  min,
  max,
  { higherIsBetter = true } = {},
) => {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  if (max <= min) {
    return 0.5;
  }

  const normalized = clamp((numericValue - min) / (max - min));
  return higherIsBetter ? normalized : 1 - normalized;
};

export const ratingFromNormalized = (normalizedValue) => {
  const clampedValue = clamp(normalizedValue);
  return +(1 + clampedValue * 9).toFixed(1);
};

export const calculateMaterialScore = (metrics, weights) => {
  const weightedSum =
    metrics.affordability * weights.cost +
    metrics.strength * weights.strength +
    metrics.durability * weights.durability +
    metrics.thermalPerformance * weights.thermalEfficiency;

  return weightedSum * 100;
};

export const getWeightsByElementType = (elementType) => {
  switch (elementType) {
    case "load_bearing_wall":
      return {
        cost: 0.2,
        strength: 0.4,
        durability: 0.3,
        thermalEfficiency: 0.1,
      };

    case "partition_wall":
      return {
        cost: 0.3,
        strength: 0.2,
        durability: 0.2,
        thermalEfficiency: 0.3,
      };

    case "slab":
      return {
        cost: 0.15,
        strength: 0.45,
        durability: 0.35,
        thermalEfficiency: 0.05,
      };

    case "column":
      return {
        cost: 0.1,
        strength: 0.5,
        durability: 0.35,
        thermalEfficiency: 0.05,
      };

    case "long_span":
      return {
        cost: 0.15,
        strength: 0.5,
        durability: 0.25,
        thermalEfficiency: 0.1,
      };

    case "beam":
      return {
        cost: 0.15,
        strength: 0.55,
        durability: 0.25,
        thermalEfficiency: 0.05,
      };

    default:
      return {
        cost: 0.25,
        strength: 0.3,
        durability: 0.25,
        thermalEfficiency: 0.2,
      };
  }
};
