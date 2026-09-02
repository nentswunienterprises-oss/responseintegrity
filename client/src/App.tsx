import IntroSessionDrillRunner from "@/components/tutor/IntroSessionDrillRunner";
import ExecutiveCOOTrackLeads from "@/pages/executive/coo/track-leads";
import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { queryClient, persister } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { RouteSeoManager } from "@/components/RouteSeoManager";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { DashboardLayoutSimple } from "@/components/layout/dashboard-layout-simple";
import { ProtectedParentRoute } from "@/lib/parentGuard";
import { ExecutiveSeatGuard } from "@/lib/portalGuard";
import { TdGatewayGuard } from "@/lib/tdGatewayGuard";
import { TutorGatewayGuard } from "@/lib/tutorGatewayGuard";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { DeepDiveDeterrent } from "@/components/responseconditioning/DeepDiveDeterrent";

// Clean up old localStorage cache on startup (we now use sessionStorage which is tab-specific)
if (typeof window !== 'undefined') {
  window.localStorage.removeItem('REACT_QUERY_OFFLINE_CACHE');
  window.localStorage.removeItem('CURRENT_USER_ID');
}

// General Pages
import Landing from "@/pages/landing";
import PortalLanding from "@/pages/portal-landing";
import OnlineTutorsWanted from "@/pages/onlinetutors-wanted";
import OnlineTutorsWantedPlain from "@/pages/onlinetutorswanted";
import AuthPage from "@/pages/auth";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import AuthCallback from "@/pages/auth-callback";
import Home from "@/pages/home";
import NotFound from "@/pages/not-found";
import FAQPage from "@/pages/faq";
import PrivacyPolicy from "@/pages/privacy-policy";
import TermsOfUse from "@/pages/terms-of-use";
import TutorTermsOfUse from "@/pages/tutor-terms-of-use";
import TdTermsOfUse from "@/pages/td-terms-of-use";
import EgpTermsOfUse from "@/pages/egp-terms-of-use";
import EarlyInterventionReferralProgram from "@/pages/earlyinterventionreferralprogram";
import AboutIndex from "@/pages/about/index";
import WhoWeAre from "@/pages/about/who-we-are";
import HowWeOperate from "@/pages/about/how-we-operate";
import HowWeTeach from "@/pages/about/how-we-teach";
import TeamPage from "@/pages/about/team";
import LeadershipDevelopmentPilot from "@/pages/leadershipdevelopmentpilot";
import SpecialistLanding from "@/pages/specialist";
import ResponseConditioningSystem from "@/pages/responseconditioningsystem";
import ResponseConditioningIntroduction from "@/pages/responseconditioningsystem/introduction";
import ResponseConditioningClarity from "@/pages/responseconditioningsystem/transformation-phases/clarity";
import ResponseConditioningStructuredExecution from "@/pages/responseconditioningsystem/transformation-phases/structured-execution";
import ResponseConditioningControlledDiscomfort from "@/pages/responseconditioningsystem/transformation-phases/controlled-discomfort";
import ResponseConditioningTimePressureStability from "@/pages/responseconditioningsystem/transformation-phases/time-pressure-stability";
import ResponseConditioningHowToModel from "@/pages/responseconditioningsystem/execution-standards/how-to-model";
import ResponseConditioningHowToGuide from "@/pages/responseconditioningsystem/execution-standards/how-to-guide";
import ResponseConditioningHowToUseBossBattles from "@/pages/responseconditioningsystem/execution-standards/how-to-use-boss-battles";
import ResponseConditioningWhatNotToDo from "@/pages/responseconditioningsystem/execution-standards/what-not-to-do";
import ResponseConditioningEmotionalDisciplineUnderDiscomfort from "@/pages/responseconditioningsystem/execution-standards/emotional-discipline-under-discomfort";
import ResponseConditioningWhatChangesInTheStudent from "@/pages/responseconditioningsystem/system-intelligence/what-changes-in-the-student";
import ResponseConditioningSignsOfProgress from "@/pages/responseconditioningsystem/system-intelligence/signs-of-progress";
import ResponseConditioningBreakdownPatterns from "@/pages/responseconditioningsystem/system-intelligence/breakdown-patterns";
import ResponseConditioningBeforeVsAfter from "@/pages/responseconditioningsystem/system-intelligence/before-vs-after";
import ResponseConditioningIntroSessionStructure from "@/pages/responseconditioningsystem/session-infrastructure/intro-session-structure";
import ResponseConditioningSessionFlowControl from "@/pages/responseconditioningsystem/session-infrastructure/session-flow-control";
import ResponseConditioningDrillLibrary from "@/pages/responseconditioningsystem/session-infrastructure/drill-library";
import ResponseConditioningLoggingSystem from "@/pages/responseconditioningsystem/session-infrastructure/logging-system";
import ResponseConditioningHandoverVerification from "@/pages/responseconditioningsystem/session-infrastructure/handover-verification";
import ResponseConditioningToolsRequired from "@/pages/responseconditioningsystem/session-infrastructure/tools-required";
import ResponseConditioningTopicConditioning from "@/pages/responseconditioningsystem/session-infrastructure/topic-conditioning";

