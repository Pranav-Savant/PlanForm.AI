function ExplanationPanel({ aiExplanation }) {
  return (
    <div className="bg-[#0E1117] border border-[#1E2330] rounded-xl p-6">
      <h2 className="text-2xl font-bold mb-4">AI Explanation</h2>

      <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
        {aiExplanation}
      </p>
    </div>
  );
}

export default ExplanationPanel;
