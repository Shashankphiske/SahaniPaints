import { getCookie } from "./cookies";

const BASE_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? "http://localhost:4000/v1"
  : "https://sahanipaintsbackend.onrender.com/v1";

function getFriendlyErrorMessage(msg: string): string {
  if (!msg) return "An unexpected error occurred. Please try again.";
  const lowerMsg = msg.toLowerCase();

  if (
    lowerMsg.includes("unique constraint failed") ||
    lowerMsg.includes("already exists") ||
    lowerMsg.includes("p2002") ||
    lowerMsg.includes("duplicate key value")
  ) {
    const fieldsMatch = msg.match(/fields:\s*\((.*?)\)/i) || msg.match(/key\s*\((.*?)\)=/i);
    if (fieldsMatch && fieldsMatch[1]) {
      const fields = fieldsMatch[1]
        .replace(/[`"()]/g, "")
        .split(",")
        .map(f => f.trim())
        .join(" & ");
      return `An entry with this ${fields} already exists. Please choose a different one.`;
    }
    return "This record already exists. Please choose a unique value.";
  }

  if (
    lowerMsg.includes("foreign key constraint") ||
    lowerMsg.includes("p2003") ||
    lowerMsg.includes("violates foreign key") ||
    lowerMsg.includes("reference constraint")
  ) {
    if (lowerMsg.includes("delete")) {
      return "Cannot delete this record because it is being used by other parts of the system.";
    }
    return "Failed to link records. Please ensure all selections exist and are correct.";
  }

  if (
    lowerMsg.includes("violates not-null constraint") ||
    lowerMsg.includes("p2011") ||
    lowerMsg.includes("cannot be null")
  ) {
    const colMatch = msg.match(/column\s*"(.*?)"/i);
    if (colMatch && colMatch[1]) return `The field "${colMatch[1]}" is required. Please fill it in.`;
    return "Please fill in all required fields.";
  }

  if (
    lowerMsg.includes("record to update not found") ||
    lowerMsg.includes("p2025") ||
    lowerMsg.includes("not found")
  ) {
    return "The requested record was not found or has already been deleted.";
  }

  if (
    lowerMsg.includes("failed to fetch") ||
    lowerMsg.includes("network error") ||
    lowerMsg.includes("unable to connect")
  ) {
    return "Network connection issue. Please check your internet connection and try again.";
  }

  if (lowerMsg.includes("prisma") || lowerMsg.includes("postgres") || lowerMsg.includes("database")) {
    return "A database error occurred. Please check your inputs and try again.";
  }

  return msg;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

export const apiRequest = {
  async execute<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    const token = getCookie("accessToken");

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
      credentials: "include",
    });

    const rawData = await res.json();
    console.log(rawData.message);
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem("auth_state");
        document.cookie = "accessToken=; Max-Age=0; path=/;";
        document.cookie = "refreshToken=; Max-Age=0; path=/;";
        if (!window.location.pathname.startsWith("/login")) {
          window.location.href = "/login";
        }
      }
      throw new ApiError(getFriendlyErrorMessage(rawData?.message || rawData?.error || `Request failed with status ${res.status}`), res.status);
    }
    return rawData.data?.records ? rawData.data.records : rawData.data;
  },
  fetchPaginated: async <T>(
    resource: string,
    cursor?: { lastId: string; lastCreatedAt: string } | null,
    params?: Record<string, any>
  ): Promise<{ records: T[]; nextCursor: { lastId: string; lastCreatedAt: string } | null }> => {
    const query: Record<string, any> = { ...params };
    if (cursor?.lastId) query.lastId = cursor.lastId;
    if (cursor?.lastCreatedAt) query.lastCreatedAt = cursor.lastCreatedAt;

    const queryString = new URLSearchParams(query).toString();
    const endpoint = queryString ? `/${resource}?${queryString}` : `/${resource}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const token = getCookie("accessToken");
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${BASE_URL}${endpoint}`, {
      headers,
      credentials: "include",
    });

    const rawData = await res.json();
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem("auth_state");
        document.cookie = "accessToken=; Max-Age=0; path=/;";
        document.cookie = "refreshToken=; Max-Age=0; path=/;";
        if (!window.location.pathname.startsWith("/login")) {
          window.location.href = "/login";
        }
      }
      throw new ApiError(getFriendlyErrorMessage(rawData?.message || rawData?.error || `Request failed with status ${res.status}`), res.status);
    }

    return {
      records: rawData.data?.records ?? [],
      nextCursor: rawData.data?.nextCursor ?? null,
    };
  },

  fetchAll: <T>(resource: string, params?: Record<string, any>) => {
    const queryString = params
      ? new URLSearchParams(params).toString()
      : "";

    const endpoint = queryString
      ? `/${resource}?${queryString}`
      : `/${resource}`;

    return apiRequest.execute<T[]>(endpoint);
  },

  create: <T>(resource: string, data: Partial<T>) => {
    const cleanData = Object.fromEntries(
      Object.entries(data as any).filter(([key]) => !key.startsWith("_") || key === "_")
    );
    return apiRequest.execute<T>(`/${resource}`, {
      method: "POST",
      body: JSON.stringify(cleanData),
    });
  },

  bulkCreate: <T>(resource: string, data: Partial<T>[]) => {
    const cleanData = data.map(row => 
      Object.fromEntries(
        Object.entries(row as any).filter(([key]) => !key.startsWith("_") || key === "_")
      )
    );
    return apiRequest.execute<T[]>(`/${resource}/bulk`, {
      method: "POST",
      body: JSON.stringify(cleanData),
    });
  },

  update: <T>(resource: string, id: string | number, data: Partial<T>) => {
    const cleanData = Object.fromEntries(
      Object.entries(data as any).filter(([key]) => !key.startsWith("_") || key === "_")
    );
    const method = resource === "users" ? "PUT" : "PATCH";
    return apiRequest.execute<T>(`/${resource}/${id}`, {
      method,
      body: JSON.stringify(cleanData),
    });
  },

  delete: (resource: string, id: string | number) =>
    apiRequest.execute(`/${resource}/${id}`, {
      method: "DELETE",
    }),
};
