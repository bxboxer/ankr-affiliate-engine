import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

export async function GET() {
  const response = NextResponse.redirect(new URL("/login", "http://localhost:3000"));
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
