import { useMemo, useState } from "react";

const CHART_CONFIG = {
  height: 340,
  padLeft: 62,
  padRight: 28,
  padTop: 24,
  padBottom: 72,
  groupWidth: 56,
  barWidth: 20,
  groupGap: 14,
  minPlotWidth: 620,
};

const getStrengthPercentage = (strengthValue) => {
  const normalizedStrength = Number(strengthValue);

  if (!Number.isFinite(normalizedStrength)) {
    return 0;
  }

  return Math.max(0, Math.min(100, (normalizedStrength / 10) * 100));
};

const normalizeBetween = (value, min, max, fallback = 0.5) => {
  if (!Number.isFinite(value)) return fallback;
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return fallback;
  }
  return (value - min) / (max - min);
};

const getStrengthVisuals = (strengthValue) => {
  const normalizedStrength = Number(strengthValue);

  if (!Number.isFinite(normalizedStrength)) {
    return {
      level: "Unknown",
      barColor: "#6b7280",
      badgeBg: "rgba(107,114,128,0.2)",
      badgeText: "#d1d5db",
    };
  }

  if (normalizedStrength <= 4) {
    return {
      level: "Low",
      barColor: "#ef4444",
      badgeBg: "rgba(239,68,68,0.2)",
      badgeText: "#fca5a5",
    };
  }

  if (normalizedStrength <= 7) {
    return {
      level: "Medium",
      barColor: "#f59e0b",
      badgeBg: "rgba(245,158,11,0.2)",
      badgeText: "#fcd34d",
    };
  }

  return {
    level: "High",
    barColor: "#22c55e",
    badgeBg: "rgba(34,197,94,0.2)",
    badgeText: "#86efac",
  };
};

function MaterialCard({ mat, idx, isHighlighted, onHover, onLeave }) {
  const strengthPercentage = getStrengthPercentage(mat.strength);
  const strengthVisuals = getStrengthVisuals(mat.strength);

  return (
    <div
      style={{
        background: "#0E1117",
        border: `1px solid ${isHighlighted ? "#38bdf8" : "#1E2330"}`,
        borderRadius: "10px",
        padding: "14px",
        transition: "border-color 0.2s, box-shadow 0.2s",
        boxShadow: isHighlighted
          ? "0 0 0 1px rgba(56,189,248,0.25), 0 10px 24px rgba(2,132,199,0.2)"
          : "none",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = isHighlighted
          ? "#38bdf8"
          : "#34d399";
        onHover?.(mat);
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = isHighlighted
          ? "#38bdf8"
          : "#1E2330";
        onLeave?.();
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "8px",
        }}
      >
        <div style={{ fontWeight: 600, color: "#fff", fontSize: "14px" }}>
          {idx + 1}. {mat.name}
        </div>
        <span
          style={{
            background: "rgba(52,211,153,0.15)",
            color: "#34d399",
            padding: "2px 10px",
            borderRadius: "999px",
            fontSize: "11px",
            fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          Score {mat.score}
        </span>
      </div>

      <div style={{ fontSize: "12px", color: "#9ca3af", marginBottom: "6px" }}>
        Cost:{" "}
        <span style={{ color: "#fbbf24", fontWeight: 600 }}>
          {mat.costLabel || mat.cost}
        </span>
      </div>

      <div style={{ marginBottom: "6px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "11px",
            color: "#9ca3af",
            marginBottom: "4px",
          }}
        >
          <span>Strength</span>
          <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span>{mat.strength}/10</span>
            <span
              style={{
                background: strengthVisuals.badgeBg,
                color: strengthVisuals.badgeText,
                borderRadius: "999px",
                padding: "1px 8px",
                fontWeight: 700,
                fontSize: "10px",
                letterSpacing: "0.03em",
                textTransform: "uppercase",
              }}
            >
              {strengthVisuals.level}
            </span>
          </span>
        </div>
        <div
          style={{
            width: "100%",
            background: "#374151",
            borderRadius: "999px",
            height: "6px",
          }}
        >
          <div
            style={{
              width: `${strengthPercentage}%`,
              background: strengthVisuals.barColor,
              height: "6px",
              borderRadius: "999px",
              transition: "width 0.4s ease",
            }}
          />
        </div>
      </div>

      <div style={{ fontSize: "11px", color: "#9ca3af" }}>
        Durability:{" "}
        <span style={{ color: "#22d3ee", fontWeight: 600 }}>
          {mat.durability}/10
        </span>
      </div>

      {mat?.rawMetrics?.strengthMPa && (
        <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "6px" }}>
          Structural strength: {mat.rawMetrics.strengthMPa} MPa
        </div>
      )}
    </div>
  );
}

