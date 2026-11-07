"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

// Hell, dunkel oder wie das System. Die Wahl wird im Browser gespeichert.
// Setzt die Klasse "dark" auf <html>, die Farben stehen in globals.css.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}
