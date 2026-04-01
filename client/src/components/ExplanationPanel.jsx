import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function ExplanationPanel({ aiExplanation }) {
  return (
    <div className="bg-[#0E1117] border border-[#1E2330] rounded-xl p-6">
      <h2 className="text-2xl font-bold mb-4">AI Explanation</h2>

      <div className="rounded-lg border border-cyan-500/20 bg-slate-900/40 p-4">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h2: ({ ...props }) => (
              <h2
                className="mt-6 mb-3 text-xl font-semibold text-cyan-300 first:mt-0"
                {...props}
              />
            ),
            h3: ({ ...props }) => (
              <h3
                className="mt-4 mb-2 text-lg font-semibold text-indigo-300"
                {...props}
              />
            ),
            p: ({ ...props }) => (
              <p className="mb-3 text-gray-200 leading-relaxed" {...props} />
            ),
            ul: ({ ...props }) => (
              <ul
                className="mb-3 list-disc pl-5 text-gray-200 space-y-1"
                {...props}
              />
            ),
            ol: ({ ...props }) => (
              <ol
                className="mb-3 list-decimal pl-5 text-gray-200 space-y-1"
                {...props}
              />
            ),
            li: ({ ...props }) => (
              <li className="marker:text-cyan-400" {...props} />
            ),
            strong: ({ ...props }) => (
              <strong className="font-semibold text-white" {...props} />
            ),
            blockquote: ({ ...props }) => (
              <blockquote
                className="mb-3 border-l-4 border-amber-400/70 bg-amber-500/10 px-3 py-2 text-amber-200"
                {...props}
              />
            ),
            table: ({ ...props }) => (
              <div className="mb-3 overflow-x-auto rounded-md border border-slate-700">
                <table
                  className="w-full min-w-[420px] text-sm text-left"
                  {...props}
                />
              </div>
            ),
            thead: ({ ...props }) => (
              <thead className="bg-slate-800 text-cyan-200" {...props} />
            ),
            tbody: ({ ...props }) => (
              <tbody
                className="divide-y divide-slate-700 text-gray-200"
                {...props}
              />
            ),
            th: ({ ...props }) => (
              <th className="px-3 py-2 font-semibold" {...props} />
            ),
            td: ({ ...props }) => <td className="px-3 py-2" {...props} />,
            code: ({ inline, className, children, ...props }) =>
              inline ? (
                <code
                  className="rounded bg-slate-800 px-1 py-0.5 text-cyan-200"
                  {...props}
                >
                  {children}
                </code>
              ) : (
                <pre className="mb-3 overflow-x-auto rounded-md border border-slate-700 bg-slate-950 p-3">
                  <code className={className} {...props}>
                    {children}
                  </code>
                </pre>
              ),
          }}
        >
          {typeof aiExplanation === "string" && aiExplanation.trim()
            ? aiExplanation
            : "## AI Explanation\n\nNo explanation is available right now."}
        </ReactMarkdown>
      </div>
    </div>
  );
}

export default ExplanationPanel;
