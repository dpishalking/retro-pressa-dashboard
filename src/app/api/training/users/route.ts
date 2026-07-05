import { NextResponse } from "next/server";
import { listTrainingUsers } from "@/lib/training/store";

export async function GET() {
  return NextResponse.json({ users: listTrainingUsers() });
}
