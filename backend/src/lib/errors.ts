import { rpc, xdr, ScVal } from "@stellar/stellar-sdk";

export enum ErrorType {
  CONTRACT = "CONTRACT",
  AUTH = "AUTH",
  VALIDATION = "VALIDATION",
  ACCOUNT_STATE = "ACCOUNT_STATE",
  RPC = "RPC",
  INTERNAL = "INTERNAL"
}

export enum ErrorCode {
  // Contract Errors (mapped from SplitError)
  PROJECT_EXISTS = "PROJECT_EXISTS",
  NOT_FOUND = "NOT_FOUND",
  UNAUTHORIZED = "UNAUTHORIZED",
  INVALID_SPLIT = "INVALID_SPLIT",
  TOO_FEW_COLLABORATORS = "TOO_FEW_COLLABORATORS",
  ZERO_SHARE = "ZERO_SHARE",
  NO_BALANCE = "NO_BALANCE",
  ALREADY_LOCKED = "ALREADY_LOCKED",
  PROJECT_LOCKED = "PROJECT_LOCKED",
  DUPLICATE_COLLABORATOR = "DUPLICATE_COLLABORATOR",
  INVALID_AMOUNT = "INVALID_AMOUNT",
  TOKEN_NOT_ALLOWED = "TOKEN_NOT_ALLOWED",
  ADMIN_NOT_SET = "ADMIN_NOT_SET",
  ARITHMETIC_OVERFLOW = "ARITHMETIC_OVERFLOW",
  INSUFFICIENT_UNALLOCATED = "INSUFFICIENT_UNALLOCATED",
  DISTRIBUTIONS_PAUSED = "DISTRIBUTIONS_PAUSED",

  // Account/Chain State
  ACCOUNT_NOT_FOUND = "ACCOUNT_NOT_FOUND",
  INSUFFICIENT_FUNDS = "INSUFFICIENT_FUNDS",

  // System/Other
  VALIDATION_ERROR = "VALIDATION_ERROR",
  SIMULATION_FAILED = "SIMULATION_FAILED",
  RPC_CONNECTIVITY = "RPC_CONNECTIVITY",
  INTERNAL_ERROR = "INTERNAL_ERROR"
}

export interface RemediationHint {
  message: string;
  action?: string;
  docsUrl?: string;
}

export class AppError extends Error {
  constructor(
    public type: ErrorType,
    public code: ErrorCode,
    message: string,
    public remediation?: RemediationHint,
    public details?: any
  ) {
    super(message);
    this.name = "AppError";
  }
}

