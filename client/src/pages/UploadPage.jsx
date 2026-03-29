import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ImageUploader from "../components/ImageUploader";
import { analyzeFloorPlan } from "../services/api";

function UploadPage() {
  const [image, setImage] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleAnalyze = async () => {
    try {
      setLoading(true);
      const data = await analyzeFloorPlan(imageFile);

      navigate("/results", { state: { result: data, image } });

    } catch (error) {
      console.error("Analyze Error:", error);
      alert("Failed to analyze floor plan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0b0f19] via-[#0f172a] to-[#020617] flex items-center justify-center px-6">
      <div className="w-full max-w-3xl">

        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-5xl font-semibold tracking-tight bg-gradient-to-r from-indigo-400 to-blue-500 bg-clip-text text-transparent">
            Analyze Floor Plan
          </h1>
          <p className="mt-3 text-zinc-400 text-lg">
            Upload your layout and let AI generate structural insights instantly
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl p-8 transition-all duration-300">

          <ImageUploader
            image={image}
            setImage={setImage}
            setImageFile={setImageFile}
          />

          {/* Button */}
          <button
            onClick={handleAnalyze}
            disabled={loading || !imageFile}
            className={`mt-8 w-full py-4 rounded-xl text-lg font-semibold transition-all duration-300
            ${
              loading || !imageFile
                ? "bg-zinc-700 text-zinc-400 cursor-not-allowed"
                : "bg-gradient-to-r from-indigo-500 to-blue-500 text-white hover:from-indigo-600 hover:to-blue-600 shadow-lg hover:scale-[1.02]"
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>
                Analyzing...
              </span>
            ) : (
              "Analyze Floor Plan"
            )}
          </button>

        </div>
      </div>
    </div>
  );
}

export default UploadPage;