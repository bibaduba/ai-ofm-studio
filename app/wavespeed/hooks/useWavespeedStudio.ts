"use client"

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react"
import {
  defaultModelPrompt,
  defaultMotionEndpoint,
  defaultScenePrompt,
  defaultWavespeedEndpoint,
} from "@/app/components/wavespeed/constants"
import {
  SavedModel,
  Toast,
  WavespeedGeneration,
  WavespeedTab,
} from "@/app/components/wavespeed/types"
import {
  fileToDataUrl,
  generationImages,
  isGenerationPending,
  mediaFilename,
  parseImages,
} from "@/app/components/wavespeed/utils"

type StoredGenerationRequest = {
  mode?: WavespeedTab
  modelName?: string
  wavespeedModelId?: string | null
  endpoint?: string
  prompt?: string
  count?: number
  faceReferences?: string[]
  bodyReferences?: string[]
  sceneReference?: string | null
  motionImage?: string | null
  motionVideo?: string | null
  negativePrompt?: string
  characterOrientation?: "image" | "video"
  keepOriginalSound?: boolean
}

function parseRequestData(value: string | null): StoredGenerationRequest {
  if (!value) return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

export function useWavespeedStudio() {
  const [tab, setTab] = useState<WavespeedTab>("scene")
  const [apiKey, setApiKey] = useState("")
  const [geminiApiKey, setGeminiApiKey] = useState("")
  const [endpoint, setEndpoint] = useState(defaultWavespeedEndpoint)
  const [motionEndpoint, setMotionEndpoint] = useState(defaultMotionEndpoint)
  const [showGeminiKey, setShowGeminiKey] = useState(false)
  const [showWavespeedKey, setShowWavespeedKey] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [theme, setTheme] = useState<"light" | "dark">("light")
  const [modelName, setModelName] = useState("AI Instagram Model")
  const [faceReferences, setFaceReferences] = useState<string[]>([])
  const [bodyReferences, setBodyReferences] = useState<string[]>([])
  const [sceneReference, setSceneReference] = useState("")
  const [count, setCount] = useState(2)
  const [modelPrompt, setModelPrompt] = useState(defaultModelPrompt)
  const [scenePrompt, setScenePrompt] = useState(defaultScenePrompt)
  const [motionImage, setMotionImage] = useState("")
  const [motionVideo, setMotionVideo] = useState("")
  const [motionPrompt, setMotionPrompt] = useState("")
  const [motionNegativePrompt, setMotionNegativePrompt] = useState("")
  const [characterOrientation, setCharacterOrientation] = useState<
    "image" | "video"
  >("image")
  const [keepOriginalSound, setKeepOriginalSound] = useState(true)
  const [models, setModels] = useState<SavedModel[]>([])
  const [selectedModelId, setSelectedModelId] = useState("")
  const [generations, setGenerations] = useState<WavespeedGeneration[]>([])
  const [selectedGeneration, setSelectedGeneration] =
    useState<WavespeedGeneration | null>(null)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [status, setStatus] = useState("")
  const [loading, setLoading] = useState(false)
  const [promptLoading, setPromptLoading] = useState(false)
  const [error, setError] = useState("")
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    setGeminiApiKey(localStorage.getItem("gemini-api-key") || "")
    setApiKey(localStorage.getItem("wavespeed-api-key") || "")
    setEndpoint(
      localStorage.getItem("wavespeed-endpoint") ||
        "https://api.wavespeed.ai/api/v3/bytedance/seedream-v4.5/edit-sequential",
    )
    setMotionEndpoint(
      localStorage.getItem("wavespeed-motion-endpoint") ||
        defaultMotionEndpoint,
    )
    const savedTheme =
      localStorage.getItem("studio-theme") === "dark" ? "dark" : "light"
    setTheme(savedTheme)
    document.documentElement.dataset.theme = savedTheme
    refreshModels()
    refreshGenerations()
  }, [])

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark"
    setTheme(nextTheme)
    localStorage.setItem("studio-theme", nextTheme)
    document.documentElement.dataset.theme = nextTheme
  }

  const selectedModel = useMemo(
    () => models.find((model) => model.id === selectedModelId),
    [models, selectedModelId],
  )

  const removeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = crypto.randomUUID()
      setToasts((current) => [{ id, ...toast }, ...current].slice(0, 4))
      window.setTimeout(() => removeToast(id), 4200)
    },
    [removeToast],
  )

  function closeSettings() {
    setSettingsOpen(false)
    showToast({
      type: "success",
      title: "Настройки сохранены",
    })
  }

  const checkGenerationStatus = useCallback(
    async (id: string) => {
      if (!apiKey.trim()) return
      try {
        const response = await fetch("/api/wavespeed/generate", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, apiKey: apiKey.trim() }),
        })
        const data = await response.json()
        if (!response.ok) {
          setError(data.error || "Не удалось проверить статус генерации.")
          showToast({
            type: "error",
            title: data.error || "Не удалось проверить статус генерации.",
          })
          return
        }
        setGenerations((current) => {
          const previous = current.find(
            (generation) => generation.id === data.id,
          )
          if (
            previous &&
            isGenerationPending(previous) &&
            data.status === "completed"
          ) {
            showToast({
              type: "success",
              title: "Generation completed",
              message: "WaveSpeed вернул готовые изображения.",
            })
          }
          if (
            previous &&
            isGenerationPending(previous) &&
            data.status === "failed"
          ) {
            showToast({
              type: "error",
              title: "Generation failed",
              message: data.error || "WaveSpeed отклонил запрос.",
            })
          }
          return current.map((generation) =>
            generation.id === data.id ? data : generation,
          )
        })
        setSelectedGeneration((current) =>
          current?.id === data.id ? data : current,
        )
      } catch (statusError) {
        const message =
          statusError instanceof Error
            ? statusError.message
            : "Ошибка проверки статуса генерации."
        setError(message)
        showToast({ type: "error", title: "Status check failed", message })
      }
    },
    [apiKey, showToast],
  )

  useEffect(() => {
    const pending = generations.filter(isGenerationPending)
    if (pending.length === 0 || !apiKey.trim()) return

    const interval = window.setInterval(() => {
      pending.forEach((generation) => {
        checkGenerationStatus(generation.id)
      })
    }, 5000)

    return () => window.clearInterval(interval)
  }, [apiKey, checkGenerationStatus, generations])

  async function refreshModels() {
    const response = await fetch("/api/wavespeed/models")
    if (response.status === 401) {
      window.location.href = "/login"
      return
    }
    const data = await response.json()
    if (Array.isArray(data)) {
      setModels(data)
      setSelectedModelId((current) => current || data[0]?.id || "")
    }
  }

  async function refreshGenerations() {
    const response = await fetch("/api/wavespeed/generate")
    if (response.status === 401) {
      window.location.href = "/login"
      return
    }
    const data = await response.json()
    if (Array.isArray(data)) setGenerations(data)
  }

  async function uploadRefs(
    event: ChangeEvent<HTMLInputElement>,
    setter: (value: string[]) => void,
    limit: number,
  ) {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return
    const images = await Promise.all(files.slice(0, limit).map(fileToDataUrl))
    setter(images.slice(0, limit))
    event.target.value = ""
  }

  async function uploadScene(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setSceneReference(await fileToDataUrl(file))
    event.target.value = ""
  }

  async function uploadMotionFile(
    event: ChangeEvent<HTMLInputElement>,
    setter: (value: string) => void,
  ) {
    const file = event.target.files?.[0]
    if (!file) return
    setter(await fileToDataUrl(file))
    event.target.value = ""
  }

  async function saveModel() {
    setError("")
    setStatus("")
    if (
      !modelName.trim() ||
      faceReferences.length === 0 ||
      bodyReferences.length === 0
    ) {
      const message = "Добавь название модели, face reference и body reference."
      setError(message)
      showToast({ type: "error", title: "Model was not saved", message })
      return
    }
    const response = await fetch("/api/wavespeed/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: modelName, faceReferences, bodyReferences }),
    })
    const data = await response.json()
    if (!response.ok) {
      const message = data.error || "Не удалось сохранить модель."
      setError(message)
      showToast({ type: "error", title: "Model was not saved", message })
      return
    }
    setModels((current) => [data, ...current])
    setSelectedModelId(data.id)
    setStatus("Модель сохранена.")
    showToast({
      type: "success",
      title: "Model saved",
      message: "Face/body references сохранены.",
    })
  }

  async function saveModelFromGeneration(generation: WavespeedGeneration) {
    setError("")
    setStatus("")
    const faceRefs = parseImages(generation.faceReferences || "[]").slice(0, 2)
    const bodyRefs = parseImages(generation.bodyReferences || "[]").slice(0, 2)

    if (faceRefs.length === 0 || bodyRefs.length === 0) {
      const message =
        "У этой генерации нет сохранённых face/body references. Сохрани модель из текущих upload-полей."
      setError(message)
      showToast({ type: "error", title: "Model was not saved", message })
      return
    }

    const response = await fetch("/api/wavespeed/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${modelName || "AI Instagram Model"} ${new Date(generation.createdAt).toLocaleDateString("ru-RU")}`,
        faceReferences: faceRefs,
        bodyReferences: bodyRefs,
      }),
    })
    const data = await response.json()
    if (!response.ok) {
      const message = data.error || "Не удалось сохранить модель из результата."
      setError(message)
      showToast({ type: "error", title: "Model was not saved", message })
      return
    }
    setModels((current) => [data, ...current])
    setSelectedModelId(data.id)
    setSelectedGeneration(null)
    setStatus("Модель сохранена из результата.")
    showToast({
      type: "success",
      title: "Model saved",
      message: "Модель сохранена из результата генерации.",
    })
  }

  async function generateScenePrompt() {
    setError("")
    setStatus("")

    if (!sceneReference) {
      const message = "Загрузи scene reference, чтобы Gemini описал картинку."
      setError(message)
      showToast({ type: "error", title: "Prompt was not generated", message })
      return
    }

    if (!geminiApiKey.trim()) {
      const message =
        "Добавь Gemini API key в Settings, чтобы сгенерировать prompt."
      setError(message)
      showToast({ type: "error", title: "Prompt was not generated", message })
      return
    }

    localStorage.setItem("gemini-api-key", geminiApiKey.trim())
    setPromptLoading(true)
    try {
      const response = await fetch("/api/wavespeed/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: geminiApiKey.trim(),
          image: sceneReference,
        }),
      })
      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error || "Не удалось сгенерировать prompt.")
      setScenePrompt(data.prompt)
      setStatus("Gemini подготовил prompt для Seedream.")
      showToast({
        type: "success",
        title: "Prompt generated",
        message: "Gemini подготовил описание для Seedream.",
      })
    } catch (promptError) {
      const message =
        promptError instanceof Error
          ? promptError.message
          : "Ошибка генерации prompt."
      setError(message)
      showToast({ type: "error", title: "Prompt was not generated", message })
    } finally {
      setPromptLoading(false)
    }
  }

  async function deleteGeneration(id: string) {
    const response = await fetch(`/api/wavespeed/generate?id=${id}`, {
      method: "DELETE",
    })
    if (!response.ok) {
      const data = await response.json()
      const message = data.error || "Не удалось удалить генерацию."
      setError(message)
      showToast({ type: "error", title: "Delete failed", message })
      return
    }
    setGenerations((current) =>
      current.filter((generation) => generation.id !== id),
    )
    if (selectedGeneration?.id === id) {
      setSelectedGeneration(null)
    }
    setStatus("Генерация удалена.")
    showToast({
      type: "success",
      title: "Генерация удалена",
    })
  }

  function openGeneration(generation: WavespeedGeneration, imageIndex = 0) {
    setSelectedGeneration(generation)
    setSelectedImageIndex(imageIndex)
  }

  function prepareRegeneration(generation: WavespeedGeneration) {
    const request = parseRequestData(generation.requestData)
    const mode: WavespeedTab =
      generation.mode === "scene"
        ? "scene"
        : generation.mode === "motion"
          ? "motion"
          : "model"
    const storedCount = Number(request.count)
    const restoredCount =
      Number.isInteger(storedCount) && storedCount > 0
        ? storedCount
        : Math.max(1, generationImages(generation).length)
    const storedFaceReferences = Array.isArray(request.faceReferences)
      ? request.faceReferences
      : parseImages(generation.faceReferences || "[]")
    const storedBodyReferences = Array.isArray(request.bodyReferences)
      ? request.bodyReferences
      : parseImages(generation.bodyReferences || "[]")

    setTab(mode)
    setCount(restoredCount)
    setFaceReferences(storedFaceReferences)
    setBodyReferences(storedBodyReferences)
    setError("")
    setStatus("")

    if (mode === "model") {
      setModelName(request.modelName || modelName)
      setModelPrompt(request.prompt || generation.prompt)
      if (request.endpoint || generation.endpoint) {
        setEndpoint(request.endpoint || generation.endpoint || endpoint)
      }
    } else if (mode === "scene") {
      const modelId = request.wavespeedModelId || generation.wavespeedModelId
      setSelectedModelId(
        modelId && models.some((model) => model.id === modelId) ? modelId : "",
      )
      setSceneReference(
        request.sceneReference || generation.sceneReference || "",
      )
      setScenePrompt(request.prompt || generation.prompt)
      if (request.endpoint || generation.endpoint) {
        setEndpoint(request.endpoint || generation.endpoint || endpoint)
      }
    } else {
      setMotionImage(request.motionImage || generation.sceneReference || "")
      setMotionVideo(request.motionVideo || storedBodyReferences[0] || "")
      setMotionPrompt(request.prompt ?? generation.prompt)
      setMotionNegativePrompt(request.negativePrompt || "")
      setCharacterOrientation(
        request.characterOrientation === "video" ? "video" : "image",
      )
      setKeepOriginalSound(request.keepOriginalSound !== false)
      if (request.endpoint || generation.endpoint) {
        setMotionEndpoint(
          request.endpoint || generation.endpoint || motionEndpoint,
        )
      }
    }

    setSelectedGeneration(null)
    showToast({
      type: "info",
      title: "Параметры подставлены в форму.",
    })
  }

  async function downloadImage(imageUrl: string, filename: string) {
    if (imageUrl.startsWith("expired:")) {
      showToast({
        type: "error",
        title: "Output expired",
        message:
          "WaveSpeed уже удалил этот временный файл. Его нужно сгенерировать повторно.",
      })
      return
    }
    const href = imageUrl.startsWith("data:")
      ? imageUrl
      : imageUrl.startsWith("/api/media/")
        ? imageUrl
        : `/api/image-proxy?url=${encodeURIComponent(imageUrl)}`
    const response = await fetch(href)
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = objectUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(objectUrl)
  }

  async function downloadGeneration(generation: WavespeedGeneration) {
    const images = generationImages(generation)
    for (const [index, image] of images.entries()) {
      await downloadImage(
        image,
        mediaFilename(image, `wavespeed-${generation.id}-${index + 1}`),
      )
    }
  }

  async function generate(mode: WavespeedTab) {
    setError("")
    setStatus("")
    const prompt =
      mode === "model"
        ? modelPrompt
        : mode === "scene"
          ? scenePrompt
          : motionPrompt
    const activeEndpoint = mode === "motion" ? motionEndpoint : endpoint
    if (!apiKey.trim() || !activeEndpoint.trim()) {
      const message =
        mode === "motion"
          ? "Добавь Wavespeed API key и Motion endpoint."
          : "Добавь Wavespeed API key и endpoint."
      setError(message)
      showToast({ type: "error", title: "Generation was not created", message })
      return
    }
    if (
      mode === "model" &&
      (faceReferences.length === 0 || bodyReferences.length === 0)
    ) {
      const message = "Для первой вкладки нужны face и body references."
      setError(message)
      showToast({ type: "error", title: "Generation was not created", message })
      return
    }
    const hasSceneModel =
      Boolean(selectedModelId) ||
      (faceReferences.length > 0 && bodyReferences.length > 0)
    if (mode === "scene" && (!hasSceneModel || !sceneReference)) {
      const message =
        "Для второй вкладки выбери сохранённую модель и загрузи scene reference."
      setError(message)
      showToast({ type: "error", title: "Generation was not created", message })
      return
    }
    if (mode === "motion" && !motionImage && !motionVideo) {
      const message = "Для motion control загрузи image или video reference."
      setError(message)
      showToast({ type: "error", title: "Generation was not created", message })
      return
    }

    localStorage.setItem("wavespeed-api-key", apiKey.trim())
    localStorage.setItem("wavespeed-endpoint", endpoint.trim())
    localStorage.setItem("wavespeed-motion-endpoint", motionEndpoint.trim())

    setLoading(true)
    try {
      const response = await fetch("/api/wavespeed/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          endpoint: activeEndpoint.trim(),
          mode,
          modelName,
          wavespeedModelId: mode === "scene" ? selectedModelId : null,
          faceReferences,
          bodyReferences,
          sceneReference: mode === "scene" ? sceneReference : null,
          image: mode === "motion" ? motionImage || null : null,
          video: mode === "motion" ? motionVideo || null : null,
          negativePrompt: motionNegativePrompt,
          characterOrientation,
          keepOriginalSound,
          prompt,
          count,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Generation failed.")
      setGenerations((current) => [data, ...current])
      setStatus(
        data.status === "completed"
          ? "Генерация готова."
          : "Генерация запущена. Результат появится в карточке.",
      )
      showToast({
        type:
          data.status === "completed"
            ? "success"
            : data.status === "failed"
              ? "error"
              : "info",
        title:
          data.status === "completed"
            ? "Generation completed"
            : data.status === "failed"
              ? "Generation failed"
              : "Generation started",
        message:
          data.status === "completed"
            ? "Результат уже доступен в карточке."
            : data.status === "failed"
              ? data.error || "WaveSpeed отклонил запрос."
              : "Запрос отправлен в Wavespeed",
      })
    } catch (generationError) {
      const message =
        generationError instanceof Error
          ? generationError.message
          : "Ошибка генерации."
      setError(message)
      showToast({ type: "error", title: "Generation failed", message })
    } finally {
      setLoading(false)
    }
  }

  const visibleGenerations = generations.filter(
    (generation) => generation.mode === tab,
  )

  return {
    tab,
    setTab,
    apiKey,
    setApiKey,
    geminiApiKey,
    setGeminiApiKey,
    endpoint,
    setEndpoint,
    motionEndpoint,
    setMotionEndpoint,
    showGeminiKey,
    setShowGeminiKey,
    showWavespeedKey,
    setShowWavespeedKey,
    settingsOpen,
    setSettingsOpen,
    theme,
    modelName,
    setModelName,
    faceReferences,
    setFaceReferences,
    bodyReferences,
    setBodyReferences,
    sceneReference,
    count,
    setCount,
    modelPrompt,
    setModelPrompt,
    scenePrompt,
    setScenePrompt,
    motionImage,
    setMotionImage,
    motionVideo,
    setMotionVideo,
    motionPrompt,
    setMotionPrompt,
    motionNegativePrompt,
    setMotionNegativePrompt,
    characterOrientation,
    setCharacterOrientation,
    keepOriginalSound,
    setKeepOriginalSound,
    models,
    selectedModelId,
    setSelectedModelId,
    selectedModel,
    selectedGeneration,
    setSelectedGeneration,
    selectedImageIndex,
    setSelectedImageIndex,
    loading,
    promptLoading,
    error,
    toasts,
    visibleGenerations,
    toggleTheme,
    removeToast,
    closeSettings,
    uploadRefs,
    uploadScene,
    uploadMotionFile,
    saveModel,
    saveModelFromGeneration,
    generateScenePrompt,
    deleteGeneration,
    openGeneration,
    prepareRegeneration,
    downloadImage,
    downloadGeneration,
    generate,
  }
}
