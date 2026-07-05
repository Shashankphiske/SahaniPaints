export const ROUTE_ACCESS_MAP: Record<string, string> = {
  "/": "dashboard",
  "/customers": "customers",
  "/projects": "projects",
  "/tasks": "tasks",
  "/settings": "settings",
  "/masters/brands": "brands",
  "/masters/products": "products",
  "/masters/interiors": "interiors",
  "/masters/sales-associate": "sales-associate",
  "/masters/colors": "colors",
  "/masters/site-colors": "site-colors",
  "/masters/areas": "site-colors",
  "/masters/labours": "labours",
  "/masters/contractors": "labours",
  "/masters/stores": "stores",
  "/labour-attendance": "labour-attendance",
  "/material-usage": "dashboard",
  "/payments": "dashboard",
  "/contractor-payments": "dashboard",
};

export function getAccessKeyForPath(path: string): string | undefined {
  if (ROUTE_ACCESS_MAP[path]) return ROUTE_ACCESS_MAP[path];
  const match = Object.keys(ROUTE_ACCESS_MAP)
    .filter((p) => p !== "/" && path.startsWith(p))
    .sort((a, b) => b.length - a.length)[0];
  return match ? ROUTE_ACCESS_MAP[match] : undefined;
}
