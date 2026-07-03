import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL || "https://placeholder.supabase.co",
    import.meta.env.VITE_SUPABASE_ANON_KEY || "placeholder-key"
);

export type BroadcastAction = "CREATE" | "UPDATE" | "DELETE";

export interface BroadcastPayload<T = any> {
    action: BroadcastAction;
    resource: string;
    data: T;
}

// One channel per resource — reused across all hook instances
const channelCache = new Map<string, ReturnType<typeof supabase.channel>>();

export function getResourceChannel(resource: string) {
    if (!channelCache.has(resource)) {
        const channel = supabase.channel(`room:${resource}`);
        channelCache.set(resource, channel);
    }
    return channelCache.get(resource)!;
}

export function broadcast<T>(resource: string, payload: BroadcastPayload<T>) {
    const channel = getResourceChannel(resource);
    channel.send({
        type: "broadcast",
        event: "sync",
        payload,
    });
}
