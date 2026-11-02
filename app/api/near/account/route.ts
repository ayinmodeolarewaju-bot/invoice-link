import { NextResponse } from "next/server";
import { checkNearAccount } from "@/lib/validate";
export const runtime = "nodejs";
// GET ?id=name.near  ->  { exists, error? } via NEAR mainnet RPC view_account (1-Click pays out on mainnet)
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  try { return NextResponse.json(await checkNearAccount(id, "mainnet")); }
  catch (e) { return NextResponse.json({ exists: null, error: (e as Error).message }, { status: 502 }); }
}
