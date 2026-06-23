export type GeminiSourceImage = {
  dataUrl: string;
  mimeType: string;
};

export type GeminiModelInfo = {
  id: string;
  name?: string;
  displayName?: string;
  supportedGenerationMethods: string[];
};

type GeminiGenerateInput = {
  apiKey: string;
  prompt: string;
  model: string;
  sourceImages: GeminiSourceImage[];
};

type GeminiVideoInput = GeminiGenerateInput & {
  aspectRatio: string;
  durationSeconds: string;
  resolution: string;
};

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

type GeminiInlinePart = {
  inlineData?: {
    mimeType?: string;
    data?: string;
  };
  text?: string;
};

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_OPERATION_BASE = "https://generativelanguage.googleapis.com/v1beta";

function stripDataUrl(dataUrl: string) {
  return dataUrl.replace(/^data:[^;]+;base64,/, "");
}

export async function generateGeminiImage({
  apiKey,
  prompt,
  model,
  sourceImages
}: GeminiGenerateInput) {
  const parts: GeminiPart[] = [{ text: prompt }];

  sourceImages.slice(0, 14).forEach((image) => {
    parts.push({
      inlineData: {
        mimeType: image.mimeType,
        data: stripDataUrl(image.dataUrl)
      }
    });
  });

  const response = await fetch(
    `${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts }]
      })
    }
  );

  const payload = await response.json();

  if (!response.ok) {
    const message =
      payload?.error?.message ?? "Gemini request failed. Check API key and model access.";
    throw new Error(message);
  }

  const resultPart = payload?.candidates?.[0]?.content?.parts?.find(
    (part: GeminiInlinePart) => part.inlineData?.data
  ) as GeminiInlinePart | undefined;

  if (!resultPart?.inlineData?.data) {
    const text = payload?.candidates?.[0]?.content?.parts
      ?.map((part: GeminiInlinePart) => part.text)
      .filter(Boolean)
      .join("\n");
    throw new Error(text || "Gemini did not return an image.");
  }

  const mimeType = resultPart.inlineData.mimeType || "image/png";
  return `data:${mimeType};base64,${resultPart.inlineData.data}`;
}

export async function generateGeminiText({
  apiKey,
  prompt,
  model,
  sourceImages
}: GeminiGenerateInput) {
  const parts: GeminiPart[] = [{ text: prompt }];

  sourceImages.slice(0, 4).forEach((image) => {
    parts.push({
      inlineData: {
        mimeType: image.mimeType,
        data: stripDataUrl(image.dataUrl)
      }
    });
  });

  const response = await fetch(
    `${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts }]
      })
    }
  );

  const payload = await response.json();

  if (!response.ok) {
    const message =
      payload?.error?.message ?? "Gemini request failed. Check API key and model access.";
    throw new Error(message);
  }

  const text = payload?.candidates?.[0]?.content?.parts
    ?.map((part: GeminiInlinePart) => part.text)
    .filter(Boolean)
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("Gemini did not return prompt text.");
  }

  return text;
}

export async function listGeminiModels(apiKey: string): Promise<GeminiModelInfo[]> {
  const response = await fetch(GEMINI_API_BASE, {
    headers: { "x-goog-api-key": apiKey }
  });
  const payload = await response.json();

  if (!response.ok) {
    const message =
      payload?.error?.message ?? "Could not load Gemini models for this API key.";
    throw new Error(message);
  }

  return (payload?.models || []).map(
    (model: {
      name?: string;
      displayName?: string;
      supportedGenerationMethods?: string[];
    }) => ({
      id: String(model.name || "").replace(/^models\//, ""),
      name: model.name,
      displayName: model.displayName,
      supportedGenerationMethods: model.supportedGenerationMethods || []
    })
  );
}

async function readGeminiJson(response: Response) {
  const payload = await response.json();
  if (!response.ok) {
    const message =
      payload?.error?.message ?? "Gemini request failed. Check API key and model access.";
    throw new Error(message);
  }
  return payload;
}

export async function generateGeminiVideo({
  apiKey,
  prompt,
  model,
  sourceImages,
  aspectRatio,
  durationSeconds,
  resolution
}: GeminiVideoInput) {
  const firstImage = sourceImages[0];
  const instance: Record<string, unknown> = { prompt };

  if (firstImage) {
    instance.image = {
      inlineData: {
        mimeType: firstImage.mimeType,
        data: stripDataUrl(firstImage.dataUrl)
      }
    };
  }

  const startResponse = await fetch(
    `${GEMINI_API_BASE}/${encodeURIComponent(model)}:predictLongRunning`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        instances: [instance],
        parameters: {
          aspectRatio: aspectRatio === "9:16" ? "9:16" : "16:9",
          durationSeconds: Number(durationSeconds),
          numberOfVideos: 1,
          resolution
        }
      })
    }
  );
  const operation = await readGeminiJson(startResponse);

  if (!operation?.name) {
    throw new Error("Gemini did not return a video operation name.");
  }

  let status = operation;
  for (let attempt = 0; attempt < 36; attempt += 1) {
    if (status.done) break;
    await new Promise((resolve) => setTimeout(resolve, 10000));
    const statusResponse = await fetch(`${GEMINI_OPERATION_BASE}/${status.name}`, {
      headers: { "x-goog-api-key": apiKey }
    });
    status = await readGeminiJson(statusResponse);
  }

  if (!status.done) {
    throw new Error("Video generation is still running. Try again with a shorter prompt or lower resolution.");
  }

  const videoUri =
    status?.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ??
    status?.response?.generatedVideos?.[0]?.video?.uri;

  if (!videoUri) {
    throw new Error("Gemini finished the job but did not return a downloadable video URI.");
  }

  const videoResponse = await fetch(videoUri, {
    headers: { "x-goog-api-key": apiKey }
  });

  if (!videoResponse.ok) {
    throw new Error("Gemini generated the video, but downloading it failed.");
  }

  const bytes = Buffer.from(await videoResponse.arrayBuffer());
  return `data:video/mp4;base64,${bytes.toString("base64")}`;
}