const CONTRACT_ERROR_MAP: Record<number, { code: ErrorCode; message: string; remediation: RemediationHint }> = {
  1: {
    code: ErrorCode.PROJECT_EXISTS,
    message: "Project ID already exists on-chain",
    remediation: { message: "Choose a unique project ID and try again.", action: "Change Project ID" }
  },
  2: {
    code: ErrorCode.NOT_FOUND,
    message: "Project ID not found",
    remediation: { message: "The requested project does not exist on the network.", action: "Verify ID" }
  },
  3: {
    code: ErrorCode.UNAUTHORIZED,
    message: "Caller is not the project owner",
    remediation: { message: "Only the project owner can perform this action.", action: "Switch Wallet" }
  },
  4: {
    code: ErrorCode.INVALID_SPLIT,
    message: "Basis points do not sum to exactly 10,000",
    remediation: { message: "Ensure all collaborator shares sum to exactly 100%.", action: "Fix Shares" }
  },
  5: {
    code: ErrorCode.TOO_FEW_COLLABORATORS,
    message: "Fewer than 2 collaborators provided",
    remediation: { message: "A split project must have at least 2 collaborators.", action: "Add Collaborator" }
  },
  6: {
    code: ErrorCode.ZERO_SHARE,
    message: "A collaborator was assigned 0 basis points",
    remediation: { message: "Every collaborator must have a non-zero share.", action: "Update Shares" }
  },
  7: {
    code: ErrorCode.NO_BALANCE,
    message: "Target project holds no balance to distribute",
    remediation: { message: "Wait for funds to be deposited before distributing.", action: "Deposit Funds" }
  },
  8: {
    code: ErrorCode.ALREADY_LOCKED,
    message: "Project is already locked",
    remediation: { message: "This project has already been locked and cannot be modified further." }
  },
  9: {
    code: ErrorCode.PROJECT_LOCKED,
    message: "Project is locked; splits cannot be updated",
    remediation: { message: "Locked projects cannot have their collaborator list updated." }
  },
  10: {
    code: ErrorCode.DUPLICATE_COLLABORATOR,
    message: "Duplicate collaborator address detected",
    remediation: { message: "Ensure each collaborator address is unique.", action: "Remove Duplicates" }
  },
  11: {
    code: ErrorCode.INVALID_AMOUNT,
    message: "Amount is invalid",
    remediation: { message: "The provided amount must be positive and within valid ranges.", action: "Check Amount" }
  },
  12: {
    code: ErrorCode.TOKEN_NOT_ALLOWED,
    message: "Token is not in the allowlist",
    remediation: { message: "This contract only supports specific tokens.", action: "Use Allowed Token" }
  },
  13: {
    code: ErrorCode.ADMIN_NOT_SET,
    message: "Contract admin not configured",
    remediation: { message: "The contract is not fully initialized. Contact support.", action: "Contact Support" }
  },
  14: {
    code: ErrorCode.ARITHMETIC_OVERFLOW,
    message: "Calculation overflow occurred",
    remediation: { message: "An internal math error occurred. This may be due to extremely large amounts." }
  },
  15: {
    code: ErrorCode.INSUFFICIENT_UNALLOCATED,
    message: "Insufficient unallocated balance",
    remediation: { message: "Requested withdrawal exceeds the available unallocated funds." }
  },
  16: {
    code: ErrorCode.DISTRIBUTIONS_PAUSED,
    message: "Distributions are paused",
    remediation: { message: "The admin has temporarily paused all distributions.", action: "Try Later" }
  }
};

export function translateSorobanError(err: any): AppError {
  // 1. Handle HTTP/RPC connectivity issues
  if (err?.message?.includes("fetch failed") || err?.message?.includes("ECONNREFUSED")) {
    return new AppError(
      ErrorType.RPC,
      ErrorCode.RPC_CONNECTIVITY,
      "Unable to connect to Soroban RPC",
      { message: "The blockchain node is currently unreachable.", action: "Check Network Status" }
    );
  }

  // 2. Handle Simulation Failures (Contract Errors)
  // When using server.prepareTransaction or server.simulateTransaction
  const simulationResult = err?.simulationResult || err?.response?.results?.[0];
  
  if (simulationResult?.error) {
    const rawError = simulationResult.error;
    // Extract contract error code if available
    // Format is often "HostError: Error(Contract, Code(1))"
    const contractErrorCodeMatch = rawError.match(/Error\(Contract, Code\((\d+)\)\)/);
    if (contractErrorCodeMatch) {
      const code = parseInt(contractErrorCodeMatch[1], 10);
      const mapped = CONTRACT_ERROR_MAP[code];
      if (mapped) {
        return new AppError(
          ErrorType.CONTRACT,
          mapped.code,
          mapped.message,
          mapped.remediation,
          { rawError }
        );
      }
    }

    return new AppError(
      ErrorType.RPC,
      ErrorCode.SIMULATION_FAILED,
      `Transaction simulation failed: ${rawError}`,
      { message: "The transaction would fail if submitted. Check your parameters.", action: "Review Inputs" },
      { rawError }
    );
  }

  // 3. Handle specific error messages from SDK
  if (err?.message?.includes("not found")) {
    if (err.message.includes("account")) {
      return new AppError(
        ErrorType.ACCOUNT_STATE,
        ErrorCode.ACCOUNT_NOT_FOUND,
        "Account not found on-chain",
        { message: "The provided account does not exist or has not been funded.", action: "Fund Account" }
      );
    }
  }

  // 4. Default Internal Error
  return new AppError(
    ErrorType.INTERNAL,
    ErrorCode.INTERNAL_ERROR,
    err.message || "An unexpected error occurred",
    { message: "Our team has been notified. Please try again later." },
    { stack: err.stack }
  );
}
