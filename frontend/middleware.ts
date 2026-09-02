import { NextResponse, type NextRequest } from "next/server";

const publicRoutes = new Set(["/", "/home", "/login", "/register", "/forgot-password", "/combo"]);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (publicRoutes.has(pathname) || pathname.startsWith("/home/")) return NextResponse.next();

  const session = request.cookies.get("pan_session")?.value
    ?? request.cookies.get("access_token")?.value
    ?? request.cookies.get("access_token_cookie")?.value;
  if (!session) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  if (pathname.startsWith("/admin") && request.cookies.get("pan_role")?.value !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|js|css|woff|woff2|webmanifest|json)$).*)"],
};
