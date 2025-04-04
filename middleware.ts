import { clerkMiddleware } from "@clerk/nextjs/server";
import { createClerkClient } from "@clerk/backend"; 
import { NextResponse } from "next/server";

// Create a Clerk client instance with the required options
const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

const publicRoutes = ["/", "/api/webhook/register", "/sign-in", "/sign-up"];

export default clerkMiddleware(async (auth, req) => {
  // Handle public routes
  if (publicRoutes.includes(req.nextUrl.pathname)) {
    return NextResponse.next();
  }

  // Auth handling
  const session = await auth();
  if (!session.userId) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  // Fetch user data
  try {
    const user = await clerkClient.users.getUser(session.userId); // Use the instantiated clerkClient
    const role = user.publicMetadata.role as string | undefined;

    // Admin routing logic
    if (req.nextUrl.pathname.startsWith("/admin") && role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    // Role-based redirects
    if (role === "admin" && req.nextUrl.pathname === "/dashboard") {
      return NextResponse.redirect(new URL("/admin/dashboard", req.url));
    }

  } catch (error) {
    console.error("Authentication error:", error);
    return NextResponse.redirect(new URL("/error", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
