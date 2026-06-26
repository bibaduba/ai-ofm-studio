import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/auth";
import { generateGeminiText, type GeminiSourceImage } from "@/app/lib/gemini";

const SEEDREAM_SCENE_PROMPT = `You are an expert at creating complete image generation prompts for Seedream 4.5 AI model.

IMPORTANT CONTEXT:
- Seedream will receive 5 reference images in this order:
  1. Images 1-2: Face structure references
  2. Images 3-4: Body type and physique references
  3. Image 5: THIS image - complete scene reference
- You are analyzing image 5 ONLY
- Your output must be a COMPLETE prompt for Seedream

YOUR TASK:
Analyze this image and create a complete Seedream prompt that instructs the AI how to use all references and describes everything visible in THIS image.

OUTPUT FORMAT (mandatory structure):

"Use the first two reference images for the face structure, face must be strictly generated with these two reference images.
Use reference images 3-4 for the body type and physique. Use reference image 5 as the complete reference for clothing, pose, action, scene composition, background environment, lighting setup, and overall atmosphere.

Subject details: [Describe the person's clothing in complete detail - every garment, accessories, jewelry, shoes, specific details like patterns, textures, colors, cuts, styles]. [Describe the exact pose - standing, sitting, body position, arm placement, leg position]. [Describe what the person is doing - their action, gesture, body language, facial expression like smiling/serious but WITHOUT describing facial features].

The scene: [describe location type and setting]. The environment features [describe architectural elements, furniture, props, and background in detail]. The setting is [indoor/outdoor details with spatial relationships].

Lighting: [describe light source, direction, quality, shadows, time of day, color temperature in technical detail].

Camera: [describe angle, perspective, depth of field, focal distance, composition].

Atmosphere: [describe mood, ambiance, weather if applicable, environmental effects].

Colors and textures: [describe dominant colors throughout the scene, materials, surface properties, color palette].

Technical quality: [high-resolution, sharp focus, professional photography, etc.]."

CRITICAL RULES:
- DO describe: clothing (every detail), pose, action, body language, gesture, expression type (smile/serious)
- NEVER describe: hair color, hair style, eye color, facial features, skin tone, ethnic features
- Use "this person", "the subject" when referring to the individual
- Be extremely detailed about clothing and accessories
- Be precise about pose and body position
- Focus on EVERYTHING visible except facial/hair features

Output ONLY the formatted prompt, nothing else.`;

function dataUrlToSourceImage(dataUrl: string): GeminiSourceImage {
  const mimeType = dataUrl.match(/^data:([^;]+);base64,/)?.[1] || "image/png";
  return { dataUrl, mimeType };
}

export async function POST(request: Request) {
  try {
    if (!getCurrentUser()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await request.json();
    const apiKey = String(body.apiKey || "").trim();
    const image = String(body.image || "");
    const model = String(body.model || "gemini-2.5-flash");

    if (!apiKey) {
      return NextResponse.json({ error: "Gemini API key is required." }, { status: 400 });
    }

    if (!image.startsWith("data:image/")) {
      return NextResponse.json({ error: "Scene reference image is required." }, { status: 400 });
    }

    const prompt = await generateGeminiText({
      apiKey,
      model,
      prompt: SEEDREAM_SCENE_PROMPT,
      sourceImages: [dataUrlToSourceImage(image)]
    });

    return NextResponse.json({ prompt });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gemini prompt generation failed." },
      { status: 500 }
    );
  }
}
