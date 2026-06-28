export type MediaType = "image" | "video"
export type HistoryType = "all" | MediaType
export type HistoryView = "grid" | "list"
export type Profile = { id: string; name: string }
export type SourceImage = { dataUrl: string; mimeType: string }
export type Generation = {
  id: string
  mediaType: MediaType
  prompt: string
  imageData: string
  sourceImages: string | null
  model: string
  aspectRatio: string
  resolution: string
  favorite: boolean
  createdAt: string
}
export type ModelsResponse = {
  models: Array<{ id: string; displayName?: string }>
  imageModelIds: string[]
  videoModelIds: string[]
}
