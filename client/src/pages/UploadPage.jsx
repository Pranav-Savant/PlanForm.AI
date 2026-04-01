import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ImageUploader from "../components/ImageUploader";
import { analyzeFloorPlanWithProgress } from "../services/api";

function UploadPage() {
  const [image, setImage] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(-1);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [statusMessage, setStatusMessage] = useState(
    "Waiting for server updates...",
  );
  const [canRetry, setCanRetry] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const abortControllerRef = useRef(null);

  const processingSteps = useMemo(
    () => [
      { key: "preparing_image", label: "Preparing image" },
      { key: "parsing_2d_layout", label: "Parsing 2D layout" },
      {
        key: "detecting_structural_geometry",
        label: "Detecting structural geometry",
      },
      { key: "estimating_materials", label: "Estimating materials" },
      { key: "evaluating_tradeoffs", label: "Evaluating trade-offs" },
      { key: "generating_final_report", label: "Generating final report" },
    ],
    [],
  );

  const stepKeyToIndex = useMemo(
    () =>
      processingSteps.reduce((acc, step, index) => {
        acc[step.key] = index;
        return acc;
      }, {}),
    [processingSteps],
  );

  const navigate = useNavigate();

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleCancelAnalysis = () => {
    if (!abortControllerRef.current) return;
    setStatusMessage("Canceling analysis...");
    abortControllerRef.current.abort();
  };

  const handleAnalyze = async () => {
    const controller = new AbortController();
    abortControllerRef.current = controller;
    let shouldResetStatus = true;

    try {
      setLoading(true);
      setActiveStep(0);
      setCompletedSteps([]);
      setErrorMessage("");
      setCanRetry(false);
      setStatusMessage("Connecting to analysis pipeline...");

      const data = await analyzeFloorPlanWithProgress(imageFile, {
        signal: controller.signal,
        onEvent: (event) => {
          if (!event) return;

          if (event.message) {
            setStatusMessage(event.message);
          }

          const indexFromKey =
            typeof event.stepKey === "string"
              ? stepKeyToIndex[event.stepKey]
              : undefined;
          const resolvedStepIndex =
            typeof event.stepIndex === "number"
              ? event.stepIndex
              : indexFromKey;

          if (
            event.type === "step_started" &&
            typeof resolvedStepIndex === "number"
          ) {
            setActiveStep(resolvedStepIndex);
          }

          if (
            event.type === "step_completed" &&
            typeof resolvedStepIndex === "number"
          ) {
            setCompletedSteps((prev) =>
              prev.includes(resolvedStepIndex)
                ? prev
                : [...prev, resolvedStepIndex],
            );
            setActiveStep((prev) =>
              prev === resolvedStepIndex &&
              resolvedStepIndex < processingSteps.length - 1
                ? resolvedStepIndex + 1
                : prev,
            );
          }

          if (event.type === "mode_changed" && event.mode === "fallback") {
            setActiveStep(0);
          }

          if (event.type === "completed") {
            setCompletedSteps(processingSteps.map((_, index) => index));
            setActiveStep(processingSteps.length - 1);
            setStatusMessage("Analysis complete. Opening your results...");
          }
        },
      });

      navigate("/results", { state: { result: data, image } });
    } catch (error) {
      console.error("Analyze Error:", error);

      if (error?.name === "AbortError" || error?.code === "ERR_CANCELED") {
        shouldResetStatus = false;
        setStatusMessage("Analysis canceled.");
        setErrorMessage("Analysis canceled. You can retry anytime.");
        setCanRetry(Boolean(imageFile));
      } else {
        shouldResetStatus = false;
        setStatusMessage("Analysis failed.");
        setErrorMessage("Failed to analyze floor plan. Please retry.");
        setCanRetry(Boolean(imageFile));
      }
    } finally {
      abortControllerRef.current = null;
      setLoading(false);
      setActiveStep(-1);
      setCompletedSteps([]);
      if (shouldResetStatus) {
        setStatusMessage("Waiting for server updates...");
      }
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

          {loading && (
            <div className="mt-8 rounded-2xl border border-cyan-400/30 bg-gradient-to-r from-cyan-500/10 via-sky-500/10 to-indigo-500/10 p-5">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-200/90">
                  Analysis in progress
                </p>
                <span className="text-xs text-zinc-300">
                  Step {Math.max(activeStep + 1, 1)} of {processingSteps.length}
                </span>
              </div>

              <p className="mb-4 text-sm text-zinc-300">{statusMessage}</p>

              <div className="overflow-x-auto pb-1">
                <div className="flex min-w-max items-stretch gap-3">
                  {processingSteps.map((step, index) => {
                    const isCompleted = completedSteps.includes(index);
                    const isActive = index === activeStep;

                    return (
                      <div
                        key={step.key}
                        className={`min-w-[190px] rounded-xl border px-4 py-3 transition-all duration-500 ${
                          isCompleted
                            ? "border-emerald-300/60 bg-emerald-400/15 text-emerald-100"
                            : isActive
                              ? "border-cyan-300/70 bg-cyan-400/20 text-cyan-100 shadow-[0_0_30px_rgba(34,211,238,0.2)]"
                              : "border-white/15 bg-white/5 text-zinc-400"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                              isCompleted
                                ? "bg-emerald-300/30 text-emerald-100"
                                : isActive
                                  ? "bg-cyan-300/30 text-cyan-100 animate-pulse"
                                  : "bg-white/10 text-zinc-300"
                            }`}
                          >
                            {isCompleted ? "✓" : index + 1}
                          </span>
                          <p className="text-sm font-semibold leading-snug">
                            {step.label}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Button */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={handleAnalyze}
              disabled={loading || !imageFile}
              className={`w-full py-4 rounded-xl text-lg font-semibold transition-all duration-300
            ${
              loading || !imageFile
                ? "bg-zinc-700 text-zinc-400 cursor-not-allowed"
                : "bg-gradient-to-r from-indigo-500 to-blue-500 text-white hover:from-indigo-600 hover:to-blue-600 shadow-lg hover:scale-[1.02]"
            }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>
                  Processing Floor Plan...
                </span>
              ) : canRetry ? (
                "Retry Analysis"
              ) : (
                "Analyze Floor Plan"
              )}
            </button>

            <button
              onClick={handleCancelAnalysis}
              disabled={!loading}
              className={`w-full sm:max-w-[210px] py-4 rounded-xl text-lg font-semibold transition-all duration-300 ${
                loading
                  ? "border border-rose-300/70 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30"
                  : "border border-zinc-700 bg-zinc-800/60 text-zinc-500 cursor-not-allowed"
              }`}
            >
              Cancel Analysis
            </button>
          </div>

          {errorMessage && !loading && (
            <p className="mt-4 rounded-lg border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              {errorMessage}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default UploadPage;
