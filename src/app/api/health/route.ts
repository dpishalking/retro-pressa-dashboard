import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const memory = process.memoryUsage();

  return NextResponse.json(
    {
      status: "ok",
      role: process.env.RPBI_PROCESS_ROLE || "web",
      uptimeSeconds: Math.round(process.uptime()),
      memoryMb: {
        rss: Math.round(memory.rss / 1024 / 1024),
        heapUsed: Math.round(memory.heapUsed / 1024 / 1024)
      },
      timestamp: new Date().toISOString()
    },
    {
      headers: {
        "cache-control": "no-store"
      }
    }
  );
}
