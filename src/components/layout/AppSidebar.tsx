import {
  LayoutDashboard,
  Users,
  ListChecks,
  Settings,
  Package,
  ChevronDown,
  Star,
  Home,
  UserCheck,
  LogOut,
  Palette,
  Paintbrush,
  Hammer,
  ClipboardCheck,
  FolderOpen,
  Store,
  MapPin,
} from "lucide-react";
import { useLocation } from "react-router-dom";
import { NavLink } from "../NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useState } from "react";
import { LogoutDialog } from "@/components/auth/LogoutDialog";
import { useAuth } from "@/context/AuthContext";
import { getAccessKeyForPath } from "@/lib/access";
import { cn } from "@/lib/utils";

const mainItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Customers", url: "/customers", icon: Users },
  { title: "Projects", url: "/projects", icon: FolderOpen },
  { title: "Labour Attendance", url: "/labour-attendance", icon: ClipboardCheck },
];

const mastersItems = [
  { title: "Brands", url: "/masters/brands", icon: Star },
  { title: "Products", url: "/masters/products", icon: Package },
  { title: "Interiors", url: "/masters/interiors", icon: Home },
  { title: "Sales Associates", url: "/masters/sales-associate", icon: UserCheck },
  { title: "Colors", url: "/masters/colors", icon: Palette },
  { title: "Site Colors", url: "/masters/site-colors", icon: Paintbrush },
  { title: "Areas", url: "/masters/areas", icon: MapPin },
  { title: "Labours", url: "/masters/labours", icon: Hammer },
];

const bottomItems = [
  { title: "Tasks", url: "/tasks", icon: ListChecks },
  { title: "Stores", url: "/masters/stores", icon: Store },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const { user, hasAccess } = useAuth();

  const filterByAccess = <T extends { url: string }>(items: T[]) =>
    items.filter((i) => {
      const key = getAccessKeyForPath(i.url);
      return !key || hasAccess(key);
    });

  const visibleMain = filterByAccess(mainItems);
  const visibleMasters = filterByAccess(mastersItems);
  const visibleBottom = filterByAccess(bottomItems);

  const isMastersActive = visibleMasters.some((i) =>
    location.pathname.startsWith(i.url)
  );

  const navItemClass = cn(
    "hover:bg-sidebar-accent",
    collapsed && "justify-center"
  );

  const renderNavItem = (item: { title: string; url: string; icon: any }, end = true) => {
    return (
      <SidebarMenuButton asChild tooltip={collapsed ? item.title : undefined}>
        <NavLink
          to={item.url}
          end={end}
          className={navItemClass}
          activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
        >
          <item.icon className={cn("h-4 w-4", !collapsed && "mr-2")} />
          {!collapsed && <span>{item.title}</span>}
        </NavLink>
      </SidebarMenuButton>
    );
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className={cn("border-b border-sidebar-border no-scrollbar", collapsed ? "p-2 flex items-center justify-center" : "p-4")}>
        <span className="text-lg font-bold text-sidebar-foreground">
          {collapsed ? "SP" : "Sahani Paints"}
        </span>
      </SidebarHeader>

      <SidebarContent>
        {/* Main nav */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMain.map((item) => (
                <SidebarMenuItem key={item.title}>
                  {renderNavItem(item, item.url === "/")}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Masters dropdown */}
        {visibleMasters.length > 0 && (
          <SidebarGroup>
            {collapsed ? (
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                          tooltip="Masters"
                          isActive={isMastersActive}
                          className="justify-center"
                        >
                          <Package className="h-4 w-4" />
                        </SidebarMenuButton>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="right" align="start" className="w-56">
                        <DropdownMenuLabel>Masters</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {visibleMasters.map((item) => (
                          <DropdownMenuItem key={item.title} asChild>
                            <NavLink
                              to={item.url}
                              end
                              className="flex items-center gap-2 cursor-pointer"
                              activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                            >
                              <item.icon className="h-4 w-4" />
                              <span>{item.title}</span>
                            </NavLink>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            ) : (
              <Collapsible defaultOpen={isMastersActive}>
                <CollapsibleTrigger className="group flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent no-scrollbar">
                  <Package className="h-4 w-4" />
                  <span className="flex-1 text-left">Masters</span>
                  <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu className="pl-4">
                      {visibleMasters.map((item) => (
                        <SidebarMenuItem key={item.title}>
                          {renderNavItem(item)}
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </Collapsible>
            )}
          </SidebarGroup>
        )}

        {/* Bottom items */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleBottom.map((item) => (
                <SidebarMenuItem key={item.title}>
                  {renderNavItem(item)}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className={cn("border-t border-sidebar-border flex flex-col gap-2", collapsed ? "p-2" : "p-4")}>
        {!collapsed && user && (
          <div className="flex items-center gap-3 bg-sidebar-accent/50 p-2 rounded-lg overflow-hidden">
            <div className="h-8 w-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold text-xs shrink-0">
              {user.username?.substring(0, 2).toUpperCase() || "US"}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate leading-none mb-1 text-sidebar-foreground">
                {user.username}
              </p>
              <p className="text-[10px] text-muted-foreground truncate leading-none">
                {user.role}
              </p>
            </div>
          </div>
        )}
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setLogoutOpen(true)}
                className={cn(
                  "flex w-full items-center rounded-md py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent",
                  collapsed ? "justify-center px-2" : "gap-2 px-3"
                )}
              >
                <LogOut className="h-4 w-4 shrink-0" />
                {!collapsed && <span>Logout</span>}
              </button>
            </TooltipTrigger>
            {collapsed && <TooltipContent side="right">Logout</TooltipContent>}
          </Tooltip>
        </TooltipProvider>
      </SidebarFooter>
      <LogoutDialog open={logoutOpen} onOpenChange={setLogoutOpen} />
    </Sidebar>
  );
}
