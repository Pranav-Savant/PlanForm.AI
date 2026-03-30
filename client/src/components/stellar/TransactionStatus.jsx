/**
 * TransactionStatus Component
 * Displays the result of a blockchain transaction
 */

const TransactionStatus = ({ result }) => {
  if (!result) return null;

  if (result.success) {
    return (
      <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
            <svg
              className="w-5 h-5 text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-green-400 font-medium">
              Successfully Registered!
            </h4>
            <p className="text-gray-400 text-sm mt-1">
              Your blueprint has been stored on the Stellar blockchain.
            </p>

            {result.blueprintId && (
              <div className="mt-2 bg-gray-800/50 rounded-lg p-2">
                <p className="text-gray-500 text-xs">Blueprint ID</p>
                <p className="text-white font-mono">#{result.blueprintId}</p>
              </div>
            )}

            {result.transactionHash && (
              <div className="mt-2 bg-gray-800/50 rounded-lg p-2">
                <p className="text-gray-500 text-xs">Transaction Hash</p>
                <p className="text-white font-mono text-xs break-all">
                  {result.transactionHash}
                </p>
              </div>
            )}

            {result.explorerUrl && (
              <a
                href={result.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-colors text-sm"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
                View on Block Explorer
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/30 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
          <svg
            className="w-5 h-5 text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>
        <div className="flex-1">
          <h4 className="text-red-400 font-medium">Transaction Failed</h4>
          <p className="text-gray-400 text-sm mt-1">
            {result.error ||
              "An unknown error occurred while registering the blueprint."}
          </p>
          <div className="mt-3 flex gap-2">
            <a
              href="https://developers.stellar.org/docs/smart-contracts/getting-started"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Troubleshooting Guide
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransactionStatus;
