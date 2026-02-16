import { NextResponse } from "next/server";

const SUPABASE_BASE = "https://kxqbkbdmwtihdhcwhuxq.supabase.co/storage/v1/object/public/nehal-doom/sounds";

export async function GET() {
  return NextResponse.json({
    tracks: [
      { name: "background", path: `${SUPABASE_BASE}/background.m4a` },
      { name: "mansion", path: `${SUPABASE_BASE}/mansion.m4a` },
    ],
  });
}
