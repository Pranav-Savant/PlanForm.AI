/**
 * Stellar Integration Service for PlanForm.AI
 * Using stellar-sdk v11.3.0 for Freighter compatibility
 */

import * as StellarSdk from "@stellar/stellar-sdk";
import freighterApi from "@stellar/freighter-api";

const APP_NETWORK =
  (import.meta.env.VITE_STELLAR_NETWORK || "testnet").toLowerCase() === "public"
    ? "public"
    : "testnet";

// Stellar network configuration
const NETWORK_PASSPHRASE =
  APP_NETWORK === "public"
    ? StellarSdk.Networks.PUBLIC
    : StellarSdk.Networks.TESTNET;
const SOROBAN_RPC_URL =
  APP_NETWORK === "public"
    ? "https://mainnet.sorobanrpc.com"
    : "https://soroban-testnet.stellar.org";
const HORIZON_URL =
  APP_NETWORK === "public"
    ? "https://horizon.stellar.org"
    : "https://horizon-testnet.stellar.org";

// Contract ID
const CONTRACT_ID = import.meta.env.VITE_CONTRACT_ID;

// sdk v14 uses `rpc`; older versions used `SorobanRpc`.
const SorobanRpc = StellarSdk.SorobanRpc || StellarSdk.rpc;

// Initialize Soroban server
const server = new SorobanRpc.Server(SOROBAN_RPC_URL);
const horizon = new StellarSdk.Horizon.Server(HORIZON_URL);

const getFreighterErrorMessage = (err, fallback) => {
  if (!err) return fallback;
  if (typeof err === "string") return err;
  if (typeof err.message === "string") return err.message;
  if (typeof err.error === "string") return err.error;
  return fallback;
};

const isFreighterAccessDeniedError = (err) => {
  const message = getFreighterErrorMessage(err, "").toLowerCase();
  return (
    message.includes("denied") ||
    message.includes("rejected") ||
    message.includes("cancelled") ||
    message.includes("canceled") ||
    message.includes("declined") ||
    message.includes("not authorized")
  );
};

const parseFreighterNetwork = (networkResult) => {
  const raw =
    networkResult?.network ||
    networkResult?.networkPassphrase ||
    networkResult?.networkUrl ||
    "";
  const value = String(raw).toLowerCase();

  if (value.includes("test")) return "testnet";
  if (value.includes("public") || value.includes("main")) return "public";
  return "unknown";
};

const toSafeNumber = (value, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") {
    const asNumber = Number(value);
    return Number.isFinite(asNumber) ? asNumber : fallback;
  }
  if (typeof value === "string") {
    const asNumber = Number(value);
    return Number.isFinite(asNumber) ? asNumber : fallback;
  }
  return fallback;
};

const getSignedTxXdr = (signResult) => {
  if (!signResult) return "";

  // Freighter v2 returns a signed XDR string directly.
  if (typeof signResult === "string") {
    return signResult;
  }

  // Backward-compatible fallback for older response shapes.
  if (typeof signResult === "object") {
    if (typeof signResult.signedTxXdr === "string") {
      return signResult.signedTxXdr;
    }
    if (typeof signResult.signedTransaction === "string") {
      return signResult.signedTransaction;
    }
  }

  return "";
};

