import { NextResponse } from "next/server";
import { listGeminiModels } from "@/app/lib/gemini";

const IMAGE_MODEL_IDS = ["gemini-2.5-flash-image", "gemini-3-pro-image-preview"];
const VIDEO_MODEL_IDS = [
  "veo-3.1-fast-generate-preview",
  "veo-3.1-generate-preview",
  "veo-3.1-lite-generate-preview",
  "veo-3.0-fast-generate-001"
];

export async function POST(request: Request) {
  try {
    const { apiKey } = await request.json();
    const trimmedKey = String(apiKey || "").trim();

    if (!trimmedKey) {
      return NextResponse.json({ error: "apiKey is required." }, { status: 400 });
    }

    const models = await listGeminiModels(trimmedKey);
    const ids = models.map((model) => model.id);

    return NextResponse.json({
      models,
      imageModelIds: IMAGE_MODEL_IDS.filter((id) => ids.includes(id)),
      videoModelIds: VIDEO_MODEL_IDS.filter((id) => ids.includes(id))
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load Gemini models." },
      { status: 500 }
    );
  }
}
