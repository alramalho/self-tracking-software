import logger from "./logger";

interface ErrorHandlingOptions<T> {
  fallback: T;
  errorMsg: string;
}

/**
 * Wraps an async function with error handling
 * Logs errors and returns a fallback value on failure
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  options: ErrorHandlingOptions<T>
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    logger.error(`${options.errorMsg}:`, error);
    return options.fallback;
  }
}
