function TradeOff({ recommendations }) {
  if (!recommendations) return null;

  // Get unique wall types
  const uniqueWalls = Object.values(
    recommendations
      .filter((item) => item.element !== "column" && item.element !== "slab")
      .reduce((acc, item) => {
        if (!acc[item.element]) {
          acc[item.element] = item;
        }
        return acc;
      }, {}),
  );

  // Get one column (if exists)
  const oneColumn = recommendations.find((item) => item.element === "column");

  // Get one slab (if exists)
  const oneSlab = recommendations.find((item) => item.element === "slab");

  // Final list
  const finalRecommendations = [
    ...uniqueWalls,
    ...(oneColumn ? [oneColumn] : []),
    ...(oneSlab ? [oneSlab] : []),
  ];

  return (
    <div className="bg-[#0E1117] border border-[#1E2330] rounded-xl p-6 shadow-xl">
      {/* HEADER */}

      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white">
          Material Analysis & Cost‑Strength Tradeoff
        </h2>

        <p className="text-gray-400 mt-2">
          Ranked recommendations for each structural element
        </p>
      </div>

      {/* GRID */}

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
        {finalRecommendations.map((item, index) => (
          <div
            key={index}
            className="
              bg-[#151820]
              border border-[#1E2330]
              rounded-xl
              p-5
              hover:border-indigo-500
              transition
            "
          >
            {/* TYPE HEADER */}

            <h3 className="text-lg font-semibold text-white capitalize mb-4">
              {item.element.replaceAll("_", " ")}
            </h3>

            {/* RANKED OPTIONS */}

            <div className="space-y-4">
              {item.rankedOptions?.map((mat, idx) => (
                <div
                  key={idx}
                  className="
                    bg-[#0E1117]
                    border border-[#1E2330]
                    rounded-lg
                    p-4
                    hover:border-emerald-400
                    transition
                  "
                >
                  <div className="flex justify-between items-center mb-2">
                    <div className="font-medium text-white">{mat.name}</div>

                    <span
                      className="
                      bg-emerald-500/20
                      text-emerald-400
                      px-3
                      py-1
                      rounded-full
                      text-xs
                      font-semibold
                    "
                    >
                      Score {mat.score}
                    </span>
                  </div>

                  <div className="text-sm text-gray-400">
                    Cost: <span className="text-yellow-400">{mat.cost}</span>
                  </div>

                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Strength</span>
                      <span>{mat.strength}</span>
                    </div>

                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-indigo-500 h-2 rounded-full"
                        style={{
                          width: `${mat.score}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="text-xs text-gray-400 mt-2">
                    Durability:{" "}
                    <span className="text-cyan-400">{mat.durability}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TradeOff;
