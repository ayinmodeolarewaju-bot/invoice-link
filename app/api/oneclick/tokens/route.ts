import { NextResponse } from "next/server";
import { getTokens, isMock } from "@/lib/oneclick";
export const runtime = "nodejs";
// Proxies GET https://1click.chaindefuser.com/v0/tokens (public; cached 5 min)
export async function GET() {
  const { tokens, live } = await getTokens();
  return NextResponse.json({ live, mock: isMock(), tokens });
}
