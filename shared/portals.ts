/**
 * Portal Routing Configuration
 * Defines which roles belong to which portals and their navigation structures
 */

export type Role =
  | "parent"
  | "student"
  | "tutor"
  | "td"
  | "affiliate"
  | "od"
  | "coo"
  | "hr"
  | "ceo"
  | "cto"
  | "cmo";

export type Portal = "client" | "affiliate" | "operational" | "executive";

// Portal definitions with their roles and routes
export const PORTAL_CONFIG: Record<
  Portal,
  {
    roles: Role[];
    isPublic: boolean;
    description: string;
    dashboardRoute: string;
  }
> = {
  client: {
    roles: ["parent", "student"],
    isPublic: true,
    description: "Client Portal - Parent & Student Interface",
    dashboardRoute: "/client/parent/dashboard",
  },
  affiliate: {
    roles: ["affiliate", "od"],
    isPublic: true,
    description: "Affiliate Portal - Affiliate & Outreach Director Interface",
    dashboardRoute: "/affiliate/gateway",
  },
  operational: {
    roles: ["tutor", "td"],
    isPublic: true,
    description: "Operational Portal - Tutor & Territory Director Interface",
    dashboardRoute: "/operational/tutor/gateway",
  },
  executive: {
    roles: ["coo", "hr", "ceo", "cto", "cmo"],
    isPublic: false,
    description: "Executive Portal - Core executive command interface",
    dashboardRoute: "/executive/gateway",
  },
};

// Role-to-Portal mapping for quick lookup
export const ROLE_TO_PORTAL: Record<Role, Portal> = {
  parent: "client",
  student: "client",
  affiliate: "affiliate",
  od: "affiliate",
  tutor: "operational",
  td: "operational",
  coo: "executive",
  hr: "executive",
  ceo: "executive",
  cto: "executive",
  cmo: "executive",
};

// Navigation structure for each role
export const ROLE_NAVIGATION: Record<
  Role,
  Array<{ label: string; path: string; icon?: string }>
> = {
  // Client Portal - Parent
  parent: [
    { label: "Dashboard", path: "/client/parent/dashboard" },
    { label: "Sessions", path: "/client/parent/sessions" },
    { label: "Progress", path: "/client/parent/progress" },
    { label: "Updates", path: "/client/parent/updates" },
  ],

  // Client Portal - Student
  student: [
    { label: "Dashboard", path: "/client/student/dashboard" },
    { label: "Growth", path: "/client/student/growth" },
    { label: "Academic Tracker", path: "/client/student/academic-tracker" },
    { label: "Assignments", path: "/client/student/assignments" },
    { label: "Updates", path: "/client/student/updates" },
  ],

  // Affiliate Portal - Affiliate
  affiliate: [
    { label: "Home", path: "/affiliate/affiliate/home" },
    { label: "Disc & Deli", path: "/affiliate/affiliate/discover-deliver" },
    { label: "Tracking", path: "/affiliate/affiliate/tracking" },
    { label: "Updates", path: "/affiliate/affiliate/updates" },
  ],

  // Affiliate Portal - Outreach Director
  od: [
    { label: "Dashboard", path: "/affiliate/od/dashboard" },
    { label: "Tracking", path: "/affiliate/od/encounters" },
    { label: "Crews", path: "/affiliate/od/crews" },
    { label: "Affiliates", path: "/affiliate/od/affiliates" },
    { label: "Updates", path: "/affiliate/od/updates" },
  ],

  // Operational Portal - Tutor
  tutor: [
    { label: "My Pod", path: "/operational/tutor/my-pod" },
    { label: "Growth", path: "/operational/tutor/growth" },
    { label: "Academic Tracker", path: "/operational/tutor/academic-tracker" },
    { label: "Sessions", path: "/operational/tutor/sessions" },
    { label: "Updates", path: "/operational/tutor/updates" },
  ],

  // Operational Portal - Territory Director
  td: [
    { label: "Dashboard", path: "/operational/td/dashboard" },
    { label: "My Pods", path: "/operational/td/my-pods" },
    { label: "Reports", path: "/operational/td/reports" },
    { label: "Updates", path: "/operational/td/updates" },
  ],

  // Executive Portal - COO
  coo: [
    { label: "Gateway", path: "/executive/gateway" },
    { label: "Dashboard", path: "/executive/coo/dashboard" },
    { label: "Traffic", path: "/executive/coo/traffic" },
    { label: "Pods", path: "/executive/coo/pods" },
    { label: "Brain", path: "/executive/coo/brain" },
    { label: "Broadcast", path: "/executive/coo/broadcast" },
  ],

  // Executive Portal - HR
  hr: [
    { label: "Dashboard", path: "/executive/hr/dashboard" },
    { label: "Brain", path: "/executive/hr/brain" },
    { label: "Disputes", path: "/executive/hr/disputes" },
    { label: "Updates", path: "/executive/hr/updates" },
  ],

  // Executive Portal - CEO
  ceo: [
    { label: "Dashboard", path: "/executive/ceo/dashboard" },
    { label: "Brain", path: "/executive/ceo/board" },
  ],
  cto: [
    { label: "Gateway", path: "/executive/gateway" },
    { label: "Dashboard", path: "/executive/cto/dashboard" },
  ],
  cmo: [
    { label: "Gateway", path: "/executive/gateway" },
    { label: "Dashboard", path: "/executive/cmo/dashboard" },
  ],
};

