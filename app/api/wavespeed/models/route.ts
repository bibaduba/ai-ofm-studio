import { NextResponse } from "next/server";
import { createId, db, now, type WavespeedModelRecord } from "@/app/lib/db";

export async function GET() {
  const models = db
    .prepare("SELECT * FROM wavespeed_models ORDER BY updatedAt DESC")
    .all() as WavespeedModelRecord[];

  return NextResponse.json(models);
}

export async function POST(request: Request) {
  const body = await request.json();
  const name = String(body.name || "").trim();
  const faceReferences = Array.isArray(body.faceReferences) ? body.faceReferences : [];
  const bodyReferences = Array.isArray(body.bodyReferences) ? body.bodyReferences : [];

  if (!name || faceReferences.length === 0 || bodyReferences.length === 0) {
    return NextResponse.json(
      { error: "Name, face references and body references are required." },
      { status: 400 }
    );
  }

  const timestamp = now();
  const model = {
    id: createId(),
    name,
    faceReferences: JSON.stringify(faceReferences.slice(0, 2)),
    bodyReferences: JSON.stringify(bodyReferences.slice(0, 2)),
    createdAt: timestamp,
    updatedAt: timestamp
  };

  db.prepare(
    `INSERT INTO wavespeed_models
      (id, name, faceReferences, bodyReferences, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    model.id,
    model.name,
    model.faceReferences,
    model.bodyReferences,
    model.createdAt,
    model.updatedAt
  );

  return NextResponse.json(model);
}
