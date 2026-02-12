export type Role = "PUBLIC" | "USER" | "ADMIN" | "EDITOR";

export type RouteAccess = {
  path: string;
  roles: Role[];
};

export const PUBLIC_ROLE: Role = "PUBLIC";

// Role access for every page route (paths without locale prefixes).
export const pageAccess: RouteAccess[] = [
  { path: "/", roles: ["PUBLIC"] },
  { path: "/login", roles: ["PUBLIC"] },
  { path: "/register", roles: ["PUBLIC"] },
  { path: "/verify-email", roles: ["PUBLIC"] },
  { path: "/reset-password", roles: ["PUBLIC"] },
  { path: "/logout", roles: ["PUBLIC"] },
  { path: "/access-denied", roles: ["PUBLIC"] },
  { path: "/dashboard", roles: ["USER", "ADMIN", "EDITOR"] },
  { path: "/profile", roles: ["USER", "ADMIN", "EDITOR"] },
  { path: "/nodes", roles: ["USER", "ADMIN", "EDITOR"] },
  { path: "/servers", roles: ["USER", "ADMIN", "EDITOR"] },
];

export const protectedRoutes = pageAccess.filter(
  (route) => !route.roles.includes(PUBLIC_ROLE),
);
