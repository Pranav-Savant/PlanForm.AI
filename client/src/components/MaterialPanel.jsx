function MaterialPanel({ recommendations }) {
  // Filter out slab and column
  const filteredRecommendations =
    recommendations?.filter(
      (item) => item.element !== "column" && item.element !== "slab",
    ) || [];

  return (
    <div className="bg-[#0E1117] border border-[#1E2330] rounded-xl p-6 shadow-xl">
      {/* HEADER */}

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">
          Material Recommendations
        </h2>

        <span className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-sm font-medium">
          {filteredRecommendations.length} Items
        </span>
      </div>

      {/* TABLE */}

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-300">
          <thead className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
            <tr>
              <th className="px-4 py-3">S.No.</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Length</th>
              <th className="px-4 py-3">Cost</th>
              <th className="px-4 py-3">Strength</th>
              <th className="px-4 py-3">Durability</th>
            </tr>
          </thead>

          <tbody>
            {filteredRecommendations.map((item, index) => {
              // Take only the top ranked option
              const mat = item.rankedOptions?.[0];

              return (
                <tr
                  key={index}
                  className="border-b border-[#1E2330] hover:bg-[#151820] transition"
                >
                  <td className="px-4 py-3 text-gray-400">{index + 1}</td>

                  <td className="px-4 py-3">
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400">
                      {item.element.replaceAll("_", " ")}
                    </span>
                  </td>

                  <td className="px-4 py-3">{item.span} m</td>

                  <td className="px-4 py-3 text-yellow-400 font-medium">
                    {mat?.costLabel || mat?.cost}
                  </td>

                  <td className="px-4 py-3 text-green-400 font-medium">
                    {mat?.strength}
                  </td>

                  <td className="px-4 py-3 text-cyan-400 font-medium">
                    {mat?.durability}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default MaterialPanel;
