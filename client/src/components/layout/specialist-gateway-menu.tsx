import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DoorOpen, Menu, Palette } from "lucide-react";
import { useRITheme } from "@/lib/riTheme";

export function SpecialistGatewayMenu() {
  const navigate = useNavigate();
  const { theme, setTheme } = useRITheme();

  return (
    <DropdownMenu>
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
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2 font-medium">
            <Palette className="h-4 w-4" />
            Appearance
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="min-w-[10rem]">
            <DropdownMenuRadioGroup
              value={theme}
              onValueChange={(value) => {
                if (
                  value === "light" ||
                  value === "warm-dark" ||
                  value === "dark"
                ) {
                  setTheme(value);
                }
              }}
            >
              <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="warm-dark">
                Warm Dark
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

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
