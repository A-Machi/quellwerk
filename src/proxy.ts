import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Läuft vor jeder Anfrage:
// - erneuert die Supabase-Session (Token-Refresh landet in den Cookies)
// - schickt nicht eingeloggte Nutzer zur Login-Seite, API-Aufrufe bekommen 401
// - schickt eingeloggte Nutzer von /login zur Startseite
// Das ist nur die erste Hürde: Seiten und Actions prüfen die Session selbst noch einmal.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  let cookiesRefreshed = false;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesRefreshed = true;
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims?.sub);
  const { pathname } = request.nextUrl;
  const isLoginPage = pathname === "/login";

  const withCookies = (target: NextResponse) => {
    for (const cookie of response.cookies.getAll()) target.cookies.set(cookie);
    return target;
  };

  if (!isLoggedIn && !isLoginPage) {
    if (pathname.startsWith("/api/")) {
      return withCookies(NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 }));
    }
    return withCookies(NextResponse.redirect(new URL("/login", request.url)));
  }

  if (isLoggedIn && isLoginPage) {
    return withCookies(NextResponse.redirect(new URL("/", request.url)));
  }

  // Antworten mit erneuertem Token dürfen nicht im CDN landen.
  if (cookiesRefreshed) response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
