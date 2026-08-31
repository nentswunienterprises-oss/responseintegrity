import { ReactNode, useState, useEffect, useMemo, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Home,
  Users,
  FolderKanban,
  FileCheck,
  Bell,
  LogOut,
  TrendingUp,
  Calendar,
  MessageSquare,
  GraduationCap,
  Shield,
  BookOpen,
  Lightbulb,
} from "lucide-react";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { useAuth } from "@/hooks/useAuth";
import { isTutor, isTD, isCOO, isAffiliate, isOD, isParent, getRoleName, getRoleNameShort } from "@/lib/roles";
import { logout } from "@/lib/auth";
import { LogDisputeModal } from "@/components/LogDisputeModal";
import { ROLE_NAVIGATION } from "@shared/portals";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Pod, TutorAssignment, User } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { API_URL } from "@/lib/config";
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
  const hasDoc2Acceptance = Boolean(application?.onboardingAcceptanceMap?.["2"]);
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

  const { data: cooTutorApplications = [] } = useQuery<any[]>({
    queryKey: ["/api/coo/tutor-applications"],
    enabled: effectiveIsAuth && !!effectiveUser && isCOO(effectiveUser),
    retry: false,
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  });

  const cooTrafficActionCount = useMemo(() => {
    if (!effectiveUser || !isCOO(effectiveUser)) return 0;
    const pendingApplications = cooTutorApplications.filter((app: any) => app.status === "pending").length;
    const approvedApplications = cooTutorApplications.filter((app: any) => app.status === "approved");
    const needsReview = approvedApplications.filter((app: any) => hasTutorTrafficPendingReview(app)).length;
    const waitingOnTutor = approvedApplications.filter((app: any) => hasTutorTrafficWaitingOnTutor(app)).length;
    return pendingApplications + needsReview + waitingOnTutor;
  }, [cooTutorApplications, effectiveUser]);

  const usesNotificationInbox = !!effectiveUser && (isTutor(effectiveUser) || isParent(effectiveUser) || isCOO(effectiveUser));

  const { data: notificationUnreadData } = useQuery<{ unreadCount: number }>({
    queryKey: ["/api/notifications/unread-count"],
    enabled: effectiveIsAuth && !!effectiveUser && usesNotificationInbox,
    refetchInterval: 15000,
  });

  const { data: notifications } = useQuery<NotificationItem[]>({
    queryKey: ["/api/notifications"],
    enabled: effectiveIsAuth && !!effectiveUser && usesNotificationInbox,
    refetchInterval: 15000,
  });

  const { data: parentCommunicationUnreadData } = useQuery<{ unreadCount: number }>({
    queryKey: ["/api/parent/communications/unread-count"],
    enabled: effectiveIsAuth && !!effectiveUser && isParent(effectiveUser),
    refetchInterval: 15000,
  });

  const { data: studentCommunicationUnreadData } = useQuery<{ unreadCount: number }>({
    queryKey: ["/api/student/communications/unread-count"],
    enabled: effectiveIsAuth && !!effectiveUser && effectiveUser.role === "student",
    refetchInterval: 15000,
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
    enabled: usesBroadcastInbox,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch all broadcasts to filter unread ones
  const { data: broadcasts } = useQuery<any[]>({
    queryKey: ["/api/broadcasts"],
    enabled: usesBroadcastInbox,
  });

  // Fetch read broadcasts list
  const { data: readData } = useQuery<{ readBroadcasts: string[] }>({
    queryKey: ["/api/broadcasts/read-list"],
    enabled: usesBroadcastInbox,
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

  const getUserFullName = (u: User | undefined): string => {
    if (!u) return "User";
    if (u.name && u.name.trim()) return u.name;
    if (u.firstName && u.lastName) return `${u.firstName} ${u.lastName}`;
    if (u.firstName) return u.firstName;
    if (u.email) return u.email.split("@")[0];
    return "User";
  };

  const getUserFirstName = (u: User | undefined): string => {
    const fullName = getUserFullName(u);
    return fullName.split(" ")[0] || "User";
  };

  const getInitials = (u: User | undefined): string => {
    if (!u) return "U";
    if (u.firstName && u.lastName) {
      return `${u.firstName[0]}${u.lastName[0]}`.toUpperCase();
    }
    if (u.name && u.name.trim()) {
      return u.name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    if (u.email) {
      return u.email[0].toUpperCase();
    }
    return "U";
  };

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

  return (
    <div className="min-h-screen bg-background">
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
                    <span className="text-[#1A1A1A]">Integrity</span>
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
                      <span className="text-[#1A1A1A]">Integrity</span>
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="gap-2 hover-elevate"
                  data-testid="button-user-menu"
                >
                  <Avatar className="w-9 h-9 border-2 border-primary/20">
                    <AvatarImage src={effectiveUser?.profileImageUrl || undefined} alt={getUserFullName(effectiveUser)} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                      {getInitials(effectiveUser)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline text-sm font-semibold" data-testid="text-user-first-name">{getUserFirstName(effectiveUser)}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>
                  <div className="flex items-center gap-3 py-2">
                    <Avatar className="w-12 h-12 border-2 border-primary/20">
                      <AvatarImage src={effectiveUser?.profileImageUrl || undefined} alt={getUserFullName(effectiveUser)} />
                      <AvatarFallback className="bg-primary/10 text-primary font-bold">
                        {getInitials(effectiveUser)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-semibold leading-none" data-testid="text-user-full-name">{getUserFullName(effectiveUser)}</p>
                      <p className="text-xs leading-none text-muted-foreground">{effectiveUser?.email}</p>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="px-2 py-2 flex items-center justify-between">
                  <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                    {effectiveUser?.role ? getRoleName(effectiveUser.role) : "Unknown"}
                  </Badge>
                  {isTutor(effectiveUser) && (
                    <DropdownMenuItem asChild className="p-0">
                      <Link to="/specialist/profile" className="text-xs font-semibold text-primary hover:text-primary/80 cursor-pointer">
                        View Profile
                      </Link>
                    </DropdownMenuItem>
                  )}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setShowDisputeModal(true)}
                  className="gap-2 font-medium"
                >
                  <Shield className="w-4 h-4" />
                  Log Issue
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => logout(effectiveUser)}
                  className="text-destructive gap-2 font-medium"
                  data-testid="button-logout"
                >
                  <LogOut className="w-4 h-4" />
                  Log Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content - Add bottom padding on mobile for bottom nav */}
      <main className="max-w-7xl mx-auto px-3 py-4 sm:px-4 md:px-6 md:py-8 pb-20 md:pb-8">{children}</main>
      
      {/* Mobile Bottom Tab Navigator */}
      <MobileBottomNav navItems={navItems} unreadCount={navUnreadCount} />
      
      {/* Log Dispute Modal */}
      <LogDisputeModal open={showDisputeModal} onOpenChange={setShowDisputeModal} />
    </div>
  );
}
