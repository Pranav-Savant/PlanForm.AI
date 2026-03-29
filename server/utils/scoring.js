export const normalizeCost = (cost) => {
  return 11 - cost;
};

export const calculateMaterialScore = (material, weights) => {
  const affordability = normalizeCost(material.cost);

  return (
    affordability * weights.cost +
    material.strength * weights.strength +
    material.durability * weights.durability +
    material.thermalEfficiency * weights.thermalEfficiency
  );
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
        cost: 0.1,
        strength: 0.5,
        durability: 0.3,
        thermalEfficiency: 0.1,
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