// Legacy Tutor Pages (kept for backwards compatibility)
import TutorPod from "@/pages/operational/tutor/pod";
import TutorGateway from "@/pages/operational/tutor/gateway";
import TutorGrowth from "@/pages/operational/tutor/growth";
import TutorAcademics from "@/pages/operational/tutor/academics";
import TutorSessions from "@/pages/operational/tutor/sessions";
import TutorUpdates from "@/pages/operational/tutor/updates";
import TutorProfile from "@/pages/operational/tutor/profile";

// Legacy TD Pages (kept for backwards compatibility)
import TDNoPod from "@/pages/operational/td/no-pod";
import TDDashboard from "@/pages/operational/td/dashboard";
import TDOverview from "@/pages/operational/td/overview";
import TDTutors from "@/pages/operational/td/tutors";
import TDReports from "@/pages/operational/td/reports";
import TDUpdates from "@/pages/operational/td/updates";

// Legacy COO Pages (kept for backwards compatibility)
import COODashboard from "@/pages/executive/coo/dashboard";
import COOPods from "@/pages/executive/coo/pods";
import COOPodDetail from "@/pages/executive/coo/pod-detail";
import COOVerification from "@/pages/executive/coo/verification";
import COOBrain from "@/pages/executive/coo/brain";
import COOBroadcast from "@/pages/executive/coo/broadcast";
import LeadershipPilotRequests from "@/pages/executive/coo/leadership-pilot-requests";

// NEW: Client Portal Pages
import ParentDashboard from "@/pages/client/parent/dashboard";
import ParentGateway from "@/pages/client/parent/gateway";
import ParentIntakeEntry from "@/pages/client/intake";
import ParentSessions from "@/pages/client/parent/sessions";
import ParentProgress from "@/pages/client/parent/progress";
import ParentUpdates from "@/pages/client/parent/updates";
import StudentLanding from "@/pages/client/student/StudentLanding";
import StudentDashboardNew from "@/pages/client/student/StudentDashboard";
import StudentDashboard from "@/pages/client/student/dashboard";
import StudentSessions from "@/pages/client/student/sessions";
import StudentAssignments from "@/pages/client/student/assignments";
import StudentUpdates from "@/pages/client/student/updates";

// NEW: Operational Portal Pages
import OperationalTutorDashboard from "@/pages/operational/tutor/dashboard";
import TutorBlueprint from "@/pages/operational/tutor/blueprint";
import ResponseIntegrityOS from "@/pages/operational/tutor/response-integrity-os";
import OperationalTDDashboard from "@/pages/operational/td/dashboard";
import TdGateway from "@/pages/operational/td/gateway";
import TdLanding from "@/pages/operational/td/landing";
import TdSignup from "@/pages/operational/td/signup";
import TutorIntakeEntry from "@/pages/operational/tutor/intake";
import TutorLanding from "@/pages/operational/tutor/landing";

// NEW: Affiliate Portal Pages
import AffiliateDashboard from "@/pages/affiliate/affiliate/home";
import AffiliateDiscoverDeliver from "@/pages/affiliate/affiliate/discover-deliver";
import AffiliateTracking from "@/pages/affiliate/affiliate/tracking";
import AffiliateUpdates from "@/pages/affiliate/affiliate/updates";
import OutreachDirectorDashboard from "@/pages/affiliate/od/dashboard";
import ODEncounters from "@/pages/affiliate/od/encounters";
import ODCrews from "@/pages/affiliate/od/crews";
import ODAffiliates from "@/pages/affiliate/od/affiliates";
import ODUpdates from "@/pages/affiliate/od/updates";

// NEW: Executive Portal Pages
import ExecutiveCOODashboard from "@/pages/executive/coo/dashboard";
import ExecutiveHRDashboard from "@/pages/executive/hr/dashboard";
import ExecutiveHRTraffic from "@/pages/executive/hr/traffic";
import ExecutiveHRUpdates from "@/pages/executive/hr/updates";
import ExecutiveHRApplications from "@/pages/executive/hr/applications";
import ExecutiveHRBrain from "@/pages/executive/hr/brain";
import ExecutiveHRDisputes from "@/pages/executive/hr/disputes";
import ExecutiveCommandRhythmDashboard from "@/pages/executive/command-rhythm-dashboard";
import ExecutiveCEOBoard from "@/pages/executive/ceo/board";
import ExecutiveGateway from "@/pages/executive/gateway";
import RecruitmentPrivacy from "@/pages/executive/recruitment-privacy";

