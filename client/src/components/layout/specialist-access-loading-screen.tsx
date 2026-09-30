import { ResponseIntegrityLogo } from "@/components/ResponseIntegrityLogo";
import { RISymbolLogo } from "@/components/RISymbolLogo";

export function SpecialistAccessLoadingScreen({
  label = "Loading specialist access...",
}: {
  label?: string;
}) {
  return (
    <div className="ri-world-page ri-specialist-world flex min-h-screen items-center justify-center bg-background text-foreground">
      <div
        className="flex flex-col items-center text-center"
        role="status"
        aria-live="polite"
      >
        <RISymbolLogo size="xl" className="mb-3" />
        <ResponseIntegrityLogo
          size="md"
          variant="integrity"
          inkColor="hsl(var(--foreground))"
        />
        <div className="mt-5 h-10 w-10 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />
        <p className="mt-4 text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
