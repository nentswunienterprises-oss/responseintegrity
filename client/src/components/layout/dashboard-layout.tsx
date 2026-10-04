import { ReactNode, useState, useEffect, useMemo, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Home,
  Users,
  FolderKanban,
  FileCheck,
  Bell,
  TrendingUp,
  Calendar,
  MessageSquare,
  GraduationCap,
  Shield,
  BookOpen,
  Lightbulb,
} from "lucide-react";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { AccountMenu } from "./account-menu";
import { useAuth } from "@/hooks/useAuth";
import { isTutor, isTD, isCOO, isAffiliate, isOD, isParent, getRoleName, getRoleNameShort } from "@/lib/roles";
import { LogDisputeModal } from "@/components/LogDisputeModal";
import { ROLE_NAVIGATION } from "@shared/portals";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Pod, TutorAssignment, User } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { API_URL } from "@/lib/config";
import { getAuthMode } from "@/lib/authMode";
import { useToast } from "@/hooks/use-toast";
import type { NotificationItem } from "@/components/notifications/NotificationInbox";

interface NavItem {
  label: string;
  path: string;
  icon: ReactNode;
}

interface DashboardLayoutProps {
  children: ReactNode;
}

interface PodData {
  assignment: TutorAssignment & { pod: Pod };
  students: any[];
}

function getTutorTrafficDocumentsStatus(application: any) {
  return {
    "1": "pending_upload",
    "2": "not_started",
    "3": "not_started",
    "4": "not_started",
    "5": "not_started",
    "6": "not_started",
    ...(application?.documentsStatus || application?.documents_status || {}),
  } as Record<string, string>;
}

function isTutorTrafficFullyApproved(application: any) {
  const documentsStatus = getTutorTrafficDocumentsStatus(application);
  return Array.from({ length: 6 }, (_, index) => String(index + 1)).every(
    (step) => documentsStatus[step] === "approved"
  );
}

function hasTutorTrafficPendingReview(application: any) {
  const documentsStatus = getTutorTrafficDocumentsStatus(application);
  return ["2", "6"].some((step) => String(documentsStatus[step] || "") === "pending_review");
}