// NEW: Portal Landing Pages
import OperationalLanding from "@/pages/operational/landing";
import AffiliateLandingPage from "@/pages/affiliate/landing";
import AffiliateGateway from "@/pages/affiliate/gateway";
import ContributorLanding from "@/pages/contributor/landing";
import ContributorGateway from "@/pages/contributor/gateway";
import ContributorHome from "@/pages/contributor/contributor/home";
import ContributorTracking from "@/pages/contributor/contributor/tracking";
import ContributorUpdates from "@/pages/contributor/contributor/updates";
import ExecutiveLanding from "@/pages/executive/landing";

// NEW: Portal Signup Pages
import ClientSignup from "@/pages/client/signup";
import OperationalSignup from "@/pages/operational/signup";
import AffiliateSignup from "@/pages/affiliate/signup";
import ExecutiveSignup from "@/pages/executive/signup";

// Media Portal Pages
import MediaLanding from "@/pages/media/landing";
import CarouselSelect from "@/pages/media/carousel/select";
import CarouselCreate from "@/pages/media/carousel/create";
import CarouselLibrary from "@/pages/media/carousel/library";

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

function RecoveryCodeRedirect() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.pathname !== "/" && location.pathname !== "/portal-landing") {
      return;
    }

    const searchParams = new URLSearchParams(location.search);
    const hashParams = new URLSearchParams(location.hash.startsWith("#") ? location.hash.slice(1) : location.hash);
    const hasRecoverySignal =
      searchParams.get("type") === "recovery" ||
      hashParams.get("type") === "recovery" ||
      hashParams.has("access_token");

    // Supabase PKCE recovery links can arrive as /?code=... without type=recovery.
    const hasRootAuthCode = searchParams.has("code");
    const shouldTreatAsRecovery = hasRecoverySignal || hasRootAuthCode;

    if (!shouldTreatAsRecovery) {
      return;
    }

    navigate(`/reset-password${location.search}${location.hash}`, { replace: true });
  }, [location.hash, location.pathname, location.search, navigate]);

  return null;
}

function withDeepDiveDeterrent(page: ReactNode) {
  return <DeepDiveDeterrent>{page}</DeepDiveDeterrent>;
}

