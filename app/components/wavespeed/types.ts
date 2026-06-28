export type WavespeedTab = "model" | "scene" | "motion"
export type SavedModel = {
  id: string
  name: string
  faceReferences: string
  bodyReferences: string
  createdAt: string
}
export type WavespeedGeneration = {
  id: string
  wavespeedModelId: string | null
  mode: string
  prompt: string
  faceReferences: string | null
  bodyReferences: string | null
  sceneReference: string | null
  resultImages: string
  status: string
  predictionId: string | null
  endpoint: string | null
  requestData: string | null
  error: string | null
  createdAt: string
  updatedAt: string
}
export type Toast = {
  id: string
  type: "success" | "error" | "info"
  title: string
  message?: string
}
