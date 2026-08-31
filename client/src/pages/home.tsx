import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { isTutor, isTD, isCOO } from "@/lib/roles";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      // Not logged in - redirected to landing by Router
      return;
    }

    // Redirect based on role
    if (isTutor(user)) {
      setLocation("/specialist/pod");
    } else if (isTD(user)) {
      setLocation("/td/overview");
    } else if (isCOO(user)) {
      setLocation("/coo/dashboard");
    }
  }, [user, isLoading, setLocation]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="space-y-4 max-w-md">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-8 w-2/3" />
      </div>
    </div>
  );
}