function RedirectWithSearch({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate to={`${to}${location.search}${location.hash}`} replace />;
}

function Router() {
  return (
    <Routes>
      {/* General Routes */}
      {/* Intro Session Drill Runner */}
      <Route path="/tutor/intro-session/:studentId" element={<TutorGatewayGuard><IntroSessionDrillRunner /></TutorGatewayGuard>} />
      <Route path="/specialist/intro-session/:studentId" element={<TutorGatewayGuard><IntroSessionDrillRunner /></TutorGatewayGuard>} />
      <Route path="/" element={<PortalLanding />} />
      <Route path="/portal-landing" element={<Navigate to="/" replace />} />
      <Route path="/landing" element={<Landing />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/login" element={<AuthPage />} />
      <Route path="/signup" element={<AuthPage />} />
      <Route path="/home" element={<Home />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/terms-of-use" element={<TermsOfUse />} />
      <Route path="/specialist-terms-of-use" element={<TutorTermsOfUse />} />
      <Route path="/tutor-terms-of-use" element={<TutorTermsOfUse />} />
      <Route path="/td-terms-of-use" element={<TdTermsOfUse />} />
      <Route path="/egp-terms-of-use" element={<EgpTermsOfUse />} />
      <Route path="/faq" element={<FAQPage />} />
      <Route path="/onlinetutors-wanted" element={<OnlineTutorsWanted />} />
      <Route path="/onlinetutorswanted" element={<OnlineTutorsWantedPlain />} />
      <Route path="/earlyinterventionreferralprogram" element={<EarlyInterventionReferralProgram />} />
      <Route path="/about" element={<AboutIndex />} />
      <Route path="/about/who-we-are" element={<WhoWeAre />} />
      <Route path="/about/how-we-operate" element={<HowWeOperate />} />
      <Route path="/about/how-we-teach" element={<HowWeTeach />} />
      <Route path="/about/team" element={<TeamPage />} />
      <Route path="/aboutTT" element={<Navigate to="/about" replace />} />
      <Route path="/leadershipdevelopmentpilot" element={<LeadershipDevelopmentPilot />} />
      <Route path="/specialist" element={<SpecialistLanding />} />
      <Route path="/foundingtutorswanted" element={<RedirectWithSearch to="/operational/specialist/landing" />} />
      <Route path="/responseconditioningsystem" element={withDeepDiveDeterrent(<ResponseConditioningSystem />)} />
      <Route
        path="/responseconditioningsystem/introduction"
        element={withDeepDiveDeterrent(<ResponseConditioningIntroduction />)}
      />
      <Route
        path="/responseconditioningsystem/clarity"
        element={withDeepDiveDeterrent(<ResponseConditioningClarity />)}
      />
      <Route
        path="/responseconditioningsystem/structured-execution"
        element={withDeepDiveDeterrent(<ResponseConditioningStructuredExecution />)}
      />
      <Route
        path="/responseconditioningsystem/controlled-discomfort"
        element={withDeepDiveDeterrent(<ResponseConditioningControlledDiscomfort />)}
      />
      <Route
        path="/responseconditioningsystem/time-pressure-stability"
        element={withDeepDiveDeterrent(<ResponseConditioningTimePressureStability />)}
      />
      <Route
        path="/responseconditioningsystem/transformation-phases"
        element={<Navigate to="/responseconditioningsystem/transformation-phases/topic-conditioning" replace />}
      />
      <Route
        path="/responseconditioningsystem/transformation-phases/topic-conditioning"
        element={withDeepDiveDeterrent(<ResponseConditioningTopicConditioning />)}
      />
      <Route
        path="/responseconditioningsystem/transformation-phases/clarity"
        element={withDeepDiveDeterrent(<ResponseConditioningClarity />)}
      />
      <Route
        path="/responseconditioningsystem/transformation-phases/structured-execution"
        element={withDeepDiveDeterrent(<ResponseConditioningStructuredExecution />)}
      />
      <Route
        path="/responseconditioningsystem/transformation-phases/controlled-discomfort"
        element={withDeepDiveDeterrent(<ResponseConditioningControlledDiscomfort />)}
      />
      <Route
        path="/responseconditioningsystem/transformation-phases/time-pressure-stability"
        element={withDeepDiveDeterrent(<ResponseConditioningTimePressureStability />)}
      />
      <Route
        path="/responseconditioningsystem/how-to-model"
        element={withDeepDiveDeterrent(<ResponseConditioningHowToModel />)}
      />
      <Route
        path="/responseconditioningsystem/execution-standards/how-to-model"
        element={withDeepDiveDeterrent(<ResponseConditioningHowToModel />)}
      />
      <Route
        path="/responseconditioningsystem/how-to-guide"
        element={withDeepDiveDeterrent(<ResponseConditioningHowToGuide />)}
      />
      <Route
        path="/responseconditioningsystem/execution-standards/how-to-guide"
        element={withDeepDiveDeterrent(<ResponseConditioningHowToGuide />)}
      />
      <Route
        path="/responseconditioningsystem/how-to-use-boss-battles"
        element={withDeepDiveDeterrent(<ResponseConditioningHowToUseBossBattles />)}
      />
      <Route
        path="/responseconditioningsystem/execution-standards/how-to-use-boss-battles"
        element={withDeepDiveDeterrent(<ResponseConditioningHowToUseBossBattles />)}
      />
      <Route
        path="/responseconditioningsystem/what-not-to-do"
        element={withDeepDiveDeterrent(<ResponseConditioningWhatNotToDo />)}
      />
      <Route
        path="/responseconditioningsystem/execution-standards/what-not-to-do"
        element={withDeepDiveDeterrent(<ResponseConditioningWhatNotToDo />)}
      />
      <Route
        path="/responseconditioningsystem/emotional-discipline-under-discomfort"
        element={withDeepDiveDeterrent(<ResponseConditioningEmotionalDisciplineUnderDiscomfort />)}
      />
      <Route
        path="/responseconditioningsystem/execution-standards/emotional-discipline-under-discomfort"
        element={withDeepDiveDeterrent(<ResponseConditioningEmotionalDisciplineUnderDiscomfort />)}
      />
      <Route
        path="/responseconditioningsystem/what-changes-in-the-student"
        element={withDeepDiveDeterrent(<ResponseConditioningWhatChangesInTheStudent />)}
      />
      <Route
        path="/responseconditioningsystem/system-intelligence/what-changes-in-the-student"
        element={withDeepDiveDeterrent(<ResponseConditioningWhatChangesInTheStudent />)}
      />
      <Route
        path="/responseconditioningsystem/signs-of-progress"
        element={withDeepDiveDeterrent(<ResponseConditioningSignsOfProgress />)}
      />
      <Route
        path="/responseconditioningsystem/system-intelligence/signs-of-progress"
        element={withDeepDiveDeterrent(<ResponseConditioningSignsOfProgress />)}
      />
      <Route
        path="/responseconditioningsystem/breakdown-patterns"
        element={withDeepDiveDeterrent(<ResponseConditioningBreakdownPatterns />)}
      />
      <Route
        path="/responseconditioningsystem/system-intelligence/breakdown-patterns"
        element={withDeepDiveDeterrent(<ResponseConditioningBreakdownPatterns />)}
      />
      <Route
        path="/responseconditioningsystem/before-vs-after"
        element={withDeepDiveDeterrent(<ResponseConditioningBeforeVsAfter />)}
      />
      <Route
        path="/responseconditioningsystem/system-intelligence/before-vs-after"
        element={withDeepDiveDeterrent(<ResponseConditioningBeforeVsAfter />)}
      />
      <Route
        path="/responseconditioningsystem/intro-session-structure"
        element={withDeepDiveDeterrent(<ResponseConditioningIntroSessionStructure />)}
      />
      <Route
        path="/responseconditioningsystem/session-infrastructure/intro-session-structure"
        element={withDeepDiveDeterrent(<ResponseConditioningIntroSessionStructure />)}
      />
      <Route
        path="/responseconditioningsystem/session-flow-control"
        element={withDeepDiveDeterrent(<ResponseConditioningSessionFlowControl />)}
      />
      <Route
        path="/responseconditioningsystem/session-infrastructure/session-flow-control"
        element={withDeepDiveDeterrent(<ResponseConditioningSessionFlowControl />)}
      />
      <Route
        path="/responseconditioningsystem/drill-library"
        element={withDeepDiveDeterrent(<ResponseConditioningDrillLibrary />)}
      />
      <Route
        path="/responseconditioningsystem/session-infrastructure/drill-library"
        element={withDeepDiveDeterrent(<ResponseConditioningDrillLibrary />)}
      />
      <Route
        path="/responseconditioningsystem/topic-conditioning"
        element={withDeepDiveDeterrent(<ResponseConditioningTopicConditioning />)}
      />
      <Route
        path="/responseconditioningsystem/session-infrastructure/topic-conditioning"
        element={<Navigate to="/responseconditioningsystem/transformation-phases/topic-conditioning" replace />}
      />
      <Route
        path="/responseconditioningsystem/logging-system"
        element={withDeepDiveDeterrent(<ResponseConditioningLoggingSystem />)}
      />
      <Route
        path="/responseconditioningsystem/session-infrastructure/logging-system"
        element={withDeepDiveDeterrent(<ResponseConditioningLoggingSystem />)}
      />
      <Route
        path="/responseconditioningsystem/handover-verification"
        element={withDeepDiveDeterrent(<ResponseConditioningHandoverVerification />)}
      />
      <Route
        path="/responseconditioningsystem/session-infrastructure/handover-verification"
        element={withDeepDiveDeterrent(<ResponseConditioningHandoverVerification />)}
      />
      <Route
        path="/responseconditioningsystem/tools-required"
        element={withDeepDiveDeterrent(<ResponseConditioningToolsRequired />)}
      />
      <Route
        path="/responseconditioningsystem/session-infrastructure/tools-required"
        element={withDeepDiveDeterrent(<ResponseConditioningToolsRequired />)}
      />

      {/* ==================== CLIENT PORTAL ==================== */}
      {/* Client Signup */}
      <Route path="/client/intake" element={<ParentIntakeEntry />} />
      <Route path="/client/signup" element={<ClientSignup />} />
      {/* Parent Routes */}
      <Route path="/client/parent/gateway" element={<ParentGateway />} />
      <Route path="/client/parent/dashboard" element={<ProtectedParentRoute><DashboardLayout><ParentDashboard /></DashboardLayout></ProtectedParentRoute>} />
      <Route path="/client/parent/sessions" element={<ProtectedParentRoute><DashboardLayout><ParentSessions /></DashboardLayout></ProtectedParentRoute>} />
      <Route path="/client/parent/progress" element={<ProtectedParentRoute><DashboardLayout><ParentProgress /></DashboardLayout></ProtectedParentRoute>} />
      <Route path="/client/parent/updates" element={<ProtectedParentRoute><DashboardLayout><ParentUpdates /></DashboardLayout></ProtectedParentRoute>} />

      {/* Student Routes */}
      <Route path="/student" element={<StudentLanding />} />
      <Route path="/student/dashboard" element={<Navigate to="/client/student/dashboard" replace />} />
      <Route path="/client/student/dashboard" element={<DashboardLayout><StudentDashboard /></DashboardLayout>} />
      <Route path="/client/student/sessions" element={<DashboardLayout><StudentSessions /></DashboardLayout>} />
      <Route path="/client/student/assignments" element={<DashboardLayout><StudentAssignments /></DashboardLayout>} />
      <Route path="/client/student/updates" element={<DashboardLayout><StudentUpdates /></DashboardLayout>} />

      {/* ==================== OPERATIONAL PORTAL ==================== */}
      {/* Operational Landing */}
      <Route path="/operational/landing" element={<OperationalLanding />} />
      <Route path="/operational/specialist/landing" element={<TutorLanding />} />
      <Route path="/operational/specialist/intake" element={<TutorIntakeEntry />} />
      <Route path="/operational/tutor/landing" element={<RedirectWithSearch to="/operational/specialist/landing" />} />
      <Route path="/operational/tutor/intake" element={<RedirectWithSearch to="/operational/specialist/intake" />} />
      {/* Operational Signup */}
      <Route path="/operational/signup" element={<OperationalSignup />} />

      {/* Tutor Routes */}
      <Route path="/operational/specialist/gateway" element={<TutorGatewayGuard><TutorGateway /></TutorGatewayGuard>} />
      <Route path="/operational/specialist/dashboard" element={<TutorGatewayGuard><Navigate to="/specialist/pod" replace /></TutorGatewayGuard>} />
      <Route path="/operational/specialist/my-pod" element={<TutorGatewayGuard><Navigate to="/specialist/pod" replace /></TutorGatewayGuard>} />
      <Route path="/operational/specialist/response-integrity-os" element={<TutorGatewayGuard><ResponseIntegrityOS /></TutorGatewayGuard>} />
      <Route path="/operational/specialist/tt-os" element={<Navigate to="/operational/specialist/response-integrity-os" replace />} />
      <Route path="/operational/specialist/growth" element={<TutorGatewayGuard><Navigate to="/specialist/growth" replace /></TutorGatewayGuard>} />
      <Route path="/operational/specialist/academic-tracker" element={<TutorGatewayGuard><Navigate to="/specialist/academics" replace /></TutorGatewayGuard>} />
      <Route path="/operational/specialist/sessions" element={<TutorGatewayGuard><Navigate to="/specialist/sessions" replace /></TutorGatewayGuard>} />
      <Route path="/operational/specialist/profile" element={<TutorGatewayGuard><Navigate to="/specialist/profile" replace /></TutorGatewayGuard>} />
      <Route path="/operational/specialist/updates" element={<TutorGatewayGuard><Navigate to="/specialist/updates" replace /></TutorGatewayGuard>} />
      <Route path="/operational/tutor/gateway" element={<RedirectWithSearch to="/operational/specialist/gateway" />} />
      <Route path="/operational/tutor/dashboard" element={<TutorGatewayGuard><Navigate to="/specialist/pod" replace /></TutorGatewayGuard>} />
      <Route path="/operational/tutor/my-pod" element={<TutorGatewayGuard><Navigate to="/specialist/pod" replace /></TutorGatewayGuard>} />
      <Route path="/tutor/blueprint" element={<TutorGatewayGuard><DashboardLayout><TutorBlueprint /></DashboardLayout></TutorGatewayGuard>} />
      <Route path="/specialist/blueprint" element={<TutorGatewayGuard><DashboardLayout><TutorBlueprint /></DashboardLayout></TutorGatewayGuard>} />
      <Route path="/operational/tutor/response-integrity-os" element={<RedirectWithSearch to="/operational/specialist/response-integrity-os" />} />
      <Route path="/operational/tutor/tt-os" element={<RedirectWithSearch to="/operational/specialist/response-integrity-os" />} />
      <Route path="/operational/tutor/growth" element={<TutorGatewayGuard><Navigate to="/specialist/growth" replace /></TutorGatewayGuard>} />
      <Route path="/operational/tutor/academic-tracker" element={<TutorGatewayGuard><Navigate to="/specialist/academics" replace /></TutorGatewayGuard>} />
      <Route path="/operational/tutor/sessions" element={<TutorGatewayGuard><Navigate to="/specialist/sessions" replace /></TutorGatewayGuard>} />
      <Route path="/operational/tutor/profile" element={<TutorGatewayGuard><Navigate to="/specialist/profile" replace /></TutorGatewayGuard>} />
      <Route path="/operational/tutor/updates" element={<TutorGatewayGuard><Navigate to="/specialist/updates" replace /></TutorGatewayGuard>} />

      {/* TD Routes */}
      <Route path="/operational/td/landing" element={<TdLanding />} />
      <Route path="/operational/td/signup" element={<TdSignup />} />
      <Route path="/operational/td/gateway" element={<TdGateway />} />
      <Route path="/operational/td/dashboard" element={<TdGatewayGuard><OperationalTDDashboard /></TdGatewayGuard>} />
      <Route path="/operational/td/no-pod" element={<TdGatewayGuard><TDNoPod /></TdGatewayGuard>} />
      <Route path="/operational/td/my-pods" element={<TdGatewayGuard><DashboardLayout><TDOverview /></DashboardLayout></TdGatewayGuard>} />
      <Route path="/operational/td/my-pods/:podId" element={<TdGatewayGuard><DashboardLayout><TDOverview /></DashboardLayout></TdGatewayGuard>} />
      <Route path="/operational/td/reports" element={<TdGatewayGuard><DashboardLayout><TDReports /></DashboardLayout></TdGatewayGuard>} />
      <Route path="/operational/td/updates" element={<TdGatewayGuard><DashboardLayout><TDUpdates /></DashboardLayout></TdGatewayGuard>} />

      {/* ==================== AFFILIATE PORTAL ==================== */}
      {/* Affiliate Landing */}
      <Route path="/affiliate/landing" element={<AffiliateLandingPage />} />
      <Route path="/affiliate/gateway" element={<AffiliateGateway />} />
      <Route path="/contributor/landing" element={<ContributorLanding />} />
      <Route path="/contributor/gateway" element={<ContributorGateway />} />
      {/* Affiliate Signup */}
      <Route path="/affiliate/signup" element={<AffiliateSignup />} />

      {/* Affiliate Routes */}
      <Route path="/affiliate/affiliate/home" element={<AffiliateDashboard />} />
      <Route path="/affiliate/affiliate/discover-deliver" element={<AffiliateDiscoverDeliver />} />
      <Route path="/affiliate/affiliate/tracking" element={<AffiliateTracking />} />
      <Route path="/affiliate/affiliate/updates" element={<AffiliateUpdates />} />
      <Route path="/contributor/contributor/home" element={<ContributorHome />} />
      <Route path="/contributor/contributor/tracking" element={<ContributorTracking />} />
      <Route path="/contributor/contributor/updates" element={<ContributorUpdates />} />

      {/* Outreach Director Routes */}
      <Route path="/affiliate/od/dashboard" element={<OutreachDirectorDashboard />} />
      <Route path="/affiliate/od/encounters" element={<ODEncounters />} />
      <Route path="/affiliate/od/crews" element={<ODCrews />} />
      <Route path="/affiliate/od/affiliates" element={<ODAffiliates />} />
      <Route path="/affiliate/od/updates" element={<ODUpdates />} />

      {/* ==================== EXECUTIVE PORTAL ==================== */}
      {/* Executive Landing */}
      <Route path="/executive" element={<ExecutiveLanding />} />
      <Route path="/executive/landing" element={<ExecutiveLanding />} />
      {/* Executive Signup */}
      <Route path="/executive/signup" element={<ExecutiveSignup />} />
      {/* Executive Legal */}
      <Route path="/executive/recruitment-privacy" element={<RecruitmentPrivacy />} />
      <Route path="/executive/gateway" element={<DashboardLayout><ExecutiveGateway /></DashboardLayout>} />
      <Route path="/executive/dashboard" element={<Navigate to="/executive/gateway" replace />} />

      {/* COO Routes */}
      <Route path="/executive/coo/dashboard" element={<ExecutiveSeatGuard role="coo"><DashboardLayout><ExecutiveCOODashboard /></DashboardLayout></ExecutiveSeatGuard>} />
      <Route path="/executive/coo/command-rhythm" element={<ExecutiveSeatGuard role="coo"><DashboardLayout><ExecutiveCommandRhythmDashboard /></DashboardLayout></ExecutiveSeatGuard>} />
      <Route path="/executive/coo/traffic" element={<ExecutiveSeatGuard role="coo"><DashboardLayout><ExecutiveHRTraffic /></DashboardLayout></ExecutiveSeatGuard>} />
      <Route path="/executive/coo/applications" element={<Navigate to="/executive/coo/traffic" replace />} />
      <Route path="/executive/coo/pods" element={<ExecutiveSeatGuard role="coo"><COOPods /></ExecutiveSeatGuard>} />
      <Route path="/executive/coo/brain" element={<ExecutiveSeatGuard role="coo"><COOBrain /></ExecutiveSeatGuard>} />
      <Route path="/executive/coo/broadcast" element={<ExecutiveSeatGuard role="coo"><COOBroadcast /></ExecutiveSeatGuard>} />
      <Route path="/executive/coo/track-leads" element={<ExecutiveSeatGuard role="coo"><ExecutiveCOOTrackLeads /></ExecutiveSeatGuard>} />

      {/* HR Routes */}
      <Route path="/executive/hr/dashboard" element={<ExecutiveSeatGuard role="hr"><DashboardLayout><ExecutiveHRDashboard /></DashboardLayout></ExecutiveSeatGuard>} />
      <Route path="/executive/hr/traffic" element={<ExecutiveSeatGuard role="hr"><DashboardLayout><ExecutiveHRTraffic /></DashboardLayout></ExecutiveSeatGuard>} />
      <Route path="/executive/hr/updates" element={<ExecutiveSeatGuard role="hr"><DashboardLayout><ExecutiveHRUpdates /></DashboardLayout></ExecutiveSeatGuard>} />
      <Route path="/executive/hr/applications" element={<ExecutiveSeatGuard role="hr"><DashboardLayout><ExecutiveHRApplications /></DashboardLayout></ExecutiveSeatGuard>} />
      <Route path="/executive/hr/brain" element={<ExecutiveSeatGuard role="hr"><DashboardLayout><ExecutiveHRBrain /></DashboardLayout></ExecutiveSeatGuard>} />
      <Route path="/executive/hr/disputes" element={<ExecutiveSeatGuard role="hr"><DashboardLayout><ExecutiveHRDisputes /></DashboardLayout></ExecutiveSeatGuard>} />

      {/* CEO Routes */}
      <Route path="/executive/ceo/board" element={<DashboardLayout><ExecutiveCEOBoard /></DashboardLayout>} />
      <Route path="/executive/ceo/dashboard" element={<ExecutiveSeatGuard role="ceo"><DashboardLayout><ExecutiveCommandRhythmDashboard /></DashboardLayout></ExecutiveSeatGuard>} />
      <Route path="/executive/cto/dashboard" element={<ExecutiveSeatGuard role="cto"><DashboardLayout><ExecutiveCommandRhythmDashboard /></DashboardLayout></ExecutiveSeatGuard>} />
      <Route path="/executive/cmo/dashboard" element={<ExecutiveSeatGuard role="cmo"><DashboardLayout><ExecutiveCommandRhythmDashboard /></DashboardLayout></ExecutiveSeatGuard>} />

      {/* ==================== MEDIA PORTAL ==================== */}
      <Route path="/media" element={<MediaLanding />} />
      <Route path="/media/carousel/library" element={<CarouselLibrary />} />
      <Route path="/media/carousel/select" element={<CarouselSelect />} />
      <Route path="/media/carousel/create" element={<CarouselCreate />} />

      {/* ==================== LEGACY ROUTES (Backwards Compatibility) ==================== */}
      {/* Legacy Tutor Routes */}
      <Route path="/specialist/pod" element={<TutorGatewayGuard><TutorPod /></TutorGatewayGuard>} />
      <Route path="/specialist/growth" element={<TutorGatewayGuard><TutorGrowth /></TutorGatewayGuard>} />
      <Route path="/specialist/academics" element={<TutorGatewayGuard><TutorAcademics /></TutorGatewayGuard>} />
      <Route path="/specialist/sessions" element={<TutorGatewayGuard><TutorSessions /></TutorGatewayGuard>} />
      <Route path="/specialist/profile" element={<TutorGatewayGuard><TutorProfile /></TutorGatewayGuard>} />
      <Route path="/specialist/updates" element={<TutorGatewayGuard><DashboardLayout><TutorUpdates /></DashboardLayout></TutorGatewayGuard>} />
      <Route path="/tutor/pod" element={<TutorGatewayGuard><TutorPod /></TutorGatewayGuard>} />
      <Route path="/tutor/growth" element={<TutorGatewayGuard><TutorGrowth /></TutorGatewayGuard>} />
      <Route path="/tutor/academics" element={<TutorGatewayGuard><TutorAcademics /></TutorGatewayGuard>} />
      <Route path="/tutor/sessions" element={<TutorGatewayGuard><TutorSessions /></TutorGatewayGuard>} />
      <Route path="/tutor/profile" element={<TutorGatewayGuard><TutorProfile /></TutorGatewayGuard>} />
      <Route path="/tutor/updates" element={<TutorGatewayGuard><DashboardLayout><TutorUpdates /></DashboardLayout></TutorGatewayGuard>} />

      {/* Legacy TD Routes */}
      <Route path="/tutor/landing" element={<RedirectWithSearch to="/operational/specialist/landing" />} />
      <Route path="/td/landing" element={<Navigate to="/operational/td/landing" replace />} />
      <Route path="/td/signup" element={<Navigate to="/operational/td/signup" replace />} />
      <Route path="/td/no-pod" element={<TdGatewayGuard><TDNoPod /></TdGatewayGuard>} />
      <Route path="/td/dashboard" element={<TdGatewayGuard><TDDashboard /></TdGatewayGuard>} />
      <Route path="/td/overview" element={<TdGatewayGuard><DashboardLayout><TDOverview /></DashboardLayout></TdGatewayGuard>} />
      <Route path="/td/overview/:podId" element={<TdGatewayGuard><DashboardLayout><TDOverview /></DashboardLayout></TdGatewayGuard>} />
      <Route path="/td/tutors" element={<TdGatewayGuard><TDTutors /></TdGatewayGuard>} />
      <Route path="/td/reports" element={<TdGatewayGuard><TDReports /></TdGatewayGuard>} />
      <Route path="/td/updates" element={<TdGatewayGuard><TDUpdates /></TdGatewayGuard>} />

      {/* Legacy COO Routes */}
      <Route path="/coo/dashboard" element={<DashboardLayout><COODashboard /></DashboardLayout>} />
      <Route path="/coo/traffic" element={<DashboardLayout><ExecutiveHRTraffic /></DashboardLayout>} />
      <Route path="/coo/applications" element={<Navigate to="/coo/traffic" replace />} />
      <Route path="/coo/tutor-applications" element={<Navigate to="/coo/traffic" replace />} />
      <Route path="/coo/pods" element={<COOPods />} />
      <Route path="/coo/pods/:podId" element={<COOPodDetail />} />
      <Route path="/coo/verification" element={<COOVerification />} />
      <Route path="/coo/brain" element={<COOBrain />} />
      <Route path="/coo/broadcast" element={<COOBroadcast />} />
      <Route path="/coo/leadership-pilot-requests" element={<DashboardLayout><LeadershipPilotRequests /></DashboardLayout>} />

      {/* 404 Route */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function App() {
  console.log("App component rendering...");
  
  return (
    <PersistQueryClientProvider 
      client={queryClient} 
      persistOptions={{ persister }}
    >
      <TooltipProvider>
        <ScrollToTop />
        <RecoveryCodeRedirect />
        <RouteSeoManager />
        <OfflineIndicator />
        <Toaster />
        <Router />
      </TooltipProvider>
    </PersistQueryClientProvider>
  );
}

