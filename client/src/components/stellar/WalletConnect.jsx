/**
 * WalletConnect Component
 * Handles Freighter wallet connection for Stellar blockchain integration
 */

import { useState, useEffect } from "react";
import {
  checkFreighterInstalled,
  connectWallet,
  getAccountDetails,
  fundWithFriendbot,
} from "../../services/stellar";

const WalletConnect = ({ onWalletChange }) => {
  const [isInstalled, setIsInstalled] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [publicKey, setPublicKey] = useState("");
  const [balance, setBalance] = useState("0");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isFunding, setIsFunding] = useState(false);

  // Check if Freighter is installed on mount
  useEffect(() => {
    const checkInstallation = async () => {
      const installed = await checkFreighterInstalled();
      setIsInstalled(installed);
    };
    checkInstallation();
  }, []);

  // Load account details when connected
  useEffect(() => {
    if (publicKey) {
      loadAccountDetails();
    }
  }, [publicKey]);

  const loadAccountDetails = async () => {
    const result = await getAccountDetails(publicKey);
    if (result.success) {
      setBalance(result.balance);
      setError("");
    } else {
      setError(result.error);
      setBalance("0");
    }
  };

  const handleConnect = async () => {
    setIsLoading(true);
    setError("");

    const result = await connectWallet();

    if (result.success) {
      setIsConnected(true);
      setPublicKey(result.publicKey);
      onWalletChange?.({
        connected: true,
        publicKey: result.publicKey,
      });
    } else {
      setError(result.error);
    }

    setIsLoading(false);
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setPublicKey("");
    setBalance("0");
    setError("");
    onWalletChange?.({
      connected: false,
      publicKey: "",
    });
  };

  const handleFundAccount = async () => {
    setIsFunding(true);
    setError("");

    const result = await fundWithFriendbot(publicKey);

    if (result.success) {
      // Reload account details
      await loadAccountDetails();
    } else {
      setError(result.error);
    }

    setIsFunding(false);
  };

  const truncateAddress = (address) => {
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Not installed state
  if (!isInstalled) {
    return (
      <div className="bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-500/30 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-orange-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div className="flex-1">
            <h4 className="text-orange-400 font-medium">
              Freighter Wallet Required
            </h4>
            <p className="text-gray-400 text-sm">
              Install Freighter to store blueprints on Stellar blockchain
            </p>
          </div>
          <a
            href="https://www.freighter.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors text-sm font-medium"
          >
            Install Freighter
          </a>
        </div>
      </div>
    );
  }

  // Connected state
  if (isConnected) {
    return (
      <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
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
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-green-400 font-medium">Connected</span>
                <span className="text-gray-400 text-sm bg-gray-800 px-2 py-0.5 rounded font-mono">
                  {truncateAddress(publicKey)}
                </span>
              </div>
              <p className="text-gray-400 text-sm">
                Balance:{" "}
                <span className="text-white font-medium">
                  {parseFloat(balance).toFixed(2)} XLM
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {parseFloat(balance) < 1 && (
              <button
                onClick={handleFundAccount}
                disabled={isFunding}
                className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors text-sm disabled:opacity-50"
              >
                {isFunding ? "Funding..." : "Fund (Testnet)"}
              </button>
            )}
            <button
              onClick={handleDisconnect}
              className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors text-sm"
            >
              Disconnect
            </button>
          </div>
        </div>
        {error && <p className="mt-2 text-red-400 text-sm">{error}</p>}
      </div>
    );
  }

  // Disconnected state
  return (
    <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
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
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
          </div>
          <div>
            <h4 className="text-white font-medium">Connect Wallet</h4>
            <p className="text-gray-400 text-sm">
              Store your blueprint on Stellar blockchain
            </p>
          </div>
        </div>
        <button
          onClick={handleConnect}
          disabled={isLoading}
          className="px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white rounded-lg transition-all text-sm font-medium disabled:opacity-50 flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <svg
                className="animate-spin w-4 h-4"
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
              Connecting...
            </>
          ) : (
            <>
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
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              Connect Freighter
            </>
          )}
        </button>
      </div>
      {error && <p className="mt-2 text-red-400 text-sm">{error}</p>}
    </div>
  );
};

export default WalletConnect;
