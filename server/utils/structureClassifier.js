export const classifyStructuralElements = (parsedLayout) => {
  const wallSegments = parsedLayout.wallSegments || [];

  const structuralElements = [];

  wallSegments.forEach((wall) => {
    const dx = wall.x2 - wall.x1;
    const dy = wall.y2 - wall.y1;
    const pixelLength = Math.sqrt(dx * dx + dy * dy);

    const span = +(pixelLength * 0.02).toFixed(2);

    let elementType = "partition_wall";

    if (span >= 4) {
      elementType = "load_bearing_wall";
    }

    structuralElements.push({
      elementType,
      span,
      source: wall,
    });
  });

  structuralElements.push({
    elementType: "slab",
    span: 5.5,
    source: null,
  });

  if (wallSegments.length > 12) {
    structuralElements.push({
      elementType: "column",
      span: 0,
      source: null,
    });
  }

  return structuralElements;
};