import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DoorOpen, Menu } from "lucide-react";
import { AppearanceMenu } from "@/components/layout/appearance-menu";

export function SpecialistGatewayMenu() {
  const navigate = useNavigate();

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          aria-label="Open gateway menu"
          data-testid="button-gateway-menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-48">
        <AppearanceMenu />

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => navigate("/operational/specialist/landing")}
          className="gap-2 font-medium"
          data-testid="button-exit-gateway"
        >
          <DoorOpen className="h-4 w-4" />
          Exit Gateway
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