function ElementCard({
  item,
  highlightedMaterialName,
  setHighlightedMaterialName,
}) {
  const options = item.rankedOptions ?? [];

  return (
    <div
      style={{
        background: "#151820",
        border: "1px solid #1E2330",
        borderRadius: "14px",
        padding: "20px",
        transition: "border-color 0.2s",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#6366f1")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#1E2330")}
    >
      {/* Card header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h3
          style={{
            color: "#fff",
            fontWeight: 700,
            fontSize: "15px",
            textTransform: "capitalize",
            margin: 0,
          }}
        >
          {item.element.replaceAll("_", " ")}
        </h3>
        <span
          style={{
            fontSize: "11px",
            color: "#6b7280",
            background: "#1E2330",
            padding: "2px 8px",
            borderRadius: "999px",
          }}
        >
          {options.length} option{options.length !== 1 ? "s" : ""}
        </span>
      </div>

      {!!item.tradeoffInsight && (
        <p
          style={{
            margin: 0,
            fontSize: "12px",
            color: "#9ca3af",
            lineHeight: 1.5,
            background: "rgba(15,23,42,0.55)",
            border: "1px solid #1f2937",
            borderRadius: "8px",
            padding: "10px",
          }}
        >
          {item.tradeoffInsight}
        </p>
      )}

      <div
        style={{
          maxHeight: "430px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          paddingRight: "4px",
        }}
      >
        {options.map((mat, idx) => (
          <MaterialCard
            key={`${item.element}-${mat.name}-${idx}`}
            mat={mat}
            idx={idx}
            isHighlighted={highlightedMaterialName === mat.name}
            onHover={() => setHighlightedMaterialName(mat.name)}
            onLeave={() => setHighlightedMaterialName(null)}
          />
        ))}
      </div>
    </div>
  );
}

function TradeOff({ recommendations }) {
  const finalRecommendations = useMemo(() => {
    if (!Array.isArray(recommendations) || recommendations.length === 0) {
      return [];
    }

    const uniqueWalls = Object.values(
      recommendations
        .filter((item) => item.element !== "column" && item.element !== "slab")
        .reduce((acc, item) => {
          if (!acc[item.element]) acc[item.element] = item;
          return acc;
        }, {}),
    );

    const oneColumn = recommendations.find((item) => item.element === "column");
    const oneSlab = recommendations.find((item) => item.element === "slab");

    return [
      ...uniqueWalls,
      ...(oneColumn ? [oneColumn] : []),
      ...(oneSlab ? [oneSlab] : []),
    ];
  }, [recommendations]);

  const [selectedElement, setSelectedElement] = useState("");
  const [highlightedMaterialName, setHighlightedMaterialName] = useState(null);

  const selectedElementKey =
    selectedElement &&
    finalRecommendations.some((item) => item.element === selectedElement)
      ? selectedElement
      : finalRecommendations[0]?.element;

  const selectedRecommendation =
    finalRecommendations.find((item) => item.element === selectedElementKey) ||
    finalRecommendations[0];

  const graphData = selectedRecommendation?.rankedOptions || [];

  const highlightedMaterial =
    graphData.find((item) => item.name === highlightedMaterialName) ||
    graphData[0];

  const costValues = graphData
    .map((item) => Number(item.cost))
    .filter((value) => Number.isFinite(value));
  const strengthValues = graphData
    .map((item) => Number(item.strength))
    .filter((value) => Number.isFinite(value));

  const minCost = costValues.length ? Math.min(...costValues) : 0;
  const maxCost = costValues.length ? Math.max(...costValues) : 1;
  const maxStrength = strengthValues.length
    ? Math.max(...strengthValues, 10)
    : 10;

  if (!finalRecommendations.length) return null;

  const rawPlotWidth =
    graphData.length * CHART_CONFIG.groupWidth +
    Math.max(graphData.length - 1, 0) * CHART_CONFIG.groupGap;
  const plotWidth = Math.max(CHART_CONFIG.minPlotWidth, rawPlotWidth);
  const chartWidth = CHART_CONFIG.padLeft + plotWidth + CHART_CONFIG.padRight;
  const plotHeight =
    CHART_CONFIG.height - CHART_CONFIG.padTop - CHART_CONFIG.padBottom;
  const chartBaseY = CHART_CONFIG.padTop + plotHeight;

  return (
    <div
      style={{
        background: "#0E1117",
        border: "1px solid #1E2330",
        borderRadius: "16px",
        padding: "28px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "28px" }}>
        <h2
          style={{
            color: "#fff",
            fontSize: "24px",
            fontWeight: 800,
            margin: "0 0 8px",
          }}
        >
          Material Analysis &amp; Cost‑Strength Tradeoff
        </h2>
        <p style={{ color: "#6b7280", margin: 0, fontSize: "14px" }}>
          Ranked recommendations for each structural element
        </p>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          marginBottom: "14px",
        }}
      >
        {finalRecommendations.map((item) => {
          const isActive = item.element === selectedRecommendation?.element;
          return (
            <button
              key={item.element}
              onClick={() => {
                setSelectedElement(item.element);
                setHighlightedMaterialName(
                  item.rankedOptions?.[0]?.name || null,
                );
              }}
              style={{
                border: `1px solid ${isActive ? "#06b6d4" : "#334155"}`,
                background: isActive ? "rgba(6,182,212,0.15)" : "#111827",
                color: isActive ? "#67e8f9" : "#9ca3af",
                borderRadius: "999px",
                padding: "6px 12px",
                fontSize: "12px",
                fontWeight: 700,
                textTransform: "capitalize",
                cursor: "pointer",
              }}
            >
              {item.element.replaceAll("_", " ")}
            </button>
          );
        })}
      </div>

      <div
        style={{
          border: "1px solid #1f2937",
          borderRadius: "14px",
          padding: "14px",
          marginBottom: "22px",
          background:
            "linear-gradient(180deg, rgba(15,23,42,0.7), rgba(2,6,23,0.7))",
        }}
      >
        <h3 style={{ margin: "0 0 6px", color: "#e2e8f0", fontSize: "15px" }}>
          Interactive Cost-Strength Bar Graph
        </h3>
        <p style={{ margin: "0 0 12px", color: "#64748b", fontSize: "12px" }}>
          Hover each bar group to inspect a material and see its matching card
          highlighted. Cost is normalized to a 0-10 index for comparison.
        </p>

        <div
          style={{
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: "10px",
            color: "#94a3b8",
            fontSize: "11px",
          }}
        >
          <span
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <span
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "2px",
                background: "#f59e0b",
              }}
            ></span>
            Cost index (higher means costlier)
          </span>
          <span
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <span
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "2px",
                background: "#22c55e",
              }}
            ></span>
            Strength rating
          </span>
          <span>
            Cost range: INR {Math.round(minCost).toLocaleString("en-IN")} - INR{" "}
            {Math.round(maxCost).toLocaleString("en-IN")}
          </span>
        </div>

        <div style={{ width: "100%", overflowX: "auto" }}>
          <svg
            viewBox={`0 0 ${chartWidth} ${CHART_CONFIG.height}`}
            style={{
              width: "100%",
              minWidth: `${chartWidth}px`,
              height: "auto",
            }}
          >
            {[0, 2, 4, 6, 8, 10].map((tick) => {
              const y =
                CHART_CONFIG.padTop + (1 - tick / 10) * (plotHeight || 1);
              return (
                <g key={`grid-${tick}`}>
                  <line
                    x1={CHART_CONFIG.padLeft}
                    y1={y}
                    x2={chartWidth - CHART_CONFIG.padRight}
                    y2={y}
                    stroke="#1f2937"
                    strokeDasharray="4 6"
                  />
                  <text
                    x={CHART_CONFIG.padLeft - 10}
                    y={y + 4}
                    textAnchor="end"
                    fill="#94a3b8"
                    fontSize="11"
                  >
                    {tick}
                  </text>
                </g>
              );
            })}

            <line
              x1={CHART_CONFIG.padLeft}
              y1={CHART_CONFIG.padTop}
              x2={CHART_CONFIG.padLeft}
              y2={chartBaseY}
              stroke="#475569"
            />
            <line
              x1={CHART_CONFIG.padLeft}
              y1={chartBaseY}
              x2={chartWidth - CHART_CONFIG.padRight}
              y2={chartBaseY}
              stroke="#475569"
            />

            {graphData.map((material, index) => {
              const cost = Number(material.cost);
              const strength = Number(material.strength);
              const normalizedCost =
                normalizeBetween(cost, minCost, maxCost) * 10;
              const normalizedStrength = Math.max(
                0,
                Math.min(10, Number.isFinite(strength) ? strength : 0),
              );
              const costHeight = (normalizedCost / 10) * plotHeight;
              const strengthHeight =
                (Math.min(normalizedStrength, maxStrength) / 10) * plotHeight;
              const groupX =
                CHART_CONFIG.padLeft +
                index * (CHART_CONFIG.groupWidth + CHART_CONFIG.groupGap);
              const isActive = highlightedMaterial?.name === material.name;
              const strengthColor = getStrengthVisuals(
                material.strength,
              ).barColor;
              const groupCenter = groupX + CHART_CONFIG.groupWidth / 2;

              return (
                <g
                  key={`${material.name}-${index}`}
                  onMouseEnter={() => setHighlightedMaterialName(material.name)}
                  onMouseLeave={() => setHighlightedMaterialName(null)}
                  style={{ cursor: "pointer" }}
                >
                  <rect
                    x={groupX + 7}
                    y={chartBaseY - costHeight}
                    width={CHART_CONFIG.barWidth}
                    height={costHeight}
                    rx="3"
                    fill="#f59e0b"
                    opacity={isActive ? 1 : 0.8}
                    stroke={isActive ? "#fef3c7" : "none"}
                    strokeWidth={isActive ? 1.5 : 0}
                  />

                  <rect
                    x={groupX + 7 + CHART_CONFIG.barWidth + 6}
                    y={chartBaseY - strengthHeight}
                    width={CHART_CONFIG.barWidth}
                    height={strengthHeight}
                    rx="3"
                    fill={strengthColor}
                    opacity={isActive ? 1 : 0.9}
                    stroke={isActive ? "#e2e8f0" : "none"}
                    strokeWidth={isActive ? 1.5 : 0}
                  />

                  <text
                    x={groupCenter}
                    y={chartBaseY + 14}
                    textAnchor="middle"
                    fill="#94a3b8"
                    fontSize="10"
                  >
                    {index + 1}
                  </text>

                  <title>
                    {`${material.name}\nCost: ${material.costLabel || material.cost}\nStrength: ${material.strength}/10\nScore: ${material.score}`}
                  </title>
                </g>
              );
            })}

            <text
              x={chartWidth / 2}
              y={CHART_CONFIG.height - 20}
              fill="#64748b"
              fontSize="12"
              textAnchor="middle"
            >
              Material rank index
            </text>

            <text
              transform={`translate(16 ${CHART_CONFIG.height / 2}) rotate(-90)`}
              fill="#64748b"
              fontSize="12"
              textAnchor="middle"
            >
              Comparative index (0-10)
            </text>
          </svg>
        </div>

        {highlightedMaterial && (
          <div
            style={{
              marginTop: "10px",
              border: "1px solid #1e293b",
              borderRadius: "10px",
              background: "#0b1220",
              padding: "10px 12px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "10px",
              color: "#cbd5e1",
              fontSize: "12px",
            }}
          >
            <div>
              <strong style={{ color: "#f8fafc" }}>
                {highlightedMaterial.name}
              </strong>
            </div>
            <div>Score: {highlightedMaterial.score}</div>
            <div>
              Cost: {highlightedMaterial.costLabel || highlightedMaterial.cost}
            </div>
            <div>Strength: {highlightedMaterial.strength}/10</div>
            <div>Durability: {highlightedMaterial.durability}/10</div>
          </div>
        )}
      </div>

      {/* Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "20px",
        }}
      >
        {finalRecommendations.map((item, index) => (
          <ElementCard
            key={index}
            item={item}
            highlightedMaterialName={
              item.element === selectedRecommendation?.element
                ? highlightedMaterial?.name
                : null
            }
            setHighlightedMaterialName={setHighlightedMaterialName}
          />
        ))}
      </div>
    </div>
  );
}

export default TradeOff;
