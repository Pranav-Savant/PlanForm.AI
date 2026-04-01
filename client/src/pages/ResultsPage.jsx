import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import LayoutViewer from "../components/LayoutViewer";
import ModelViewer from "../components/ModelViewer";
import MaterialPanel from "../components/MaterialPanel";
import ExplanationPanel from "../components/ExplanationPanel";
import TradeOff from "../components/TradeOff";
import { BlueprintRegistry } from "../components/stellar";
import ChatbotWidget from "../components/ChatBotWidget";

function ResultsPage() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });

    return () => {
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

  const result = location.state?.result;
  const image = location.state?.image;

  if (!result) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-black text-white pt-24">
        <h2 className="text-2xl font-semibold mb-6">No results found</h2>
        <button
          onClick={() => navigate("/")}
          className="px-6 py-3 bg-emerald-400 text-black font-semibold rounded-lg hover:scale-105 transition"
        >
          Go Back
        </button>
      </div>
    );
  }

  const { parsedLayout, recommendations, aiExplanation } = result;

  const analysisResults = {
    totalCost:
      recommendations?.totalCost || recommendations?.estimatedTotalCost || 0,
    totalArea:
      parsedLayout?.totalArea ||
      parsedLayout?.roomPolygons?.reduce(
        (sum, room) => sum + (room.area || 0),
        0,
      ) ||
      0,
    materials: recommendations?.materials || recommendations,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black text-white pt-24">
      {/* PAGE CONTAINER */}
      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* HEADER */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-10 gap-6">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              Analysis Results
            </h1>
            <p className="text-gray-400 mt-2">
              Structural intelligence report generated successfully
            </p>
          </div>

          <button
            onClick={() => navigate("/")}
            className="px-6 py-3 bg-emerald-400 text-black font-semibold rounded-xl hover:bg-emerald-300 transition"
          >
            Analyze Another Plan
          </button>
        </div>

        {/* CONTENT */}
        <div className="space-y-8">
          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-lg">
            <LayoutViewer
              parsedLayout={parsedLayout}
              image={image}
              coordinateImagePath={parsedLayout.coordinateImagePath}
            />
          </div>

          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-lg">
            <ModelViewer
              wallSegments={parsedLayout.wallSegments}
              roomPolygons={parsedLayout.roomPolygons}
              doorsData={parsedLayout.doorsData}
              windowsData={parsedLayout.windowsData}
              openingsData={parsedLayout.openingsData}
            />
          </div>

          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-lg">
            <MaterialPanel recommendations={recommendations} />
          </div>

          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-lg">
            <TradeOff recommendations={recommendations} />
          </div>

          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-lg">
            <ExplanationPanel aiExplanation={aiExplanation} />
          </div>
          {/* Stellar Blockchain Integration */}
          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-lg">
            <BlueprintRegistry
              analysisResults={analysisResults}
              projectName={`Floor Plan - ${new Date().toLocaleDateString()}`}
            />
          </div>

          <ChatbotWidget
            aiExplanation={aiExplanation}
            recommendations={recommendations}
            parsedLayout={parsedLayout}
          />
        </div>
      </div>
    </div>
  );
}

export default ResultsPage;
