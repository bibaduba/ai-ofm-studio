export type WavespeedGenerateInput = {
  apiKey: string;
  endpoint: string;
  prompt: string;
  images: string[];
  count: number;
};

export type WavespeedMotionInput = {
  apiKey: string;
  endpoint: string;
  image?: string;
  video?: string;
  characterOrientation: "image" | "video";
  prompt: string;
  negativePrompt: string;
  keepOriginalSound: boolean;
};

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" ? (value as JsonRecord) : {};
}

export function normalizeWavespeedOutputs(payload: unknown): string[] {
  const root = asRecord(payload);
  const data = asRecord(root.data);
  const candidates = [
    data.outputs,
    data.output,
    data.images,
    data.video,
    data.videos,
    data.urls,
    root.outputs,
    root.output,
    root.images,
    root.video,
    root.videos,
    root.urls
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate
        .map((item) => {
          if (typeof item === "string") return item;
          const record = asRecord(item);
          return String(record.url || record.video || record.image || record.uri || "");
        })
        .filter(Boolean);
    }
    if (typeof candidate === "string") return [candidate];
  }

  return [];
}

function predictionId(payload: unknown) {
  const root = asRecord(payload);
  const data = asRecord(root.data);
  return String(data.id || root.id || data.prediction_id || root.prediction_id || "");
}

export function resultEndpoint(endpoint: string, id: string) {
  const url = new URL(endpoint);
  const apiIndex = url.pathname.indexOf("/api/v3/");
  url.pathname = apiIndex >= 0 ? `${url.pathname.slice(0, apiIndex)}/api/v3/predictions/${id}/result` : `/api/v3/predictions/${id}/result`;
  return url.toString();
}

async function readJson(response: Response) {
  const payload = await response.json();
  if (!response.ok) {
    const record = asRecord(payload);
    throw new Error(String(record.message || record.error || "Wavespeed request failed."));
  }
  return payload;
}

export async function generateWavespeedImages({
  apiKey,
  endpoint,
  prompt,
  images,
  count
}: WavespeedGenerateInput) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      images,
      prompt,
      max_images: count,
      output_format: "png",
      enable_base64_output: false,
      enable_sync_mode: false
    })
  });

  const payload = await readJson(response);
  const immediateOutputs = normalizeWavespeedOutputs(payload);
  if (immediateOutputs.length > 0) return immediateOutputs;

  const id = predictionId(payload);
  if (!id) {
    throw new Error("Wavespeed did not return images or a prediction id.");
  }

  for (let attempt = 0; attempt < 36; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const resultResponse = await fetch(resultEndpoint(endpoint, id), {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    const resultPayload = await readJson(resultResponse);
    const outputs = normalizeWavespeedOutputs(resultPayload);
    if (outputs.length > 0) return outputs;

    const status = String(asRecord(asRecord(resultPayload).data).status || asRecord(resultPayload).status || "");
    if (["failed", "error", "canceled"].includes(status.toLowerCase())) {
      const record = asRecord(resultPayload);
      const data = asRecord(record.data);
      throw new Error(
        String(data.error || record.error || "Wavespeed provider rejected the request. Check images and prompt.")
      );
    }
  }

  throw new Error("Wavespeed generation is still running. Try fewer images or check the provider dashboard.");
}

export async function startWavespeedPrediction({
  apiKey,
  endpoint,
  prompt,
  images,
  count
}: WavespeedGenerateInput) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      images,
      prompt,
      max_images: count,
      output_format: "png",
      enable_base64_output: false,
      enable_sync_mode: false
    })
  });

  const payload = await readJson(response);
  const outputs = normalizeWavespeedOutputs(payload);
  const root = asRecord(payload);
  const data = asRecord(root.data);
  const status = String(data.status || root.status || (outputs.length > 0 ? "completed" : "pending"));
  const id = predictionId(payload);

  if (outputs.length === 0 && !id) {
    throw new Error("Wavespeed did not return images or a prediction id.");
  }

  return { id, outputs, status };
}

export async function startWavespeedMotionPrediction({
  apiKey,
  endpoint,
  image,
  video,
  characterOrientation,
  prompt,
  negativePrompt,
  keepOriginalSound
}: WavespeedMotionInput) {
  const body: Record<string, unknown> = {
    character_orientation: characterOrientation,
    prompt,
    negative_prompt: negativePrompt,
    keep_original_sound: keepOriginalSound
  };

  if (image) body.image = image;
  if (video) body.video = video;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  const payload = await readJson(response);
  const outputs = normalizeWavespeedOutputs(payload);
  const root = asRecord(payload);
  const data = asRecord(root.data);
  const status = String(data.status || root.status || (outputs.length > 0 ? "completed" : "pending"));
  const id = predictionId(payload);

  if (outputs.length === 0 && !id) {
    throw new Error("Wavespeed did not return media or a prediction id.");
  }

  return { id, outputs, status };
}

export async function checkWavespeedPrediction({
  apiKey,
  endpoint,
  predictionId
}: {
  apiKey: string;
  endpoint: string;
  predictionId: string;
}) {
  const response = await fetch(resultEndpoint(endpoint, predictionId), {
    headers: { Authorization: `Bearer ${apiKey}` }
  });
  const payload = await readJson(response);
  const outputs = normalizeWavespeedOutputs(payload);
  const root = asRecord(payload);
  const data = asRecord(root.data);
  const status = String(data.status || root.status || (outputs.length > 0 ? "completed" : "running"));
  const error = String(data.error || root.error || "");

  return { outputs, status, error };
}