const rpcRequest = async (method, params) => {
  const response = await fetch(SOROBAN_RPC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Soroban RPC request failed with status ${response.status}`,
    );
  }

  const payload = await response.json();
  if (payload?.error) {
    throw new Error(
      payload.error.message ||
        payload.error?.data ||
        "Soroban RPC responded with an error",
    );
  }

  return payload?.result;
};

const getTransactionStatusRaw = async (hash) =>
  rpcRequest("getTransaction", { hash });

const parseReturnValueToBlueprintId = (returnValue) => {
  if (!returnValue) return null;

  try {
    // Raw RPC returns base64-encoded ScVal; sdk helpers use xdr.ScVal object.
    const scVal =
      typeof returnValue === "string"
        ? StellarSdk.xdr.ScVal.fromXDR(returnValue, "base64")
        : returnValue;

    return toSafeNumber(StellarSdk.scValToNative(scVal), 0);
  } catch {
    return null;
  }
};

const toContractAddressScVal = (address) =>
  StellarSdk.Address.fromString(address).toScVal();

const buildReadOnlyTransaction = (contractCallOperation) => {
  const source = new StellarSdk.Account(
    StellarSdk.Keypair.random().publicKey(),
    "0",
  );

  return new StellarSdk.TransactionBuilder(source, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contractCallOperation)
    .setTimeout(30)
    .build();
};

const simulateContractCall = async (contractCallOperation) => {
  const transaction = buildReadOnlyTransaction(contractCallOperation);
  const simResponse = await server.simulateTransaction(transaction);

  if (SorobanRpc.Api.isSimulationError(simResponse)) {
    throw new Error(
      getFreighterErrorMessage(
        simResponse,
        "Contract simulation failed. Please try again.",
      ),
    );
  }

  if (!simResponse.result) {
    throw new Error("No contract result was returned.");
  }

  const retval =
    simResponse.result.retval ||
    simResponse.result.returnValue ||
    simResponse.returnValue;

  if (!retval) return null;
  return StellarSdk.scValToNative(retval);
};

const parseBlueprintInfo = (item) => {
  const source = item || {};

  return {
    id: toSafeNumber(source.id, 0),
    projectName: source.project_name || source.projectName || "Untitled",
    costEstimate: toSafeNumber(source.cost_estimate ?? source.costEstimate, 0),
    timestamp: toSafeNumber(source.timestamp, 0),
  };
};

const parseBlueprint = (item) => {
  const source = item || {};

  return {
    id: toSafeNumber(source.id, 0),
    projectName: source.project_name || source.projectName || "Untitled",
    owner: source.owner || null,
    costEstimate: toSafeNumber(source.cost_estimate ?? source.costEstimate, 0),
    materialHash: source.material_hash || source.materialHash || "",
    roomsCount: toSafeNumber(source.rooms_count ?? source.roomsCount, 0),
    totalAreaSqft: toSafeNumber(
      source.total_area_sqft ?? source.totalAreaSqft,
      0,
    ),
    timestamp: toSafeNumber(source.timestamp, 0),
    isVerified: Boolean(source.is_verified ?? source.isVerified),
  };
};

/**
 * Check if Freighter wallet extension is installed
 */
export const checkFreighterInstalled = async () => {
  try {
    const connectionState = await freighterApi.isConnected();

    if (connectionState?.isConnected === true) {
      return true;
    }

    if (connectionState?.error) {
      const errText = getFreighterErrorMessage(connectionState.error, "")
        .toLowerCase()
        .trim();
      if (errText.includes("not installed")) {
        return false;
      }
    }

    // Freighter can be installed but disconnected from this dApp.
    return true;
  } catch (error) {
    error;
    return (
      typeof window !== "undefined" &&
      Boolean(window.freighterApi || window.freighter)
    );
  }
};

/**
 * Connect to Freighter wallet and get public key
 */
export const connectWallet = async () => {
  try {
    const installed = await checkFreighterInstalled();
    if (!installed) {
      throw new Error(
        "Freighter wallet is not installed. Please install the Freighter browser extension.",
      );
    }

    let requestedPublicKey = "";
    const allowedResult = await freighterApi.isAllowed();
    if (!allowedResult.isAllowed) {
      try {
        if (typeof freighterApi.requestAccess === "function") {
          requestedPublicKey = await freighterApi.requestAccess();
        } else {
          await freighterApi.setAllowed();
        }
      } catch (error) {
        if (isFreighterAccessDeniedError(error)) {
          throw new Error(
            "Freighter access was denied. Click Connect Freighter again and approve the permission popup in Freighter.",
          );
        }
        throw error;
      }

      const recheckAllowed = await freighterApi.isAllowed();
      if (!recheckAllowed.isAllowed && !requestedPublicKey) {
        throw new Error(
          "Freighter access is not enabled for this site. In Freighter, allow this dApp and try again.",
        );
      }
    }

    const addressResult = requestedPublicKey
      ? { address: requestedPublicKey }
      : await freighterApi.getAddress();
    if (!addressResult.address) {
      throw new Error("Could not retrieve public key from Freighter.");
    }

    const networkResult = await freighterApi.getNetwork();
    const walletNetwork = parseFreighterNetwork(networkResult);

    if (walletNetwork !== "unknown" && walletNetwork !== APP_NETWORK) {
      throw new Error(
        `Freighter is set to ${walletNetwork}, but this app expects ${APP_NETWORK}. Please switch networks in Freighter.`,
      );
    }

    return {
      success: true,
      publicKey: addressResult.address,
      network: walletNetwork,
    };
  } catch (error) {
    console.error("Wallet connection error:", error);
    return {
      success: false,
      error: getFreighterErrorMessage(error, "Failed to connect wallet"),
    };
  }
};

/**
 * Get account details
 */
export const getAccountDetails = async (publicKey) => {
  try {
    const account = await horizon.loadAccount(publicKey);
    const nativeAsset = account.balances.find(
      (balance) => balance.asset_type === "native",
    );

    return {
      success: true,
      balance: nativeAsset?.balance || "0",
      sequence: account.sequence,
    };
  } catch (error) {
    error;
    return {
      success: false,
      error: "Account not found. Fund via Friendbot.",
    };
  }
};

/**
 * Fund account using Stellar Friendbot
 */
export const fundWithFriendbot = async (publicKey) => {
  try {
    const response = await fetch(
      `https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`,
    );
    if (!response.ok) throw new Error("Friendbot failed");
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Create hash of materials data
 */
export const hashMaterials = async (materialsData) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(materialsData));
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .substring(0, 32);
};

/**
 * Register blueprint on blockchain
 */
export const registerBlueprintOnChain = async ({
  publicKey,
  projectName,
  costEstimate,
  materialsHash,
  roomsCount,
  totalAreaSqft,
}) => {
  try {
    // Load account
    const sourceAccount = await server.getAccount(publicKey);

    // Create contract
    const contract = new StellarSdk.Contract(CONTRACT_ID);

    // Safe parameter values
    const pName = String(projectName || "Floor Plan").slice(0, 30);
    const pCost = BigInt(Math.max(1, Math.floor(Number(costEstimate || 1000))));
    const pHash = String(materialsHash || "default").slice(0, 32);
    const pRooms = Math.max(1, Math.floor(Number(roomsCount || 1)));
    const pArea = Math.max(1, Math.floor(Number(totalAreaSqft || 100)));

    // Build the operation
    const operation = contract.call(
      "register_blueprint",
      StellarSdk.nativeToScVal(pName, { type: "string" }),
      toContractAddressScVal(publicKey),
      StellarSdk.nativeToScVal(pCost, { type: "i128" }),
      StellarSdk.nativeToScVal(pHash, { type: "string" }),
      StellarSdk.nativeToScVal(pRooms, { type: "u32" }),
      StellarSdk.nativeToScVal(pArea, { type: "u32" }),
    );

    // Build transaction
    let transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

    // Simulate
    const simResponse = await server.simulateTransaction(transaction);

    if (SorobanRpc.Api.isSimulationError(simResponse) || !simResponse.result) {
      console.error("Simulation failed:", simResponse);
      throw new Error(
        "Simulation failed: " + (simResponse.error || "Unknown error"),
      );
    }

    // Prepare transaction
    const preparedTx = SorobanRpc.assembleTransaction(
      transaction,
      simResponse,
    ).build();

    // Get XDR for signing
    const txXdr = preparedTx.toXDR();

    // Sign with Freighter
    const signResult = await freighterApi.signTransaction(txXdr, {
      networkPassphrase: NETWORK_PASSPHRASE,
      accountToSign: publicKey,
    });

    const signedTxXdr = getSignedTxXdr(signResult);
    if (!signedTxXdr) {
      throw new Error("Failed to sign transaction");
    }

    // Reconstruct and submit
    const signedTx = StellarSdk.TransactionBuilder.fromXDR(
      signedTxXdr,
      NETWORK_PASSPHRASE,
    );

    const sendResponse = await server.sendTransaction(signedTx);

    if (sendResponse.status === "ERROR") {
      throw new Error(
        "Send failed: " + JSON.stringify(sendResponse.errorResult),
      );
    }

    // Poll for result via raw RPC to avoid sdk decode issues on newer ledger metadata.
    if (sendResponse.status === "PENDING") {
      let getResponse = await getTransactionStatusRaw(sendResponse.hash);
      let attempts = 0;

      while (getResponse.status === "NOT_FOUND" && attempts < 30) {
        await new Promise((r) => setTimeout(r, 1000));
        getResponse = await getTransactionStatusRaw(sendResponse.hash);
        attempts++;
      }

      if (getResponse.status === "SUCCESS") {
        const returnValue =
          getResponse.returnValue ||
          getResponse.result?.retval ||
          getResponse.result?.returnValue;
        const blueprintId = parseReturnValueToBlueprintId(returnValue);

        return {
          success: true,
          transactionHash: sendResponse.hash,
          blueprintId,
          explorerUrl: `https://stellar.expert/explorer/${APP_NETWORK}/tx/${sendResponse.hash}`,
        };
      } else if (getResponse.status === "FAILED") {
        throw new Error(
          "Transaction execution failed on-chain. Network fee is still charged even when execution fails.",
        );
      } else {
        throw new Error("Transaction failed: " + getResponse.status);
      }
    }

    return {
      success: true,
      transactionHash: sendResponse.hash,
      explorerUrl: `https://stellar.expert/explorer/${APP_NETWORK}/tx/${sendResponse.hash}`,
    };
  } catch (error) {
    console.error("=== REGISTRATION ERROR ===", error);
    return {
      success: false,
      error: getFreighterErrorMessage(error, "Unknown error"),
    };
  }
};