// Public roles (can sign up without invitation)
export const PUBLIC_ROLES: Role[] = ["parent", "tutor", "affiliate"];

// Roles that require invitation/admin assignment
export const ADMIN_ASSIGNED_ROLES: Role[] = ["student", "td", "od", "coo", "hr", "ceo", "cto", "cmo"];

/**
 * Get the portal for a given role
 */
export function getPortalForRole(role: Role): Portal {
  return ROLE_TO_PORTAL[role];
}

/**
 * Get all roles for a given portal
 */
export function getRolesForPortal(portal: Portal): Role[] {
  return PORTAL_CONFIG[portal].roles;
}

/**
 * Check if a role can access a portal
 */
export function canAccessPortal(role: Role, portal: Portal): boolean {
  return PORTAL_CONFIG[portal].roles.includes(role);
}

/**
 * Check if a portal is publicly accessible
 */
export function isPortalPublic(portal: Portal): boolean {
  return PORTAL_CONFIG[portal].isPublic;
}

/**
 * Get the default dashboard route for a role
 */
export function getDefaultDashboardRoute(role: Role | undefined | null): string {
  if (!role) {
    console.warn("⚠️  No role provided to getDefaultDashboardRoute, defaulting to tutor");
    return "/operational/tutor/gateway";
  }

  // Role-specific routes
  const roleSpecificRoutes: Record<Role, string> = {
    parent: "/client/parent/gateway", // Parents go to gateway first, not dashboard
    student: "/client/student/dashboard",
    affiliate: "/affiliate/gateway",
    od: "/affiliate/od/dashboard",
    tutor: "/operational/tutor/gateway", // Tutors go to gateway first
    td: "/operational/td/gateway",
    coo: "/executive/gateway",
    hr: "/executive/gateway",
    ceo: "/executive/ceo/board",
    cto: "/executive/gateway",
    cmo: "/executive/gateway",
  };
  
  const route = roleSpecificRoutes[role];
  if (!route) {
    console.warn("⚠️  Unknown role:", role, "- defaulting to tutor");
    return "/operational/tutor/gateway";
  }
  
  return route;
}

/**
 * Get all navigation items for a role
 */
export function getNavigationForRole(role: Role): (typeof ROLE_NAVIGATION)[Role] {
  return ROLE_NAVIGATION[role];
}
