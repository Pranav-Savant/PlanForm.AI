import { useRef, useState } from "react";

function LayoutViewer({ parsedLayout, image }) {
  const wallSegments = [...(parsedLayout?.wallSegments || [])]
    .sort((a, b) => {
      const lenA = Math.hypot(a.x2 - a.x1, a.y2 - a.y1);
      const lenB = Math.hypot(b.x2 - b.x1, b.y2 - b.y1);
      return lenB - lenA;
    })
    .slice(0, 20);

  const roomPolygons = parsedLayout?.roomPolygons || [];

  const imageRef = useRef(null);
  const [displaySize, setDisplaySize] = useState({ width: 1, height: 1 });

  const originalWidth = parsedLayout?.imageWidth || 1024;
  const originalHeight = parsedLayout?.imageHeight || 1024;

  const scaleX = displaySize.width / originalWidth;
  const scaleY = displaySize.height / originalHeight;

  const handleImageLoad = () => {
    if (imageRef.current) {
      setDisplaySize({
        width: imageRef.current.clientWidth,
        height: imageRef.current.clientHeight,
      });
    }
  };

  return (
    <div style={styles.card}>
      <h2 style={styles.heading}>Parsed Layout Visualization</h2>

      <div style={styles.previewWrapper}>
        {image ? (
          <div style={styles.imageContainer}>
            <img
              ref={imageRef}
              src={image}
              alt="Uploaded Plan"
              style={styles.image}
              onLoad={handleImageLoad}
            />

            <svg
              style={styles.svgOverlay}
              width={displaySize.width}
              height={displaySize.height}
            >
              {/* Rooms */}
              {roomPolygons.map((room, index) => (
                <polygon
                  key={index}
                  points={room
                    .map((pt) => `${pt.x * scaleX},${pt.y * scaleY}`)
                    .join(" ")}
                  fill="rgba(34,197,94,0.15)"
                  stroke="#22c55e"
                  strokeWidth="2"
                />
              ))}

              {/* Walls */}
              {wallSegments.map((wall, index) => (
                <line
                  key={index}
                  x1={wall.x1 * scaleX}
                  y1={wall.y1 * scaleY}
                  x2={wall.x2 * scaleX}
                  y2={wall.y2 * scaleY}
                  stroke="#ef4444"
                  strokeWidth="3"
                />
              ))}
            </svg>
          </div>
        ) : (
          <p style={{ color: "#9ca3af" }}>No image uploaded.</p>
        )}
      </div>

      {/* Stats */}
      <div style={styles.stats}>
        <p><strong>Walls:</strong> {parsedLayout?.walls}</p>
        <p><strong>Rooms:</strong> {parsedLayout?.rooms}</p>
        <p><strong>Openings:</strong> {parsedLayout?.openings}</p>
      </div>
    </div>
  );
}

const styles = {
  card: {
    background: "rgba(15, 23, 42, 0.6)", // 🔥 dark glass
    backdropFilter: "blur(14px)",
    padding: "24px",
    borderRadius: "16px",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 0 40px rgba(0,0,0,0.6)",
    marginBottom: "24px",
    color: "#e5e7eb",
  },
  heading: {
    marginBottom: "18px",
    color: "#fff",
  },
  previewWrapper: {
    display: "flex",
    justifyContent: "center",
    marginBottom: "20px",
  },
  imageContainer: {
    position: "relative",
    display: "inline-block",
    maxWidth: "100%",
  },
  image: {
    width: "100%",
    maxWidth: "800px",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.1)",
    display: "block",
  },
  svgOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    pointerEvents: "none",
  },
  stats: {
    display: "flex",
    justifyContent: "space-around",
    flexWrap: "wrap",
    gap: "12px",
    fontSize: "15px",
    marginTop: "10px",
    color: "#cbd5f5",
  },
};

export default LayoutViewer;