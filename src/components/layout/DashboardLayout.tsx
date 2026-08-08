import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { GlobalSearchBar } from "./GlobalSearchBar";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-3 border-b border-border px-4 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-40">
            <SidebarTrigger />
            <div className="flex-1 flex items-center justify-center max-w-xl mx-auto">
              <GlobalSearchBar />
            </div>
          </header>
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
