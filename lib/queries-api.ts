/**
 * Queries API service — GET /api/queries
 * Base URL: NEXT_PUBLIC_API_URL (e.g. http://localhost:8000)
 */

const getApiBase = () =>
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface ApiQuery {
  id: number;
  driverId: string;
  language: string;
  intent: string;
  confidence: string;
  failureReason: string;
  riskTag: string;
  action: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface QueriesSuccessResponse {
  success: true;
  data: ApiQuery[];
}

export interface QueriesErrorResponse {
  success: false;
  error: { message: string };
}

export type QueriesApiResponse = QueriesSuccessResponse | QueriesErrorResponse;

export class QueriesApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly body?: QueriesErrorResponse
  ) {
    super(message);
    this.name = "QueriesApiError";
  }
}

/**
 * Fetches queries from GET /api/queries, optionally filtered by driverId.
 * @param driverId - Optional. When provided, requests /api/queries?driverId=...
 * @returns List of API query items
 * @throws QueriesApiError on non-OK response or invalid response shape
 */
export async function fetchQueries(
  driverId?: string
): Promise<ApiQuery[]> {
  const base = getApiBase();
  const url = driverId
    ? `${base}/api/queries?driverId=${encodeURIComponent(driverId)}`
    : `${base}/api/queries`;

  const res = await fetch(url);
  let json: QueriesApiResponse;

  try {
    json = (await res.json()) as QueriesApiResponse;
  } catch {
    throw new QueriesApiError("Invalid JSON response", res.status);
  }

  if (!res.ok) {
    const message =
      json && "error" in json && json.error?.message
        ? json.error.message
        : `Request failed (${res.status})`;
    throw new QueriesApiError(message, res.status, json as QueriesErrorResponse);
  }

  if (
    !json ||
    !("success" in json) ||
    !json.success ||
    !Array.isArray((json as QueriesSuccessResponse).data)
  ) {
    throw new QueriesApiError("Invalid response format", res.status);
  }

  return (json as QueriesSuccessResponse).data;
}
