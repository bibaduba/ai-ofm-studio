import { SavedModel, WavespeedGeneration } from "./types"

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
export function parseImages(value: string) {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? (parsed as string[]) : []
  } catch {
    return []
  }
}
export function generationReferences(generation: WavespeedGeneration) {
  return [
    ...parseImages(generation.faceReferences || "[]"),
    ...parseImages(generation.bodyReferences || "[]"),
    ...(generation.sceneReference ? [generation.sceneReference] : []),
  ]
}
export function isGenerationPending(generation: WavespeedGeneration) {
  return !["completed", "failed"].includes(
    (generation.status || "completed").toLowerCase(),
  )
}
export function generationImages(generation: WavespeedGeneration) {
  return parseImages(generation.resultImages || "[]")
}
export function isVideoMedia(value: string) {
  return (
    value.startsWith("data:video/") || /\.(mp4|mov|webm)(\?|#|$)/i.test(value)
  )
}
export function mediaFilename(url: string, fallback: string) {
  if (url.startsWith("data:video/")) return `${fallback}.mp4`
  if (url.startsWith("data:image/")) return `${fallback}.png`
  const extension =
    url.match(/\.(mp4|mov|webm|png|jpe?g)(\?|#|$)/i)?.[1] || "png"
  return `${fallback}.${extension.replace("jpeg", "jpg")}`
}
export function modelReferences(model?: SavedModel) {
  return model
    ? [
        ...parseImages(model.faceReferences),
        ...parseImages(model.bodyReferences),
      ]
    : []
}