function hasTutorTrafficWaitingOnTutor(application: any) {
  if (isTutorTrafficFullyApproved(application)) return false;
  if (hasTutorTrafficPendingReview(application)) return false;

  const documentsStatus = getTutorTrafficDocumentsStatus(application);
  const hasDoc2Acceptance = Boolean((application?.onboardingCurrentAcceptanceMap ?? application?.onboardingAcceptanceMap)?.["2"]);
  const waitingForMatricUpload = hasDoc2Acceptance && String(documentsStatus["2"] || "") === "pending_upload";
  const waitingForIdUpload =
    ["1", "2", "3", "4", "5"].every((step) => String(documentsStatus[step] || "") === "approved") &&
    String(documentsStatus["6"] || "") === "pending_upload";

  if (waitingForMatricUpload || waitingForIdUpload) return true;
  return true;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();
  const [emergencyDbMode, setEmergencyDbMode] = useState(false);
  
  // Log Dispute Modal state
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  
  // Check for student authentication (separate system)
  const [studentUser, setStudentUser] = useState<any>(null);
  const [isStudentAuth, setIsStudentAuth] = useState(false);
  
  useEffect(() => {
    // Check if student is authenticated
    const checkStudentAuth = async () => {
      try {
        const response = await fetch(`${API_URL}/api/student/me`, { credentials: "include" });
        if (response.ok) {
          const data = await response.json();
          console.log("🎓 Student authenticated:", data);
          setStudentUser(data);
          setIsStudentAuth(true);
        }
      } catch (err) {
        // Not a student or not authenticated
      }
    };
    
    if (!user && !isAuthenticated) {
      checkStudentAuth();
    }
  }, [user, isAuthenticated]);

  useEffect(() => {
    let active = true;
    getAuthMode().then((mode) => {
      if (active) setEmergencyDbMode(mode.emergencyDbMode);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  
  // Use student user if available, otherwise use regular user
  const effectiveUser = isStudentAuth ? {
    ...studentUser,
    role: "student",
    name: `${studentUser?.firstName || ""} ${studentUser?.lastName || ""}`.trim(),
    email: studentUser?.email,
  } : user;
  
  const effectiveIsAuth = isAuthenticated || isStudentAuth;
  const { toast } = useToast();

  console.log("🎯 DashboardLayout render:");
  console.log("  isAuthenticated:", isAuthenticated);
  console.log("  isStudentAuth:", isStudentAuth);
  console.log("  user:", user);
  console.log("  studentUser:", studentUser);
  console.log("  effectiveUser:", effectiveUser);
  console.log("  effectiveUser.role:", effectiveUser?.role);
  console.log("  location.pathname:", location.pathname);

  // Fetch pod data for tutors - only when user is authenticated and is a tutor
  const { data: tutorPodData } = useQuery<PodData>({
    queryKey: ["/api/tutor/pod"],
    enabled: effectiveIsAuth && !!effectiveUser && isTutor(effectiveUser),
    retry: false,
  });

  // Fetch parent student info (includes pod name)
  const { data: parentStudentInfo } = useQuery<{ name: string; grade: string; podName: string | null }>({
    queryKey: ["/api/parent/student-info"],
    enabled: effectiveIsAuth && !!effectiveUser && isParent(effectiveUser),
    retry: false,
  });

  const { data: cooTrafficSummary } = useQuery<{ totalActionCount?: number }>({
    queryKey: ["/api/coo/traffic-summary"],
    enabled: effectiveIsAuth && !!effectiveUser && isCOO(effectiveUser),
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });

  const cooTrafficActionCount = Number(cooTrafficSummary?.totalActionCount || 0);

  const usesNotificationInbox = !!effectiveUser && (isTutor(effectiveUser) || isParent(effectiveUser) || isCOO(effectiveUser));

  const { data: notificationUnreadData } = useQuery<{ unreadCount: number }>({
    queryKey: ["/api/notifications/unread-count"],
    enabled: effectiveIsAuth && !!effectiveUser && usesNotificationInbox,
    refetchInterval: emergencyDbMode ? false : 60000,
    refetchOnWindowFocus: !emergencyDbMode,
    refetchOnReconnect: !emergencyDbMode,
    retry: emergencyDbMode ? false : undefined,
  });

  const { data: notifications } = useQuery<NotificationItem[]>({
    queryKey: ["/api/notifications"],
    enabled: effectiveIsAuth && !!effectiveUser && usesNotificationInbox,
    // Full notification content is loaded on demand; the badge uses the count endpoint.
    refetchOnWindowFocus: !emergencyDbMode,
    refetchOnReconnect: !emergencyDbMode,
    retry: emergencyDbMode ? false : undefined,
  });

  const { data: parentCommunicationUnreadData } = useQuery<{ unreadCount: number }>({
    queryKey: ["/api/parent/communications/unread-count"],
    enabled: effectiveIsAuth && !!effectiveUser && isParent(effectiveUser),
    refetchInterval: emergencyDbMode ? false : 60000,
    refetchOnWindowFocus: !emergencyDbMode,
    refetchOnReconnect: !emergencyDbMode,
    retry: emergencyDbMode ? false : undefined,
  });

  const { data: studentCommunicationUnreadData } = useQuery<{ unreadCount: number }>({
    queryKey: ["/api/student/communications/unread-count"],
    enabled: effectiveIsAuth && !!effectiveUser && effectiveUser.role === "student",
    refetchInterval: emergencyDbMode ? false : 60000,
    refetchOnWindowFocus: !emergencyDbMode,
    refetchOnReconnect: !emergencyDbMode,
    retry: emergencyDbMode ? false : undefined,
  });

  const visibleNotifications = useMemo(
    () =>
      (notifications || []).filter((notification) =>
        isParent(effectiveUser) ? notification.entityType !== "student_communication" : true
      ),
    [effectiveUser, notifications]
  );

  const visibleNotificationUnreadCount = useMemo(
    () => visibleNotifications.filter((notification) => !notification.isRead).length,
    [visibleNotifications]
  );

  const notificationsInitialized = useRef(false);
  const seenNotificationIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!usesNotificationInbox || !visibleNotifications.length) return;

    const currentIds = new Set<string>(visibleNotifications.map((notification) => notification.id));

    if (!notificationsInitialized.current) {
      notificationsInitialized.current = true;
      seenNotificationIds.current = currentIds;
      return;
    }

    visibleNotifications.forEach((notification) => {
      if (!seenNotificationIds.current.has(notification.id)) {
        toast({
          title: notification.title,
          description: notification.message,
          variant: notification.channel === "action_required" ? "destructive" : "default",
        });
      }
    });

    seenNotificationIds.current = currentIds;
  }, [toast, usesNotificationInbox, visibleNotifications]);

  console.log("👨‍👩‍👧 Parent student info:", parentStudentInfo);

  const usesBroadcastInbox = effectiveIsAuth && !!effectiveUser && effectiveUser.role !== "student";

  // Fetch unread broadcast count
  const { data: unreadData } = useQuery<{ unreadCount: number }>({
    queryKey: ["/api/broadcasts/unread-count"],
    enabled: usesBroadcastInbox && !emergencyDbMode,
    refetchInterval: emergencyDbMode ? false : 60000,
    refetchOnWindowFocus: !emergencyDbMode,
    refetchOnReconnect: !emergencyDbMode,
    retry: emergencyDbMode ? false : undefined,
  });

  // Fetch all broadcasts to filter unread ones
  const { data: broadcasts } = useQuery<any[]>({
    queryKey: ["/api/broadcasts"],
    enabled: usesBroadcastInbox,
    refetchOnWindowFocus: !emergencyDbMode,
    refetchOnReconnect: !emergencyDbMode,
    retry: emergencyDbMode ? false : undefined,
  });

  // Fetch read broadcasts list
  const { data: readData } = useQuery<{ readBroadcasts: string[] }>({
    queryKey: ["/api/broadcasts/read-list"],
    enabled: usesBroadcastInbox,
    refetchOnWindowFocus: !emergencyDbMode,
    refetchOnReconnect: !emergencyDbMode,
    retry: emergencyDbMode ? false : undefined,
  });

  // Filter unread broadcasts
  const unreadBroadcasts = broadcasts?.filter(
    (b: any) => !readData?.readBroadcasts?.includes(b.id)
  ) || [];

  const navUnreadCount = usesNotificationInbox
    ? (isParent(effectiveUser)
        ? visibleNotificationUnreadCount + Number(parentCommunicationUnreadData?.unreadCount || 0)
        : (notificationUnreadData?.unreadCount || 0))
    : effectiveUser?.role === "student"
      ? Number(studentCommunicationUnreadData?.unreadCount || 0)
    : unreadBroadcasts.length;

  // Mark broadcast as read mutation
  const markAsRead = useMutation({
    mutationFn: async (broadcastId: string) => {
      await apiRequest("POST", `/api/broadcasts/${broadcastId}/read`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/broadcasts/read-list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/broadcasts/unread-count"] });
    },
  });

  const getNavIcon = (label: string) => {
    const lowerLabel = label.toLowerCase();
    if (lowerLabel.includes("dashboard") || lowerLabel.includes("home")) return <Home className="w-5 h-5" />;
    if (lowerLabel.includes("session")) return <Calendar className="w-5 h-5" />;
    if (lowerLabel.includes("progress") || lowerLabel.includes("growth")) return <TrendingUp className="w-5 h-5" />;
    if (lowerLabel.includes("academic")) return <BookOpen className="w-5 h-5" />;
    if (lowerLabel.includes("assignment")) return <FileCheck className="w-5 h-5" />;
    if (lowerLabel.includes("update")) return <Bell className="w-5 h-5" />;
    if (lowerLabel.includes("disc") || lowerLabel.includes("discover")) return <FolderKanban className="w-5 h-5" />;
    if (lowerLabel.includes("track")) return <TrendingUp className="w-5 h-5" />;
    if (lowerLabel.includes("pod")) return <FolderKanban className="w-5 h-5" />;
    if (lowerLabel.includes("traffic")) return <Users className="w-5 h-5" />;
    if (lowerLabel.includes("brain")) return <Lightbulb className="w-5 h-5" />;
    if (lowerLabel.includes("dispute")) return <Shield className="w-5 h-5" />;
    return <Home className="w-5 h-5" />;
  };

  const tutorNav: NavItem[] = [
    { label: "My Pod", path: "/specialist/pod", icon: <FolderKanban className="w-5 h-5" /> },
    { label: "Growth", path: "/specialist/growth", icon: <TrendingUp className="w-5 h-5" /> },
    { label: "Sessions", path: "/specialist/sessions", icon: <Calendar className="w-5 h-5" /> },
    { label: "Updates", path: "/specialist/updates", icon: <Bell className="w-5 h-5" /> },
  ];

  const tdNav: NavItem[] = [
    { label: "Dashboard", path: "/td/dashboard", icon: <Home className="w-5 h-5" /> },
    { label: "My Pods", path: "/td/overview", icon: <FolderKanban className="w-5 h-5" /> },
    { label: "Reports", path: "/td/reports", icon: <FileCheck className="w-5 h-5" /> },
    { label: "Updates", path: "/td/updates", icon: <Bell className="w-5 h-5" /> },
  ];

  const cooNav: NavItem[] = [
    { label: "Dashboard", path: "/executive/coo/dashboard", icon: <Home className="w-5 h-5" /> },
    { label: "Traffic", path: "/executive/coo/traffic", icon: <Users className="w-5 h-5" /> },
    { label: "Pods", path: "/executive/coo/pods", icon: <FolderKanban className="w-5 h-5" /> },
    { label: "Brain", path: "/executive/coo/brain", icon: <Lightbulb className="w-5 h-5" /> },
    { label: "Broadcast", path: "/executive/coo/broadcast", icon: <MessageSquare className="w-5 h-5" /> },
  ];

  const studentNav: NavItem[] = [
    { label: "Dashboard", path: "/client/student/dashboard", icon: <Home className="w-5 h-5" /> },
    { label: "Sessions", path: "/client/student/sessions", icon: <Calendar className="w-5 h-5" /> },
    { label: "Assignments", path: "/client/student/assignments", icon: <FileCheck className="w-5 h-5" /> },
    { label: "Updates", path: "/client/student/updates", icon: <Bell className="w-5 h-5" /> },
  ];

  const affiliateNav: NavItem[] = [
    { label: "Home", path: "/affiliate/affiliate/home", icon: <Home className="w-5 h-5" /> },
    { label: "Disc & Deli", path: "/affiliate/affiliate/discover-deliver", icon: <FolderKanban className="w-5 h-5" /> },
    { label: "Tracking", path: "/affiliate/affiliate/tracking", icon: <TrendingUp className="w-5 h-5" /> },
    { label: "Updates", path: "/affiliate/affiliate/updates", icon: <Bell className="w-5 h-5" /> },
  ];

  const odNav: NavItem[] = [
    { label: "Dashboard", path: "/affiliate/od/dashboard", icon: <Home className="w-5 h-5" /> },
    { label: "Tracking", path: "/affiliate/od/encounters", icon: <TrendingUp className="w-5 h-5" /> },
    { label: "Crews", path: "/affiliate/od/crews", icon: <Users className="w-5 h-5" /> },
    { label: "Affiliates", path: "/affiliate/od/affiliates", icon: <FolderKanban className="w-5 h-5" /> },
    { label: "Updates", path: "/affiliate/od/updates", icon: <Bell className="w-5 h-5" /> },
  ];

  const getRoleNavigation = (): NavItem[] => {
    if (!effectiveUser?.role) {
      console.log("❌ No user role available");
      return [];
    }
    
    console.log("📍 Getting navigation for role:", effectiveUser.role);
    
    // For legacy tutor/TD/COO, use hardcoded nav arrays
    if (isTutor(effectiveUser)) {
      console.log("  → Using tutor hardcoded nav");
      return tutorNav;
    }
    if (isTD(effectiveUser)) {
      console.log("  → Using TD hardcoded nav");
      return tdNav;
    }
    if (isCOO(effectiveUser)) {
      console.log("  → Using COO hardcoded nav");
      return cooNav;
    }
    
    // Check for student role (student auth uses different system)
    if (effectiveUser.role === "student") {
      console.log("  → Using student hardcoded nav");
      return studentNav;
    }
    
    // Check for affiliate role
    if (isAffiliate(effectiveUser)) {
      console.log("  → Using affiliate hardcoded nav");
      return affiliateNav;
    }
    
    // Check for OD role
    if (isOD(effectiveUser)) {
      console.log("  → Using OD hardcoded nav");
      return odNav;
    }
    
    // For all other roles, use ROLE_NAVIGATION config
    const roleNav = ROLE_NAVIGATION[effectiveUser.role];
    console.log("  → Using ROLE_NAVIGATION for role:", effectiveUser.role);
    console.log("  → Role nav config:", roleNav);
    
    if (!roleNav) {
      console.error("❌ No navigation config found for role:", effectiveUser.role);
      return [];
    }
    
    // Map role navigation items to NavItems with icons
    // Normalize any generic executive dashboard route to the role-specific route
    return roleNav.map((item) => {
      let resolvedPath = item.path;

      // If upstream config uses a generic executive dashboard path, map it to a role-specific route
      if (item.path === "/executive/dashboard") {
        if (effectiveUser.role === "ceo") {
          resolvedPath = "/executive/ceo/board"; // CEO uses /board route
        } else {
          resolvedPath = `/executive/${effectiveUser.role}/dashboard`;
        }
      }

      return {
        label: item.label,
        path: resolvedPath,
        icon: getNavIcon(item.label),
      };
    });
  };

  const navItems = getRoleNavigation();

  const getRoleLabel = (u: User | undefined): string => {
    if (!u?.role) return "";
    return getRoleName(u.role);
  };

  const getRoleLabelShort = (u: User | undefined): string => {
    if (!u?.role) return "";
    return getRoleNameShort(u.role);
  };

  const getPodLabel = () => {
    // Show pod name only for tutors with an actual pod assignment
    // Students and parents just see their role, not pod info
    if (isTutor(effectiveUser) && tutorPodData?.assignment?.pod) {
      return tutorPodData.assignment.pod.podName;
    }
    return "";
  };

  const useIntegrityBrand =
    !!effectiveUser && (isAffiliate(effectiveUser) || isOD(effectiveUser));
  const useSpecialistTheme = !!effectiveUser && isTutor(effectiveUser);
  const useTDTheme = !!effectiveUser && isTD(effectiveUser);
  const useRIThemeWorld = useSpecialistTheme || useTDTheme;
  const useSpecialistSurface =
    useSpecialistTheme && location.pathname !== "/specialist/pod";
  const useRIThemeSurface = useSpecialistSurface || useTDTheme;

  return (
    <div className={`min-h-screen bg-background${useRIThemeWorld ? " ri-world-page ri-specialist-world" : ""}`}>
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="h-16 px-4 flex items-center justify-between gap-4">
          {/* Mobile Layout: Role/Pod on left, Title center, Profile right */}
          <div className="sm:hidden flex items-center justify-between w-full">
            {/* Left: Role & Pod as fraction style */}
            <div className="text-xs text-muted-foreground font-medium min-w-[40px]">
              {effectiveUser && (
                getPodLabel() ? (
                  <div className="flex flex-col items-start">
                    <span>{getRoleLabelShort(effectiveUser)}</span>
                    <div className="w-8 h-px bg-muted-foreground/40 my-0.5" />
                    <span>{getPodLabel()}</span>
                  </div>
                ) : (
                  <span>{getRoleLabelShort(effectiveUser)}</span>
                )
              )}
            </div>
            {/* Center: Title */}
            <Link to="/" className="absolute left-1/2 -translate-x-1/2">
              <div className="font-bold text-base tracking-tight whitespace-nowrap uppercase">
                {useIntegrityBrand ? (
                  <>
                    <span className="text-[#E63946]">Response</span>{" "}
                    <span className="text-foreground">Integrity</span>
                  </>
                ) : (
                  "Response Integrity"
                )}
              </div>
            </Link>
          </div>

          {/* Desktop Layout */}
          <div className="hidden sm:flex items-center gap-4">
            <Link to="/" className="flex items-center gap-3">
              <div>
                <div className="font-bold text-base tracking-tight uppercase">
                  {useIntegrityBrand ? (
                    <>
                      <span className="text-[#E63946]">Response</span>{" "}
                      <span className="text-foreground">Integrity</span>
                    </>
                  ) : (
                    "Response Integrity"
                  )}
                </div>
                {effectiveUser && (
                  <div className="text-xs text-muted-foreground">
                    {getRoleLabel(effectiveUser)}
                    {getPodLabel() && ` • ${getPodLabel()}`}
                  </div>
                )}
              </div>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link key={item.path} to={item.path}>
                <Button variant="ghost" size="sm" className="gap-2 font-medium relative">
                  {item.icon}
                  <span>{item.label}</span>
                  {item.label === "Updates" && navUnreadCount > 0 && (
                    <Badge variant="destructive" className="absolute -top-2 -right-2 text-xs">
                      {navUnreadCount > 9 ? "9+" : navUnreadCount}
                    </Badge>
                  )}
                  {item.label === "Traffic" && cooTrafficActionCount > 0 && (
                    <Badge variant="destructive" className="absolute -top-2 -right-2 text-xs">
                      {cooTrafficActionCount > 99 ? "99+" : cooTrafficActionCount}
                    </Badge>
                  )}
                </Button>
              </Link>
            ))}
          </nav>

          {/* User Menu */}
          <div className="flex items-center gap-3">
            <AccountMenu
              user={effectiveUser as User | undefined}
              showIssueAction
              onLogIssue={() => setShowDisputeModal(true)}
            />
          </div>
        </div>
      </header>

      {/* Main Content - Add bottom padding on mobile for bottom nav */}
      <main className={`max-w-7xl mx-auto px-3 py-4 sm:px-4 md:px-6 md:py-8 pb-20 md:pb-8${useRIThemeSurface ? " ri-specialist-surface" : ""}`}>{children}</main>
      
      {/* Mobile Bottom Tab Navigator */}
      <MobileBottomNav navItems={navItems} unreadCount={navUnreadCount} />
      
      {/* Log Dispute Modal */}
      <LogDisputeModal open={showDisputeModal} onOpenChange={setShowDisputeModal} />
    </div>
  );
}
