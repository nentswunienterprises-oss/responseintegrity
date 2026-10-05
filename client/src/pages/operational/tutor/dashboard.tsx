import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export default function OperationalTutorDashboard() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/operational/signup");
    }
  }, [isAuthenticated, isLoading, navigate]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Specialist Dashboard</h1>
      </div>

      <div className="grid gap-6">
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-xl font-semibold mb-4">Welcome to Your Dashboard</h2>
          <p className="text-muted-foreground">Manage your pod, sessions, and student progress.</p>
        </div>
      </div>
    </div>
  );
}
