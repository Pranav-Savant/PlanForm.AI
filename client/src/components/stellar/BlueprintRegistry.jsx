/**
 * BlueprintRegistry Component
 * Allows users to store and view their floor plan analysis results on Stellar blockchain
 */

import { useState, useEffect } from "react";
import WalletConnect from "./WalletConnect";
import TransactionStatus from "./TransactionStatus";
import {
  registerBlueprintOnChain,
  getUserBlueprints,
  hashMaterials,
  getBlueprintCount,
} from "../../services/stellar";

const BlueprintRegistry = ({
  analysisResults,
  projectName = "Floor Plan Analysis",
}) => {
  const [walletState, setWalletState] = useState({
    connected: false,
    publicKey: "",
  });
  const [isRegistering, setIsRegistering] = useState(false);
  const [transactionResult, setTransactionResult] = useState(null);
  const [userBlueprints, setUserBlueprints] = useState([]);
  const [totalBlueprints, setTotalBlueprints] = useState(0);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadBlueprintCount();
  }, []);

  useEffect(() => {
    if (walletState.connected && walletState.publicKey) {
      loadUserBlueprints();
    }
  }, [walletState]);

  const loadBlueprintCount = async () => {
    const result = await getBlueprintCount();
    if (result.success) {
      setTotalBlueprints(result.count);
    }
  };

  const loadUserBlueprints = async () => {
    if (!walletState.publicKey) return;
    const result = await getUserBlueprints(walletState.publicKey);
    if (result.success) {
      setUserBlueprints(result.blueprints);
    }
  };

  const handleWalletChange = (state) => {
    setWalletState(state);
    setTransactionResult(null);
  };

  const handleRegisterBlueprint = async () => {
    if (!walletState.connected || !analysisResults) return;

    setIsRegistering(true);
    setTransactionResult(null);

    try {
      // Generate materials hash
      const materialsHash = await hashMaterials(
        analysisResults.materials || {},
      );

      // Extract data from analysis results
      const costEstimate =
        analysisResults.totalCost || analysisResults.estimatedCost || 0;
      // Room count tracking is disabled; keep a stable placeholder for contract arg.
      const roomsCount = 1;
      const totalAreaSqft =
        analysisResults.totalArea || analysisResults.area || 0;

      const result = await registerBlueprintOnChain({
        publicKey: walletState.publicKey,
        projectName,
        costEstimate,
        materialsHash,
        roomsCount,
        totalAreaSqft: Math.floor(totalAreaSqft),
      });

      setTransactionResult(result);

      if (result.success) {
        // Refresh user blueprints and count
        await loadUserBlueprints();
        await loadBlueprintCount();
      }
    } catch (error) {
      setTransactionResult({
        success: false,
        error: error.message,
      });
    }

    setIsRegistering(false);
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">
              Blockchain Registry
            </h3>
            <p className="text-gray-400 text-sm">
              Store your analysis on Stellar network
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-purple-400">
            {totalBlueprints}
          </p>
          <p className="text-gray-500 text-xs">Total Blueprints</p>
        </div>
      </div>

      {/* Wallet Connect */}
      <WalletConnect onWalletChange={handleWalletChange} />

      {/* Analysis Summary */}
      {analysisResults && walletState.connected && (
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <h4 className="text-white font-medium mb-3">Analysis to Register</h4>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-green-400">
                {formatCurrency(
                  analysisResults.totalCost ||
                    analysisResults.estimatedCost ||
                    0,
                )}
              </p>
              <p className="text-gray-500 text-xs">Est. Cost</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-400">
                {Math.floor(
                  analysisResults.totalArea || analysisResults.area || 0,
                )}
              </p>
              <p className="text-gray-500 text-xs">Sq. Ft.</p>
            </div>
          </div>
        </div>
      )}

      {/* Register Button */}
      {walletState.connected &&
        analysisResults &&
        !transactionResult?.success && (
          <button
            onClick={handleRegisterBlueprint}
            disabled={isRegistering}
            className="w-full py-3 px-4 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white rounded-xl font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isRegistering ? (
              <>
                <svg
                  className="animate-spin w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Registering on Blockchain...
              </>
            ) : (
              <>
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
                Store Blueprint on Blockchain
              </>
            )}
          </button>
        )}

      {/* Transaction Status */}
      {transactionResult && <TransactionStatus result={transactionResult} />}

      {/* User's Blueprint History */}
      {walletState.connected && userBlueprints.length > 0 && (
        <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-700/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-purple-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-white font-medium">
                Your Blueprints ({userBlueprints.length})
              </span>
            </div>
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${showHistory ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {showHistory && (
            <div className="border-t border-gray-700">
              {userBlueprints.map((bp, index) => (
                <div
                  key={bp.id}
                  className={`px-4 py-3 flex items-center justify-between ${
                    index < userBlueprints.length - 1
                      ? "border-b border-gray-700"
                      : ""
                  }`}
                >
                  <div>
                    <p className="text-white font-medium">{bp.projectName}</p>
                    <p className="text-gray-500 text-sm">
                      ID: #{bp.id} • {formatDate(bp.timestamp)}
                    </p>
                  </div>
                  <p className="text-green-400 font-medium">
                    {formatCurrency(bp.costEstimate)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Info Footer */}
      <div className="flex items-center gap-2 text-gray-500 text-xs">
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
        <span>
          Blueprints are stored on Stellar Testnet for demonstration purposes
        </span>
      </div>
    </div>
  );
};

export default BlueprintRegistry;
