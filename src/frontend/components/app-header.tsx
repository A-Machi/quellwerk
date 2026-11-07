import { LogOut } from "lucide-react";
import Link from "next/link";

import { ThemeToggle } from "@/frontend/components/theme-toggle";
import { Button } from "@/frontend/components/ui/button";

// Kopfzeile aller eingeloggten Seiten. `children` steht rechts neben dem Logo,
// z. B. der Notebook-Titel.
export function AppHeader({
  signOutAction,
  usage,
  children,
}: {
  signOutAction: () => Promise<void>;
  usage?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <Link href="/" className="font-semibold">
        Quellwerk
      </Link>
      {children ? (
        <>
          <span className="text-muted-foreground">/</span>
          <div className="min-w-0 flex-1">{children}</div>
        </>
      ) : (
        <div className="flex-1" />
      )}
      {usage}
      <ThemeToggle />
      <form action={signOutAction}>
        <Button type="submit" variant="ghost" size="sm">
          <LogOut />
          Abmelden
        </Button>
      </form>
    </header>
  );
}
