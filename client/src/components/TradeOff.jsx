import { useState } from "react";

const ChevronIcon = ({ open }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{
      transform: open ? "rotate(180deg)" : "rotate(0deg)",
      transition: "transform 0.25s ease",
      flexShrink: 0,
    }}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const PREVIEW_COUNT = 2; // materials shown before "Show more"

function MaterialCard({ mat, idx }) {
  return (
    <div
      style={{
        background: "#0E1117",
        border: "1px solid #1E2330",
        borderRadius: "10px",
        padding: "14px",
        transition: "border-color 0.2s",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.borderColor = "#34d399")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.borderColor = "#1E2330")
      }
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
        <span style={{ color: "#fbbf24", fontWeight: 600 }}>{mat.cost}</span>
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
          <span>{mat.strength}</span>
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
              width: `${mat.score}%`,
              background: "#6366f1",
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
          {mat.durability}
        </span>
      </div>
    </div>
  );
}

function ElementCard({ item }) {
  const [expanded, setExpanded] = useState(false);

  const options = item.rankedOptions ?? [];
  const preview = options.slice(0, PREVIEW_COUNT);
  const remaining = options.slice(PREVIEW_COUNT);
  const hasMore = remaining.length > 0;

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
      onMouseEnter={(e) =>
        (e.currentTarget.style.borderColor = "#6366f1")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.borderColor = "#1E2330")
      }
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

      {/* Always-visible preview */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {preview.map((mat, idx) => (
          <MaterialCard key={idx} mat={mat} idx={idx} />
        ))}
      </div>

      {/* Collapsible remaining materials */}
      {hasMore && (
        <>
          {/* Animated expand section */}
          <div
            style={{
              overflow: "hidden",
              maxHeight: expanded ? `${remaining.length * 140}px` : "0px",
              transition: "max-height 0.35s ease",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            {remaining.map((mat, idx) => (
              <MaterialCard
                key={idx}
                mat={mat}
                idx={PREVIEW_COUNT + idx}
              />
            ))}
          </div>

          {/* Toggle button */}
          <button
            onClick={() => setExpanded((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              width: "100%",
              background: expanded ? "#1E2330" : "rgba(99,102,241,0.1)",
              border: `1px solid ${expanded ? "#2d3348" : "rgba(99,102,241,0.3)"}`,
              borderRadius: "8px",
              padding: "8px 0",
              color: expanded ? "#9ca3af" : "#818cf8",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
              letterSpacing: "0.03em",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = expanded
                ? "#252b3b"
                : "rgba(99,102,241,0.18)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = expanded
                ? "#1E2330"
                : "rgba(99,102,241,0.1)";
            }}
          >
            <ChevronIcon open={expanded} />
            {expanded
              ? "Show less"
              : `Show ${remaining.length} more material${remaining.length !== 1 ? "s" : ""}`}
          </button>
        </>
      )}
    </div>
  );
}

function TradeOff({ recommendations }) {
  if (!recommendations) return null;

  // Deduplicate: one card per unique element type
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

  const finalRecommendations = [
    ...uniqueWalls,
    ...(oneColumn ? [oneColumn] : []),
    ...(oneSlab ? [oneSlab] : []),
  ];

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

      {/* Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "20px",
        }}
      >
        {finalRecommendations.map((item, index) => (
          <ElementCard key={index} item={item} />
        ))}
      </div>
    </div>
  );
}

export default TradeOff;