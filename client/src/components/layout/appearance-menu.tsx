import { useState } from "react";
import {
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, ChevronRight, ChevronUp, Palette } from "lucide-react";
import { useRITheme } from "@/lib/riTheme";
import { useIsMobile } from "@/hooks/use-mobile";

export function AppearanceMenu() {
  const { theme, setTheme } = useRITheme();
  const isMobile = useIsMobile();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleThemeChange = (value: string) => {
    if (value === "light" || value === "warm-dark" || value === "dark") {
      setTheme(value);
    }
  };

  const options = (
    <DropdownMenuRadioGroup value={theme} onValueChange={handleThemeChange}>
      <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="warm-dark">
        Warm Dark
      </DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
    </DropdownMenuRadioGroup>
  );

  if (isMobile) {
    return (
      <>
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            setIsExpanded((expanded) => !expanded);
          }}
          className="gap-2 font-medium"
          aria-expanded={isExpanded}
        >
          <Palette className="h-4 w-4" />
          Appearance
          {isExpanded ? (
            <ChevronUp className="ml-auto h-4 w-4" />
          ) : (
            <ChevronDown className="ml-auto h-4 w-4" />
          )}
        </DropdownMenuItem>
        {isExpanded && (
          <div className="px-1 pb-1" data-testid="appearance-mobile-options">
            {options}
          </div>
        )}
      </>
    );
  }

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="gap-2 font-medium">
        <Palette className="h-4 w-4" />
        Appearance
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent
        side="right"
        align="start"
        sideOffset={4}
        className="min-w-[10rem] max-w-[calc(100vw-1rem)]"
      >
        {options}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
