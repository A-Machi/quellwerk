"use client";

import { ChevronDown, LogOut } from "lucide-react";
import { useTransition } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/frontend/components/ui/dropdown-menu";
import { avatarHue, initialsFromEmail } from "@/frontend/lib/user";
import { cn } from "@/frontend/lib/utils";

// Konto-Menü in der Kopfzeile: zeigt, wer eingeloggt ist, und bietet das Abmelden an.
export function AccountMenu({
  email,
  signOutAction,
}: {
  email: string;
  signOutAction: () => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Konto von ${email}`}
        className="group/account flex items-center gap-2 rounded-full py-1 pr-2 pl-1 text-sm transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:bg-muted"
        data-testid="account-menu"
      >
        <Avatar email={email} />
        <span className="hidden max-w-48 truncate text-muted-foreground group-hover/account:text-foreground lg:block">
          {email}
        </span>
        <ChevronDown
          className="size-3.5 text-muted-foreground transition-transform group-data-popup-open/account:rotate-180"
          aria-hidden
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="flex items-center gap-3 px-2 py-2.5">
          <Avatar email={email} size="lg" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Angemeldet als</p>
            <p className="truncate text-sm font-medium" title={email}>
              {email}
            </p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={pending}
          onClick={() => startTransition(() => signOutAction())}
        >
          <LogOut />
          {pending ? "Wird abgemeldet …" : "Abmelden"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Avatar({ email, size = "sm" }: { email: string; size?: "sm" | "lg" }) {
  return (
    <span
      aria-hidden
      style={{ "--avatar-hue": avatarHue(email) } as React.CSSProperties}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-wide ring-1 ring-inset",
        "bg-[oklch(0.93_0.05_var(--avatar-hue))] text-[oklch(0.38_0.1_var(--avatar-hue))] ring-[oklch(0.38_0.1_var(--avatar-hue)/0.15)]",
        "dark:bg-[oklch(0.36_0.07_var(--avatar-hue))] dark:text-[oklch(0.93_0.05_var(--avatar-hue))] dark:ring-[oklch(0.93_0.05_var(--avatar-hue)/0.15)]",
        size === "sm" ? "size-7 text-[11px]" : "size-10 text-sm",
      )}
    >
      {initialsFromEmail(email)}
    </span>
  );
}
