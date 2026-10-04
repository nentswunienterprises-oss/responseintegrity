import { Link } from "react-router-dom";
import type { User } from "@shared/schema";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Palette, Shield } from "lucide-react";
import { getRoleName, isTD, isTutor } from "@/lib/roles";
import { logout } from "@/lib/auth";
import { useRITheme } from "@/lib/riTheme";

interface AccountMenuProps {
  user?: User;
  onLogIssue?: () => void;
  showIssueAction?: boolean;
}

function getUserFullName(user?: User) {
  if (!user) return "User";
  if (user.name?.trim()) return user.name;
  if (user.firstName && user.lastName) return `${user.firstName} ${user.lastName}`;
  if (user.firstName) return user.firstName;
  if (user.email) return user.email.split("@")[0];
  return "User";
}

function getUserFirstName(user?: User) {
  return getUserFullName(user).split(" ")[0] || "User";
}

function getInitials(user?: User) {
  if (!user) return "U";
  if (user.firstName && user.lastName) {
    return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  }
  if (user.name?.trim()) {
    return user.name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return user.email?.[0]?.toUpperCase() || "U";
}

export function AccountMenu({
  user,
  onLogIssue,
  showIssueAction = false,
}: AccountMenuProps) {
  const { theme, setTheme } = useRITheme();
  const showAppearance = isTutor(user) || isTD(user);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="gap-2 hover-elevate"
          data-testid="button-user-menu"
          aria-label="Open account menu"
        >
          <Avatar className="w-9 h-9 border-2 border-primary/20">
            <AvatarImage
              src={user?.profileImageUrl || undefined}
              alt={getUserFullName(user)}
            />
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
              {getInitials(user)}
            </AvatarFallback>
          </Avatar>
          <span
            className="hidden sm:inline text-sm font-semibold"
            data-testid="text-user-first-name"
          >
            {getUserFirstName(user)}
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <div className="flex items-center gap-3 py-2">
            <Avatar className="w-12 h-12 border-2 border-primary/20">
              <AvatarImage
                src={user?.profileImageUrl || undefined}
                alt={getUserFullName(user)}
              />
              <AvatarFallback className="bg-primary/10 text-primary font-bold">
                {getInitials(user)}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col space-y-1">
              <p
                className="truncate text-sm font-semibold leading-none"
                data-testid="text-user-full-name"
              >
                {getUserFullName(user)}
              </p>
              <p className="truncate text-xs leading-none text-muted-foreground">
                {user?.email}
              </p>
            </div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <div className="flex items-center justify-between px-2 py-2">
          <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
            {user?.role ? getRoleName(user.role) : "Unknown"}
          </Badge>
          {isTutor(user) && (
            <DropdownMenuItem asChild className="p-0">
              <Link
                to="/specialist/profile"
                className="cursor-pointer text-xs font-semibold text-primary hover:text-primary/80"
              >
                View Profile
              </Link>
            </DropdownMenuItem>
          )}
        </div>

        <DropdownMenuSeparator />

        {showAppearance && (
          <>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="gap-2 font-medium">
                <Palette className="w-4 h-4" />
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
          </>
        )}

        {showIssueAction && onLogIssue && (
          <>
            <DropdownMenuItem
              onClick={onLogIssue}
              className="gap-2 font-medium"
            >
              <Shield className="w-4 h-4" />
              Log Issue
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuItem
          onClick={() => logout(user)}
          className="text-destructive gap-2 font-medium"
          data-testid="button-logout"
        >
          <LogOut className="w-4 h-4" />
          Log Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
