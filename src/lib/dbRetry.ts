/**
 * Database Resilience & Retry Helper for Neon Serverless PostgreSQL
 * 
 * Handles transient database disconnects, serverless auto-suspend cold-starts,
 * pooler timeouts, and socket drops gracefully with exponential backoff.
 */

const TRANSIENT_ERROR_CODES = new Set([
  "P1001", // Can't reach database server
  "P1002", // The database server was reached but timed out
  "P1017", // Server has closed the connection
  "P2024", // Timed out fetching a new connection from the connection pool
  "P2028", // Transaction API error: Transaction already closed
  "P2034", // Transaction failed due to a write conflict or a deadlock
]);

const TRANSIENT_MESSAGE_PATTERNS = [
  /connection closed/i,
  /connection terminated/i,
  /connection reset/i,
  /server has closed the connection/i,
  /can't reach database server/i,
  /timed out/i,
  /timeout/i,
  /econnreset/i,
  /etimedout/i,
  /prepared statement .* does not exist/i,
  /broken pipe/i,
  /database.*sleeping/i,
];

export function isTransientDbError(error: any): boolean {
  if (!error) return false;

  // Check Prisma error code
  if (error.code && TRANSIENT_ERROR_CODES.has(error.code)) {
    return true;
  }

  // Check error message
  const message = error.message || String(error);
  return TRANSIENT_MESSAGE_PATTERNS.some((pattern) => pattern.test(message));
}

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  operationName?: string;
}

export async function withDbRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const initialDelay = options.initialDelayMs ?? 600;
  const maxDelay = options.maxDelayMs ?? 4000;
  const name = options.operationName ?? "Database Operation";

  let attempt = 0;

  while (true) {
    try {
      return await operation();
    } catch (error: any) {
      attempt++;

      const isTransient = isTransientDbError(error);

      if (!isTransient || attempt > maxRetries) {
        if (isTransient) {
          console.error(
            `[DB Retry] ${name} gagal setelah ${attempt} percobaan karena kendala koneksi database serverless:`,
            error.message || error
          );
        }
        throw error;
      }

      // Calculate exponential backoff with jitter
      const exponentialDelay = initialDelay * Math.pow(2, attempt - 1);
      const jitter = Math.random() * 200;
      const delay = Math.min(exponentialDelay + jitter, maxDelay);

      console.warn(
        `[DB Retry] Terdeteksi koneksi Neon terputus/cold-start pada ${name}. Mencoba rekoneksi (Percobaan ${attempt}/${maxRetries}) dalam ${Math.round(delay)}ms... Error: ${error.message || error.code}`
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
