import { useState, useEffect, useRef, useMemo } from "react";
import { useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { apiRequest } from "../lib/api";
import { getResourceChannel, broadcast } from "../lib/realtime";
import type { BroadcastPayload } from "../lib/realtime";
import { toast } from "./use-toast";

function hasFieldChanged(newVal: any, oldVal: any): boolean {
  if ((newVal === null || newVal === undefined || newVal === "") &&
      (oldVal === null || oldVal === undefined || oldVal === "")) {
    return false;
  }
  if (typeof newVal === "object" || typeof oldVal === "object") {
    if (!newVal || !oldVal) return true;
    return JSON.stringify(newVal) !== JSON.stringify(oldVal);
  }
  return newVal != oldVal;
}

type Reconstructor = (sent: any, res: any) => Record<string, any>;

const META_RECONSTRUCTORS: Record<string, Reconstructor[]> = {
  projects: [
    (sent) => {
      if (!sent.customerId || !sent._customerName) return {};
      return { customer: { id: sent.customerId, name: sent._customerName } };
    },
  ],
  products: [
    (sent) => {
      if (!sent.brandId || !sent._brandName) return {};
      return { brand: { id: sent.brandId, name: sent._brandName } };
    },
  ],
};

function applyMetaReconstructors(
  base: any,
  sent: any,
  res: any,
  resource: string
): any {
  const fns = [
    ...(META_RECONSTRUCTORS["*"] ?? []),
    ...(META_RECONSTRUCTORS[resource] ?? []),
  ];

  const extra = fns.reduce((acc, fn) => ({ ...acc, ...fn(sent, res) }), {});

  const responseExtras: Record<string, any> = {};
  if (res) {
    for (const [k, v] of Object.entries(res)) {
      if (
        !k.startsWith("_") &&
        v !== null &&
        typeof v === "object" &&
        !Array.isArray(v) &&
        !(k in sent)
      ) {
        responseExtras[k] = v;
      }
    }
  }

  return Object.fromEntries(
    Object.entries({ ...base, ...responseExtras, ...extra })
      .filter(([k]) => !k.startsWith("_"))
  );
}

function matchesFilters(item: any, filters: Record<string, any> | undefined): boolean {
  if (!filters) return true;
  for (const [k, v] of Object.entries(filters)) {
    if (
      k === "lastId" ||
      k === "lastCreatedAt" ||
      k === "search" ||
      k === "limit" ||
      k === "sort"
    ) {
      continue;
    }
    if (v != null && v !== "") {
      if (String(item[k]) !== String(v)) {
        return false;
      }
    }
  }
  return true;
}

export function useMasterData<T extends { id: string | number }>(
  resource: string,
  enabled: boolean = true,
  searchParams?: Record<string, any>,
  _paginated: boolean = false
) {
  const queryClient = useQueryClient();

  const [activeSearch, setActiveSearch] = useState<string>("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const effectiveParams = useMemo(() => {
    const params: Record<string, any> = {};

    if (searchParams) {
      Object.entries(searchParams).forEach(([k, v]) => {
        if (v != null) params[k] = v;
      });
    }

    if (activeSearch) params.search = activeSearch;

    Object.entries(activeFilters).forEach(([k, v]) => {
      if (v) params[k] = v;
    });

    return Object.keys(params).length > 0 ? params : undefined;
  }, [
    JSON.stringify(searchParams),
    activeSearch,
    JSON.stringify(activeFilters),
  ]);

  const infiniteQueryKey = [`${resource}_infinite`, effectiveParams];

  const infiniteQuery = useInfiniteQuery({
    queryKey: infiniteQueryKey,
    queryFn: async ({ pageParam }) => {
      const result = await apiRequest.fetchPaginated<T>(
        resource,
        pageParam as any,
        effectiveParams
      );
      return result;
    },
    initialPageParam: null,
    getNextPageParam: (lastPage: any) => lastPage?.nextCursor ?? null,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    enabled: !!enabled,
  });

  const data: T[] = useMemo(() => {
    return infiniteQuery.data?.pages.flatMap(
      (p: any) => p.records ?? []
    ) ?? [];
  }, [infiniteQuery.data?.pages]);

  const triggerSearch = (term: string, localHits: T[]) => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!term) { setActiveSearch(""); return; }
    if (localHits.length > 0) { setActiveSearch(""); return; }
    searchDebounceRef.current = setTimeout(() => setActiveSearch(term), 700);
  };

  const forceServerSearch = (term: string, filters?: Record<string, string>) => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    setActiveSearch(term || "");
    if (filters !== undefined) setActiveFilters(filters);
  };

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

  const prependToAllCaches = (newItem: T) => {
    console.log("prependToAllCaches called for resource:", resource, "item:", newItem);
    const queries = queryClient.getQueriesData<any>({ queryKey: [`${resource}_infinite`] });
    console.log("prependToAllCaches matched queries:", queries.length, queries);
    queries.forEach(([queryKey]) => {
      const filters = queryKey[1] as Record<string, any> | undefined;
      const match = matchesFilters(newItem, filters);
      console.log("queryKey:", queryKey, "filters:", filters, "matches:", match);
      if (!match) return;

      queryClient.setQueryData<any>(queryKey, (old: any) => {
        console.log("setQueryData old cache state:", old);
        if (!old) {
          return {
            pages: [{ records: [newItem], nextCursor: null }],
            pageParams: [null]
          };
        }
        const pages = [...old.pages];
        const firstRecords = pages[0]?.records ?? [];
        if (firstRecords.some((item: T) => item.id === newItem.id)) {
          console.log("Item already exists in cache, skipping prepend.");
          return old;
        }
        pages[0] = { ...pages[0], records: [newItem, ...firstRecords] };
        const updatedCache = { ...old, pages };
        console.log("setQueryData new cache state:", updatedCache);
        return updatedCache;
      });
    });
  };

  const updateAllCaches = (updatedItem: Partial<T> & { id: string | number }) => {
    console.log("updateAllCaches called for resource:", resource, "item:", updatedItem);
    const queries = queryClient.getQueriesData<any>({ queryKey: [`${resource}_infinite`] });
    console.log("updateAllCaches matched queries:", queries.length, queries);
    queries.forEach(([queryKey]) => {
      const filters = queryKey[1] as Record<string, any> | undefined;
      
      queryClient.setQueryData<any>(queryKey, (old: any) => {
        console.log("updateAllCaches setQueryData old cache state:", old);
        if (!old) {
          const fullMerged = applyMetaReconstructors(
            updatedItem,
            updatedItem,
            undefined,
            resource
          ) as T;
          if (matchesFilters(fullMerged, filters)) {
            return {
              pages: [{ records: [fullMerged], nextCursor: null }],
              pageParams: [null]
            };
          }
          return old;
        }
        
        let found = false;
        old.pages.forEach((page: any) => {
          const records = page.records ?? [];
          if (records.some((r: any) => r.id === updatedItem.id)) {
            found = true;
          }
        });

        if (found) {
          const updated = {
            ...old,
            pages: old.pages.map((page: any) => {
              const records = page.records ?? [];
              const foundRecord = records.find((r: any) => r.id === updatedItem.id);
              if (!foundRecord) return page;

              const fullMerged = applyMetaReconstructors(
                { ...foundRecord, ...updatedItem },
                updatedItem,
                undefined,
                resource
              ) as T;

              if (!matchesFilters(fullMerged, filters)) {
                return {
                  ...page,
                  records: records.filter((r: any) => r.id !== updatedItem.id)
                };
              }

              return {
                ...page,
                records: records.map((r: any) => r.id === updatedItem.id ? fullMerged : r)
              };
            })
          };
          console.log("updateAllCaches matched & found, new cache state:", updated);
          return updated;
        } else {
          let fullRecord: any = null;
          for (const [, qData] of queries) {
            if (qData?.pages) {
              for (const page of qData.pages) {
                const foundRec = (page.records ?? []).find((r: any) => r.id === updatedItem.id);
                if (foundRec) {
                  fullRecord = foundRec;
                  break;
                }
              }
            }
            if (fullRecord) break;
          }

          const fullMerged = fullRecord 
            ? applyMetaReconstructors({ ...fullRecord, ...updatedItem }, updatedItem, undefined, resource)
            : updatedItem;

          if (matchesFilters(fullMerged, filters)) {
            const pages = [...old.pages];
            const firstRecords = pages[0]?.records ?? [];
            if (!firstRecords.some((item: T) => item.id === updatedItem.id)) {
              pages[0] = { ...pages[0], records: [fullMerged, ...firstRecords] };
              const updated = { ...old, pages };
              console.log("updateAllCaches not found but matches filters, prepended, new cache state:", updated);
              return updated;
            }
          }
        }
        return old;
      });
    });
  };

  const deleteAllCaches = (deletedId: string | number) => {
    console.log("deleteAllCaches called for resource:", resource, "id:", deletedId);
    const queries = queryClient.getQueriesData<any>({ queryKey: [`${resource}_infinite`] });
    console.log("deleteAllCaches matched queries:", queries.length, queries);
    queries.forEach(([queryKey]) => {
      queryClient.setQueryData<any>(queryKey, (old: any) => {
        console.log("deleteAllCaches setQueryData old cache state:", old);
        if (!old) return old;
        const updated = {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            records: (page.records ?? []).filter((item: T) => item.id !== deletedId)
          }))
        };
        console.log("deleteAllCaches new cache state:", updated);
        return updated;
      });
    });
  };

  const applyBroadcast = (payload: BroadcastPayload<T>) => {
    if (resource === "authorizations") {
      const authData = payload.data as any;
      if (authData && authData.userId) {
        updateAuthorizationsCache(authData.userId, authData.access || []);
      }
      return;
    }
    switch (payload.action) {
      case "CREATE":
        prependToAllCaches(payload.data);
        break;
      case "UPDATE":
        updateAllCaches(payload.data as any);
        break;
      case "DELETE":
        deleteAllCaches((payload.data as any).id);
        break;
    }
  };

  useEffect(() => {
    const channel = getResourceChannel(resource);
    channel
      .on("broadcast", { event: "sync" }, ({ payload }: any) => {
        const p = payload as BroadcastPayload<T>;
        if (p.resource === resource) applyBroadcast(p);
      })
      .subscribe();
    return () => { };
  }, [resource, enabled]);

  const updateAuthorizationsCache = (userId: string, accessList: string[]) => {
    const queries = queryClient.getQueriesData<any>({ queryKey: ["authorizations_infinite"] });
    queries.forEach(([queryKey]) => {
      queryClient.setQueryData<any>(queryKey, (old: any) => {
        if (!old) return old;
        const updatedPages = old.pages.map((page: any) => {
          const records = page.records ?? [];
          return {
            ...page,
            records: records.filter((r: any) => r.userId !== userId)
          };
        });
        const newRecords = accessList.map((accessKey) => ({
          id: `temp-${userId}-${accessKey}-${Math.random().toString(36).substring(2, 9)}`,
          userId,
          access: accessKey
        }));
        if (updatedPages.length > 0) {
          updatedPages[0] = {
            ...updatedPages[0],
            records: [...newRecords, ...(updatedPages[0].records ?? [])]
          };
        }
        return {
          ...old,
          pages: updatedPages
        };
      });
    });
  };

  const createMutation = useMutation({
    mutationFn: (data: Partial<T>) => apiRequest.create<T>(resource, data),
    onSuccess: (response, sentData) => {
      const res = response as any;
      const sent = sentData as any;
      
      const handleSingleItem = (singleRes: any, singleSent: any) => {
        const merged = applyMetaReconstructors({ ...singleSent, ...singleRes }, singleSent, singleRes, resource);
        const newItem = merged as T;
        if (resource === "authorizations") {
          updateAuthorizationsCache(singleSent.userId, singleSent.access || []);
          broadcast(resource, { action: "CREATE", resource, data: { userId: singleSent.userId, access: singleSent.access || [] } });
          return;
        }
        prependToAllCaches(newItem);
        broadcast(resource, { action: "CREATE", resource, data: newItem });
      };

      if (Array.isArray(res)) {
        res.forEach((item) => {
          const correspondingSent = { ...sent };
          handleSingleItem(item, correspondingSent);
        });
      } else {
        handleSingleItem(res, sent);
      }
    },
    onError: (error: any) => {
      console.error(`Error creating ${resource}:`, error);
      toast({
        title: `Failed to create ${resource.slice(0, -1) || resource}`,
        description: error.message || "Something went wrong.",
        variant: "destructive"
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string | number; data: Partial<T> }) =>
      apiRequest.update<T>(resource, id, data),
    onSuccess: (response, variables) => {
      const sent = variables.data as any;
      
      if (resource === "authorizations") {
        updateAuthorizationsCache(sent.userId, sent.access || []);
        broadcast(resource, { action: "UPDATE", resource, data: { userId: sent.userId, access: sent.access || [] } });
        return;
      }

      updateAllCaches({ id: variables.id, ...sent });
      
      const broadcastData = Object.fromEntries(
        Object.entries({ id: variables.id, ...sent }).filter(
          ([k]) => !k.startsWith("_")
        )
      );
      broadcast(resource, { action: "UPDATE", resource, data: broadcastData });
    },
    onError: (error: any) => {
      console.error(`Error updating ${resource}:`, error);
      toast({
        title: `Failed to update ${resource.slice(0, -1) || resource}`,
        description: error.message || "Something went wrong.",
        variant: "destructive"
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string | number) => apiRequest.delete(resource, id),
    onSuccess: (_, deletedId) => {
      if (resource === "authorizations") {
        broadcast(resource, { action: "DELETE", resource, data: { id: deletedId } });
        return;
      }

      deleteAllCaches(deletedId);
      broadcast(resource, { action: "DELETE", resource, data: { id: deletedId } });
    },
    onError: (error: any) => {
      console.error(`Error deleting ${resource}:`, error);
      toast({
        title: `Failed to delete ${resource.slice(0, -1) || resource}`,
        description: error.message || "Something went wrong.",
        variant: "destructive"
      });
    }
  });

  const isMutating =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending;

  const create = (variables: Partial<T>, options?: Parameters<typeof createMutation.mutate>[1]) => {
    createMutation.mutate(variables as any, options);
  };

  const createAsync = async (variables: Partial<T>, options?: Parameters<typeof createMutation.mutateAsync>[1]) => {
    return await createMutation.mutateAsync(variables as any, options);
  };

  const update = (
    variables: { id: string | number; data: Partial<T> },
    options?: Parameters<typeof updateMutation.mutate>[1]
  ) => {
    const existing = data.find((item) => String(item.id) === String(variables.id));
    if (existing) {
      let hasChanges = false;
      for (const [key, val] of Object.entries(variables.data)) {
        if (key.startsWith("_")) continue;
        const existingVal = (existing as any)[key];
        if (hasFieldChanged(val, existingVal)) {
          hasChanges = true;
          break;
        }
      }
      if (!hasChanges) {
        console.log(`No changes detected for ${resource} ID ${variables.id}. Skipping update.`);
        return;
      }
    }
    updateMutation.mutate(variables as any, options);
  };

  const updateAsync = async (
    variables: { id: string | number; data: Partial<T> },
    options?: Parameters<typeof updateMutation.mutateAsync>[1]
  ) => {
    const existing = data.find((item) => String(item.id) === String(variables.id));
    if (existing) {
      let hasChanges = false;
      for (const [key, val] of Object.entries(variables.data)) {
        if (key.startsWith("_")) continue;
        const existingVal = (existing as any)[key];
        if (hasFieldChanged(val, existingVal)) {
          hasChanges = true;
          break;
        }
      }
      if (!hasChanges) {
        console.log(`No changes detected for ${resource} ID ${variables.id}. Skipping update.`);
        return existing;
      }
    }
    return await updateMutation.mutateAsync(variables as any, options);
  };

  const remove = (id: string | number, options?: Parameters<typeof deleteMutation.mutate>[1]) => {
    deleteMutation.mutate(id, options);
  };

  const removeAsync = async (id: string | number, options?: Parameters<typeof deleteMutation.mutateAsync>[1]) => {
    return await deleteMutation.mutateAsync(id, options);
  };

  return {
    data,
    isLoading: infiniteQuery.isLoading,
    isFetchingNextPage: infiniteQuery.isFetchingNextPage,
    hasNextPage: infiniteQuery.hasNextPage,
    fetchNextPage: infiniteQuery.fetchNextPage,
    triggerSearch,
    forceServerSearch,
    isServerSearching: infiniteQuery.isFetching && !infiniteQuery.isFetchingNextPage,
    create,
    createAsync,
    update,
    updateAsync,
    remove,
    removeAsync,
    isMutating
  };
}
