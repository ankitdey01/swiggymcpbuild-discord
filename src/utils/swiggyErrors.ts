export type SwiggyErrorCategory =
  | "AUTH_ERROR"
  | "RATE_LIMIT"
  | "NETWORK_FAILURE"
  | "VALIDATION_ERROR"
  | "UNKNOWN";

export interface ClassifiedError {
  category: SwiggyErrorCategory;
  message: string;
  userFriendlyMessage: string;
}

/**
 * Classify a Swiggy API error into a standard category
 * Follows the Swiggy canonical error taxonomy
 */
export function classifySwiggyError(error: any): ClassifiedError {
  if (!error) {
    return {
      category: "UNKNOWN",
      message: "Unknown error",
      userFriendlyMessage: "An unexpected error occurred. Please try again later.",
    };
  }

  const errorMessage = error?.message || error?.msg || String(error);
  const errorCode = error?.code || error?.status;

  // Auth errors
  if (
    errorCode === 401 ||
    errorMessage.toLowerCase().includes("unauthorized") ||
    errorMessage.toLowerCase().includes("invalid token") ||
    errorMessage.toLowerCase().includes("expired")
  ) {
    return {
      category: "AUTH_ERROR",
      message: errorMessage,
      userFriendlyMessage: "Your authentication has expired. Please use `/login` to re-authenticate.",
    };
  }

  // Rate limit errors
  if (
    errorCode === 429 ||
    errorMessage.toLowerCase().includes("rate limit") ||
    errorMessage.toLowerCase().includes("too many requests")
  ) {
    return {
      category: "RATE_LIMIT",
      message: errorMessage,
      userFriendlyMessage: "Too many requests. Please wait a moment and try again.",
    };
  }

  // Network errors
  if (
    errorCode === 502 ||
    errorCode === 503 ||
    errorCode === 504 ||
    errorMessage.toLowerCase().includes("network") ||
    errorMessage.toLowerCase().includes("timeout") ||
    errorMessage.toLowerCase().includes("connection") ||
    errorMessage.toLowerCase().includes("econnrefused")
  ) {
    return {
      category: "NETWORK_FAILURE",
      message: errorMessage,
      userFriendlyMessage: "Network error. Swiggy services may be temporarily unavailable. Please try again later.",
    };
  }

  // Validation errors
  if (
    errorCode === 400 ||
    errorMessage.toLowerCase().includes("invalid") ||
    errorMessage.toLowerCase().includes("validation") ||
    errorMessage.toLowerCase().includes("bad request")
  ) {
    return {
      category: "VALIDATION_ERROR",
      message: errorMessage,
      userFriendlyMessage: "Invalid request. Please check your input and try again.",
    };
  }

  // Default to unknown
  return {
    category: "UNKNOWN",
    message: errorMessage,
    userFriendlyMessage: "An unexpected error occurred. Please try again later.",
  };
}
