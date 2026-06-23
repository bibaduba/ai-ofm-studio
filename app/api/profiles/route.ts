import { NextResponse } from "next/server";
import { createId, db, now, type ProfileRecord } from "@/app/lib/db";

export async function GET() {
  const profiles = db
    .prepare("SELECT * FROM profiles ORDER BY updatedAt DESC")
    .all() as ProfileRecord[];

  if (profiles.length === 0) {
    const timestamp = now();
    const profile = {
      id: createId(),
      name: "Personal",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    db.prepare(
      "INSERT INTO profiles (id, name, createdAt, updatedAt) VALUES (?, ?, ?, ?)"
    ).run(profile.id, profile.name, profile.createdAt, profile.updatedAt);
    return NextResponse.json([profile]);
  }

  return NextResponse.json(profiles);
}

export async function POST(request: Request) {
  const { name } = await request.json();
  const trimmedName = String(name || "").trim();

  if (!trimmedName) {
    return NextResponse.json({ error: "Profile name is required." }, { status: 400 });
  }

  const existing = db
    .prepare("SELECT * FROM profiles WHERE name = ?")
    .get(trimmedName) as ProfileRecord | undefined;

  if (existing) {
    return NextResponse.json(existing);
  }

  const timestamp = now();
  const profile = {
    id: createId(),
    name: trimmedName,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  db.prepare("INSERT INTO profiles (id, name, createdAt, updatedAt) VALUES (?, ?, ?, ?)").run(
    profile.id,
    profile.name,
    profile.createdAt,
    profile.updatedAt
  );

  return NextResponse.json(profile);
}
