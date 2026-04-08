import { isBlobStorageEnabled } from "@/lib/file-storage";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ enabled: isBlobStorageEnabled() });
}
