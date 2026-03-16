import { auth } from "@/lib/auth";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Allow public routes
  if (
    pathname === "/" ||
    pathname === "/login" ||
    pathname.startsWith("/api/v1/") ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/stripe/webhook")
  ) {
    return;
  }

  // Protect /dashboard/* routes
  if (pathname.startsWith("/dashboard") && !req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return Response.redirect(loginUrl);
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
