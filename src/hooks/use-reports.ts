import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

export type ReportType = "projects" | "payments" | "interiors" | "products";

export interface ReportFilter {
  startDate?: string;
  endDate?: string;
}

export function useReportData<T = any>(type: ReportType, filter?: ReportFilter, enabled = true) {
  const queryKey = ["reports", type, filter?.startDate ?? "", filter?.endDate ?? ""];

  return useQuery<T>({
    queryKey,
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filter?.startDate) params.startDate = filter.startDate;
      if (filter?.endDate) params.endDate = filter.endDate;

      const data = await apiRequest.fetchAll(`reports/${type}`, params);
      return data as T;
    },
    enabled: enabled && !!type,
    staleTime: 5 * 60 * 1000, // 5 minutes cache stale time
    gcTime: 15 * 60 * 1000,    // Keep unused cache in memory for 15 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}
