import { format, parse, differenceInMinutes, addDays } from "date-fns";

/**
 * Format date to YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/**
 * Format time to HH:mm
 */
export function formatTime(date: Date): string {
  return format(date, "HH:mm");
}

/**
 * Parse time string to minutes from midnight
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Convert minutes from midnight to time string
 */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

/**
 * Calculate delay in minutes between scheduled and actual time
 */
export function calculateDelay(scheduled: Date, actual: Date): number {
  return differenceInMinutes(actual, scheduled);
}

/**
 * Calculate journey duration from departure and arrival times
 */
export function calculateDuration(
  departureTime: string,
  arrivalTime: string,
  dayOffset: number = 0
): string {
  const depMinutes = timeToMinutes(departureTime);
  let arrMinutes = timeToMinutes(arrivalTime);

  // Add day offset
  arrMinutes += dayOffset * 24 * 60;

  const totalMinutes = arrMinutes - depMinutes;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${minutes}m`;
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Validate PNR number (10 digit number)
 */
export function isValidPNR(pnr: string): boolean {
  return /^\d{10}$/.test(pnr);
}

/**
 * Validate train number (4-5 digit number)
 */
export function isValidTrainNumber(trainNumber: string): boolean {
  return /^\d{4,5}$/.test(trainNumber);
}

/**
 * Validate station code (2-5 uppercase letters)
 */
export function isValidStationCode(code: string): boolean {
  return /^[A-Z]{2,5}$/.test(code.toUpperCase());
}

/**
 * Parse station code to uppercase
 */
export function normalizeStationCode(code: string): string {
  return code.toUpperCase().trim();
}

/**
 * Calculate percentage of journey completed
 */
export function calculateJourneyProgress(
  totalDistance: number,
  distanceCovered: number
): number {
  if (totalDistance <= 0) return 0;
  return Math.min(Math.round((distanceCovered / totalDistance) * 100), 100);
}

/**
 * Get delay status text based on delay minutes
 */
export function getDelayStatus(delayMinutes: number): {
  status: "on_time" | "slight_delay" | "delayed" | "heavily_delayed";
  color: string;
  text: string;
} {
  if (delayMinutes <= 0) {
    return { status: "on_time", color: "#10B981", text: "On Time" };
  } else if (delayMinutes <= 15) {
    return { status: "slight_delay", color: "#F59E0B", text: `+${delayMinutes}m` };
  } else if (delayMinutes <= 60) {
    return { status: "delayed", color: "#F59E0B", text: `+${delayMinutes}m late` };
  } else {
    const hours = Math.floor(delayMinutes / 60);
    const mins = delayMinutes % 60;
    return {
      status: "heavily_delayed",
      color: "#EF4444",
      text: `+${hours}h ${mins}m late`,
    };
  }
}

/**
 * Paginate array
 */
export function paginate<T>(
  array: T[],
  page: number,
  limit: number
): { data: T[]; pagination: { page: number; limit: number; total: number; hasMore: boolean } } {
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const data = array.slice(startIndex, endIndex);

  return {
    data,
    pagination: {
      page,
      limit,
      total: array.length,
      hasMore: endIndex < array.length,
    },
  };
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        await sleep(baseDelay * Math.pow(2, i));
      }
    }
  }

  throw lastError;
}
