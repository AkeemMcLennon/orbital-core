/**
 * Suppress console output while executing a callback, optionally expecting an error
 *
 * Suppresses console.error and console.warn during the callback execution.
 * If errorType is provided, expects the callback to throw an error of that type.
 * If errorType is not provided, just suppresses console output without requiring an error.
 *
 * @param callback - Async function to execute with suppressed console
 * @param errorType - Optional expected Error type constructor. If provided, expects callback to throw it.
 * @returns The caught error of the expected type, or void if no error was expected
 * @throws AssertionError if error is expected but not thrown, or wrong type is thrown
 */
export async function expectError<T extends Error = Error>(
  callback: () => Promise<void>,
  errorType?: new (...args: any[]) => T
): Promise<T | void> {
  // Store original console methods
  const originalError = console.error;
  const originalWarn = console.warn;

  try {
    // Suppress console.error and console.warn
    console.error = () => {};
    console.warn = () => {};

    // Try to execute the callback
    try {
      await callback();
    } finally {
      // Restore console methods before throwing
      console.error = originalError;
      console.warn = originalWarn;
    }

    // If no error was expected, we're done
    if (!errorType) {
      return undefined;
    }

    // If error was expected but not thrown, that's an assertion error
    throw new Error(
      `Expected ${errorType.name} to be thrown, but no error was thrown`
    );
  } catch (error) {
    // Restore console methods (in case they weren't restored above)
    console.error = originalError;
    console.warn = originalWarn;

    // If no error type was expected, re-throw any error that occurred
    if (!errorType) {
      throw error;
    }

    // Check if the caught error is of the expected type
    if (error instanceof errorType) {
      return error as T;
    }

    // If the error is our assertion error about no error being thrown, re-throw it
    if (error instanceof Error && error.message.includes('Expected')) {
      throw error;
    }

    // Wrong error type was thrown
    throw new Error(
      `Expected ${errorType.name} to be thrown, but got ${error instanceof Error ? error.constructor.name : typeof error}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
