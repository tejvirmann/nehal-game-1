import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  const soundsDir = path.join(process.cwd(), "public", "sounds");

  try {
    const files = fs.readdirSync(soundsDir);
    const soundFiles = files.filter((f) =>
      /\.(mp3|wav|ogg|webm|m4a)$/i.test(f)
    );
    return NextResponse.json({ sounds: soundFiles.map((f) => `/sounds/${f}`) });
  } catch {
    return NextResponse.json({ sounds: [] });
  }
}