/**
 * Get blueprint from blockchain
 */
export const getBlueprintFromChain = async (blueprintId) => {
  try {
    const contract = new StellarSdk.Contract(CONTRACT_ID);
    const value = await simulateContractCall(
      contract.call(
        "get_blueprint",
        StellarSdk.nativeToScVal(BigInt(blueprintId), { type: "u64" }),
      ),
    );

    return {
      success: true,
      blueprint: parseBlueprint(value),
    };
  } catch (error) {
    return {
      success: false,
      error: getFreighterErrorMessage(error, "Failed to fetch blueprint"),
    };
  }
};

/**
 * Get user blueprints
 */
export const getUserBlueprints = async (publicKey) => {
  try {
    const contract = new StellarSdk.Contract(CONTRACT_ID);
    const value = await simulateContractCall(
      contract.call("get_user_blueprints", toContractAddressScVal(publicKey)),
    );

    const blueprints = Array.isArray(value)
      ? value.map(parseBlueprintInfo)
      : [];

    return {
      success: true,
      blueprints,
    };
  } catch (error) {
    return {
      success: false,
      error: getFreighterErrorMessage(
        error,
        "Failed to fetch user blueprints from chain",
      ),
    };
  }
};

/**
 * Get blueprint count
 */
export const getBlueprintCount = async () => {
  try {
    const contract = new StellarSdk.Contract(CONTRACT_ID);
    const value = await simulateContractCall(
      contract.call("get_blueprint_count"),
    );

    return {
      success: true,
      count: toSafeNumber(value, 0),
    };
  } catch (error) {
    return {
      success: false,
      error: getFreighterErrorMessage(
        error,
        "Failed to fetch blueprint count from chain",
      ),
    };
  }
};

export default {
  checkFreighterInstalled,
  connectWallet,
  getAccountDetails,
  fundWithFriendbot,
  hashMaterials,
  registerBlueprintOnChain,
  getBlueprintFromChain,
  getUserBlueprints,
  getBlueprintCount,
};
