import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // run on everything except static assets & the manifest
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon-|.*\\.(?:png|jpg|jpeg|svg|webp)$).*)",
  ],
};
