import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { useEffect } from "react";

export default function ContributorHome() {
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: gatewaySession } = useQuery<any>({
    queryKey: ["/api/affiliate/gateway-session"],
  });

  useEffect(() => {
    const status = gatewaySession?.applicationStatus?.status;
    if (status && status !== "confirmed") {
      window.location.href = "/contributor/gateway";
    }
  }, [gatewaySession]);

  // Compatibility note: contributor template still uses affiliate endpoints in MVP.
  const { data: codeData } = useQuery<{ code: string; link?: string; pipelineType?: string }>({
    queryKey: ["/api", "affiliate", "code"],
  });

  const { data: stats } = useQuery<{ encounters: number; leads: number; closes: number }>({
    queryKey: ["/api", "affiliate", "stats"],
  });

  const handleCopyCode = () => {
    if (codeData?.code) {
      navigator.clipboard.writeText(codeData.code);
      toast({
        title: "Copied.",
        description: "Your contributor code has been copied to clipboard",
      });
    }
  };

  const handleCopyLink = () => {
    if (codeData?.code) {
      const productionLink = codeData.link || `${window.location.origin}/?production=${encodeURIComponent(codeData.code)}&pipeline=${codeData.pipelineType || "demand"}`;
      navigator.clipboard.writeText(productionLink);
      toast({
        title: "Link Copied.",
        description: "Share this production link to track contributor performance",
      });
    }
  };

  const firstName = user?.firstName || user?.name?.split(" ")[0] || "Contributor";

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-8">
        <div className="space-y-2 sm:space-y-3">
          <h1 className="text-xl sm:text-3xl md:text-4xl font-bold tracking-tight">
            Welcome back, {firstName}.
          </h1>
          <p className="text-sm sm:text-lg text-muted-foreground">
            Track every opportunity, qualification, trial, and subscription from your production link.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:gap-6">
          <Card className="p-3 sm:p-8 border shadow-sm hover-elevate text-center">
            <p className="text-2xl sm:text-5xl font-bold text-foreground">{stats?.leads || 0}</p>
            <p className="text-[10px] sm:text-sm text-muted-foreground uppercase tracking-wide font-medium mt-1">
              Leads
            </p>
          </Card>
          <Card className="p-3 sm:p-8 border shadow-sm hover-elevate text-center">
            <p className="text-2xl sm:text-5xl font-bold text-foreground">{stats?.closes || 0}</p>
            <p className="text-[10px] sm:text-sm text-muted-foreground uppercase tracking-wide font-medium mt-1">
              Subscriptions
            </p>
          </Card>
        </div>

        <Card className="p-4 sm:p-8 border shadow-sm">
          <div className="space-y-3 sm:space-y-4">
            <div>
              <h2 className="text-base sm:text-xl font-bold mb-1 sm:mb-2">Your Production Link</h2>
              <p className="text-xs sm:text-base text-muted-foreground">
                Share this link to attribute demand production to your contributor line.
              </p>
            </div>
            <div className="flex gap-2 flex-col sm:flex-row">
              <div className="flex-1 bg-background border rounded-lg p-3 sm:p-4 text-left font-mono text-xs sm:text-sm break-all">
                {codeData?.code ? (codeData.link || `${window.location.origin}/?production=${encodeURIComponent(codeData.code)}&pipeline=${codeData.pipelineType || "demand"}`) : "Loading..."}
              </div>
              <Button onClick={handleCopyLink} variant="default" size="default" className="gap-2 px-3 sm:px-4 whitespace-nowrap">
                <Copy className="w-4 h-4" />
                <span className="hidden sm:inline">Copy Link</span>
                <span className="sm:hidden">Copy</span>
              </Button>
            </div>

            <div className="pt-3 sm:pt-4 border-t">
              <p className="text-xs sm:text-sm text-muted-foreground mb-2">Your contributor code (reference):</p>
              <div className="flex gap-2">
                <div className="flex-1 bg-background border rounded-lg p-3 sm:p-4 text-center font-mono font-bold text-base sm:text-lg">
                  {codeData?.code || "Loading..."}
                </div>
                <Button onClick={handleCopyCode} variant="outline" size="default" className="gap-2 px-3 sm:px-4">
                  <Copy className="w-4 h-4" />
                  <span className="hidden sm:inline">Copy Code</span>
                  <span className="sm:hidden">Copy</span>
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
