import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/auth";
import { db } from "@/app/lib/db";
import { mediaAsDataUrl } from "@/app/lib/media-storage";

export async function GET() {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profiles = db.prepare("SELECT * FROM profiles WHERE userId = ? ORDER BY createdAt").all(user.id);
  const generations = db.prepare(
    `SELECT generations.* FROM generations
     JOIN profiles ON profiles.id = generations.profileId
     WHERE profiles.userId = ? ORDER BY generations.createdAt`
  ).all(user.id);
  const wavespeedModels = db.prepare(
    "SELECT * FROM wavespeed_models WHERE userId = ? ORDER BY createdAt"
  ).all(user.id);
  const wavespeedGenerations = db.prepare(
    "SELECT * FROM wavespeed_generations WHERE userId = ? ORDER BY createdAt"
  ).all(user.id) as Array<Record<string, unknown>>;

  const portableWavespeedGenerations = await Promise.all(wavespeedGenerations.map(async (generation) => {
    let outputs: string[] = [];
    try {
      const parsed = JSON.parse(String(generation.resultImages || "[]"));
      if (Array.isArray(parsed)) outputs = parsed.filter((value): value is string => typeof value === "string");
    } catch {
      outputs = [];
    }
    return {
      ...generation,
      resultImages: JSON.stringify(await Promise.all(outputs.map((source) => mediaAsDataUrl(user.id, source))))
    };
  }));

  return NextResponse.json({
    version: 1,
    exportedAt: new Date().toISOString(),
    owner: user.username,
    data: { profiles, generations, wavespeedModels, wavespeedGenerations: portableWavespeedGenerations }
  });
}
