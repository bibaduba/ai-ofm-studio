"use client"

import Link from "next/link"
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  Film,
  ImageIcon,
  KeyRound,
  Loader2,
  Moon,
  Save,
  Settings2,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  Wand2,
  X,
} from "lucide-react"
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react"
import styles from "./wavespeed.module.scss"
import { AccountPanel } from "@/app/components/AccountPanel"

type Tab = "model" | "scene" | "motion"

type SavedModel = {
  id: string
  name: string
  faceReferences: string
  bodyReferences: string
  createdAt: string
}

type Generation = {
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
  error: string | null
  createdAt: string
  updatedAt: string
}

type Toast = {
  id: string
  type: "success" | "error" | "info"
  title: string
  message?: string
}

const defaultModelPrompt = `You are an expert at creating complete image generation prompts for Seedream 4.0 AI model.

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

"Use the first two reference images for the face structure, face must be strictly generated with these two reference images. Use reference images 3-4 for the body type and physique. Use reference image 5 as the complete reference for clothing, pose, action, scene composition, background environment, lighting setup, and overall atmosphere.

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

Output ONLY the formatted prompt, nothing else.`

const defaultScenePrompt =
  "Use the first two reference images for the face structure. Use reference images 3-4 for the body type and physique. Use reference image 5 as the complete reference for clothing, pose, action, scene composition, background environment, lighting setup, and overall atmosphere."

const defaultMotionEndpoint =
  "https://api.wavespeed.ai/api/v3/kwaivgi/kling-v2.6-std/motion-control"

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function parseImages(value: string) {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function generationReferences(generation: Generation) {
  return [
    ...parseImages(generation.faceReferences || "[]"),
    ...parseImages(generation.bodyReferences || "[]"),
    ...(generation.sceneReference ? [generation.sceneReference] : []),
  ]
}

function isGenerationPending(generation: Generation) {
  return !["completed", "failed"].includes(
    (generation.status || "completed").toLowerCase(),
  )
}

function generationImages(generation: Generation) {
  return parseImages(generation.resultImages || "[]")
}

function isVideoMedia(value: string) {
  return (
    value.startsWith("data:video/") || /\.(mp4|mov|webm)(\?|#|$)/i.test(value)
  )
}

function mediaFilename(url: string, fallback: string) {
  if (url.startsWith("data:video/")) return `${fallback}.mp4`
  if (url.startsWith("data:image/")) return `${fallback}.png`
  const extension =
    url.match(/\.(mp4|mov|webm|png|jpe?g)(\?|#|$)/i)?.[1] || "png"
  return `${fallback}.${extension.replace("jpeg", "jpg")}`
}

export default function WavespeedPage() {
  const [tab, setTab] = useState<Tab>("model")
  const [apiKey, setApiKey] = useState("")
  const [geminiApiKey, setGeminiApiKey] = useState("")
  const [endpoint, setEndpoint] = useState(
    "https://api.wavespeed.ai/api/v3/bytedance/seedream-v4.5/edit-sequential",
  )
  const [motionEndpoint, setMotionEndpoint] = useState(defaultMotionEndpoint)
  const [showGeminiKey, setShowGeminiKey] = useState(false)
  const [showWavespeedKey, setShowWavespeedKey] = useState(false)
  const [demoMode, setDemoMode] = useState(true)
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
  const [generations, setGenerations] = useState<Generation[]>([])
  const [selectedGeneration, setSelectedGeneration] =
    useState<Generation | null>(null)
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
    setDemoMode(localStorage.getItem("studio-demo-mode") !== "false")
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
      title: "Settings applied",
      message: "Ключи, endpoint, demo mode и тема сохранены.",
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
            title: "Status check failed",
            message: data.error || "Не удалось проверить статус генерации.",
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
    const data = await response.json()
    if (Array.isArray(data)) {
      setModels(data)
      setSelectedModelId((current) => current || data[0]?.id || "")
    }
  }

  async function refreshGenerations() {
    const response = await fetch("/api/wavespeed/generate")
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

  async function saveModelFromGeneration(generation: Generation) {
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
      title: "Generation deleted",
      message: "Результат удалён из истории.",
    })
  }

  function openGeneration(generation: Generation, imageIndex = 0) {
    setSelectedGeneration(generation)
    setSelectedImageIndex(imageIndex)
  }

  async function downloadImage(imageUrl: string, filename: string) {
    if (imageUrl.startsWith("expired:")) {
      showToast({
        type: "error",
        title: "Output expired",
        message: "WaveSpeed уже удалил этот временный файл. Его нужно сгенерировать повторно.",
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

  async function downloadGeneration(generation: Generation) {
    const images = generationImages(generation)
    for (const [index, image] of images.entries()) {
      await downloadImage(
        image,
        mediaFilename(image, `wavespeed-${generation.id}-${index + 1}`),
      )
    }
  }

  async function generate(mode: Tab) {
    setError("")
    setStatus("")
    const prompt =
      mode === "model"
        ? modelPrompt
        : mode === "scene"
          ? scenePrompt
          : motionPrompt
    const activeEndpoint = mode === "motion" ? motionEndpoint : endpoint
    if (!demoMode && (!apiKey.trim() || !activeEndpoint.trim())) {
      const message =
        mode === "motion"
          ? "Добавь Wavespeed API key и Motion endpoint или включи Demo mode."
          : "Добавь Wavespeed API key и endpoint или включи Demo mode."
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
    if (mode === "scene" && (!selectedModelId || !sceneReference)) {
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

    if (!demoMode) {
      localStorage.setItem("wavespeed-api-key", apiKey.trim())
      localStorage.setItem("wavespeed-endpoint", endpoint.trim())
      localStorage.setItem("wavespeed-motion-endpoint", motionEndpoint.trim())
    }

    setLoading(true)
    try {
      const response = await fetch("/api/wavespeed/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mock: demoMode,
          apiKey: apiKey.trim(),
          endpoint: activeEndpoint.trim(),
          mode,
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

  return (
    <main className={styles.shell}>
      <div className={styles.toastStack} aria-live='polite' aria-atomic='true'>
        {toasts.map((toast) => (
          <div
            className={`${styles.toast} ${styles[`toast${toast.type}`]}`}
            key={toast.id}
          >
            <div className={styles.toastIcon}>
              {toast.type === "success" ? (
                <CheckCircle2 size={18} />
              ) : toast.type === "error" ? (
                <AlertTriangle size={18} />
              ) : (
                <Sparkles size={18} />
              )}
            </div>
            <div>
              <strong>{toast.title}</strong>
              {toast.message && <span>{toast.message}</span>}
            </div>
            <button
              type='button'
              onClick={() => removeToast(toast.id)}
              aria-label='Close notification'
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>

      <nav className={styles.navbar}>
        <div className={styles.brand}>
          <Sparkles size={22} />
          <div>
            <strong>Wavespeed Model Lab</strong>
            <span>AI Instagram model workflow</span>
          </div>
        </div>
        <button
          className={styles.themeToggle}
          type='button'
          onClick={toggleTheme}
          aria-label='Toggle theme'
        >
          {theme === "dark" ? <Moon size={17} /> : <Sun size={17} />}
          <span />
        </button>
        <button
          className={styles.settingsButton}
          type='button'
          onClick={() => setSettingsOpen(true)}
          aria-label='Settings'
        >
          <Settings2 size={18} />
        </button>
        <div className={styles.appSwitch}>
          <Link href='/'>Gemini</Link>
          <Link className={styles.switchActive} href='/wavespeed'>
            Wavespeed
          </Link>
        </div>
      </nav>

      <section className={styles.tabs}>
        <button
          className={tab === "model" ? styles.active : ""}
          type='button'
          onClick={() => setTab("model")}
        >
          1. Create model
        </button>
        <button
          className={tab === "scene" ? styles.active : ""}
          type='button'
          onClick={() => setTab("scene")}
        >
          2. Generate scenes
        </button>
        <button
          className={tab === "motion" ? styles.active : ""}
          type='button'
          onClick={() => setTab("motion")}
        >
          3. Video motion
        </button>
      </section>

      <section className={styles.workspace}>
        <aside className={styles.panel}>
          {tab === "model" ? (
            <>
              <label className={styles.field}>
                <span>Model name</span>
                <input
                  value={modelName}
                  onChange={(event) => setModelName(event.target.value)}
                />
              </label>

              <ReferenceUpload
                title='Face reference'
                description='Upload 1-2 face structure references'
                images={faceReferences}
                onUpload={(event) => uploadRefs(event, setFaceReferences, 2)}
                onClear={() => setFaceReferences([])}
              />

              <ReferenceUpload
                title='Body reference'
                description='Upload 1-2 body type and physique references'
                images={bodyReferences}
                onUpload={(event) => uploadRefs(event, setBodyReferences, 2)}
                onClear={() => setBodyReferences([])}
              />

              <label className={styles.field}>
                <span>Кол-во генераций изображений</span>
                <input
                  type='number'
                  min={1}
                  value={count}
                  onChange={(event) => setCount(Number(event.target.value))}
                />
              </label>

              <label className={styles.field}>
                <span>Prompt</span>
                <textarea
                  value={modelPrompt}
                  onChange={(event) => setModelPrompt(event.target.value)}
                />
              </label>

              <div className={styles.actions}>
                <button type='button' onClick={saveModel}>
                  <Save size={18} />
                  Save model
                </button>
                <button
                  type='button'
                  onClick={() => generate("model")}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className={styles.spin} size={18} />
                  ) : (
                    <Wand2 size={18} />
                  )}
                  Generate
                </button>
              </div>
            </>
          ) : tab === "scene" ? (
            <>
              <label className={styles.field}>
                <span>Saved model</span>
                <select
                  value={selectedModelId}
                  onChange={(event) => setSelectedModelId(event.target.value)}
                >
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </select>
              </label>

              {selectedModel && (
                <div className={styles.savedRefs}>
                  {[
                    ...parseImages(selectedModel.faceReferences),
                    ...parseImages(selectedModel.bodyReferences),
                  ].map((image, index) => (
                    <img
                      key={`${selectedModel.id}-${index}`}
                      src={image}
                      alt=''
                    />
                  ))}
                </div>
              )}

              <label className={styles.sceneUpload}>
                <input type='file' accept='image/*' onChange={uploadScene} />
                {sceneReference ? (
                  <img src={sceneReference} alt='' />
                ) : (
                  <Upload size={28} />
                )}
                <strong>Scene reference</strong>
                <span>
                  Clothing, pose, action, composition, background, lighting,
                  atmosphere
                </span>
              </label>

              <label className={styles.field}>
                <span>Кол-во генераций изображений</span>
                <input
                  type='number'
                  min={1}
                  value={count}
                  onChange={(event) => setCount(Number(event.target.value))}
                />
              </label>

              <label className={styles.field}>
                <div className={styles.fieldHeader}>
                  <span>Prompt</span>
                  <button
                    className={styles.promptAssistButton}
                    type='button'
                    onClick={generateScenePrompt}
                    disabled={promptLoading || !sceneReference}
                    title='Generate prompt with Gemini'
                    aria-label='Generate prompt with Gemini'
                  >
                    {promptLoading ? (
                      <Loader2 className={styles.spin} size={17} />
                    ) : (
                      <Sparkles size={17} />
                    )}
                  </button>
                </div>
                <textarea
                  value={scenePrompt}
                  onChange={(event) => setScenePrompt(event.target.value)}
                />
              </label>

              <button
                className={styles.fullButton}
                type='button'
                onClick={() => generate("scene")}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className={styles.spin} size={18} />
                ) : (
                  <Wand2 size={18} />
                )}
                Generate scene
              </button>
            </>
          ) : (
            <>
              <div className={styles.motionGrid}>
                <label className={styles.sceneUpload}>
                  <input
                    type='file'
                    accept='image/jpeg,image/png'
                    onChange={(event) =>
                      uploadMotionFile(event, setMotionImage)
                    }
                  />
                  {motionImage ? (
                    <img src={motionImage} alt='' />
                  ) : (
                    <ImageIcon size={28} />
                  )}
                  <strong>Image reference</strong>
                  <span>.jpg / .jpeg / .png up to 10MB</span>
                </label>

                <label className={styles.sceneUpload}>
                  <input
                    type='file'
                    accept='video/mp4,video/quicktime'
                    onChange={(event) =>
                      uploadMotionFile(event, setMotionVideo)
                    }
                  />
                  {motionVideo ? (
                    <video src={motionVideo} muted playsInline />
                  ) : (
                    <Film size={28} />
                  )}
                  <strong>Video reference</strong>
                  <span>.mp4 / .mov up to 10MB</span>
                </label>
              </div>

              <label className={styles.field}>
                <span>Character orientation</span>
                <div className={styles.segmented}>
                  <button
                    type='button'
                    className={
                      characterOrientation === "image" ? styles.active : ""
                    }
                    onClick={() => setCharacterOrientation("image")}
                  >
                    Match image
                  </button>
                  <button
                    type='button'
                    className={
                      characterOrientation === "video" ? styles.active : ""
                    }
                    onClick={() => setCharacterOrientation("video")}
                  >
                    Match video
                  </button>
                </div>
              </label>

              <label className={styles.field}>
                <span>Prompt</span>
                <textarea
                  value={motionPrompt}
                  onChange={(event) => setMotionPrompt(event.target.value)}
                  placeholder='Describe the motion, camera movement, action, mood...'
                />
              </label>

              <label className={styles.field}>
                <span>Negative prompt</span>
                <textarea
                  value={motionNegativePrompt}
                  onChange={(event) =>
                    setMotionNegativePrompt(event.target.value)
                  }
                  placeholder='Things to avoid in the generated video...'
                />
              </label>

              <label className={styles.demoToggle}>
                <input
                  type='checkbox'
                  checked={keepOriginalSound}
                  onChange={(event) =>
                    setKeepOriginalSound(event.target.checked)
                  }
                />
                <span>Keep original sound</span>
              </label>

              <button
                className={styles.fullButton}
                type='button'
                onClick={() => generate("motion")}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className={styles.spin} size={18} />
                ) : (
                  <Wand2 size={18} />
                )}
                Generate video
              </button>
            </>
          )}

          {error && <p className={styles.error}>{error}</p>}
        </aside>

        <section className={styles.results}>
          <header>
            <h1>
              {tab === "model"
                ? "Model generations"
                : tab === "scene"
                  ? "Scene generations"
                  : "Video generations"}
            </h1>
          </header>
          {visibleGenerations.length === 0 ? (
            <div className={styles.empty}>
              <ImageIcon size={34} />
              <p>Результаты генерации появятся здесь.</p>
            </div>
          ) : (
            <div className={styles.grid}>
              {visibleGenerations.map((generation) => {
                const images = generationImages(generation)
                const pending = isGenerationPending(generation)
                const failed = generation.status === "failed"

                return (
                  <article
                    className={`${styles.card} ${pending ? styles.cardPending : ""} ${failed ? styles.cardFailed : ""}`}
                    key={generation.id}
                    role='button'
                    tabIndex={0}
                    onClick={() => {
                      if (!pending && !failed) openGeneration(generation)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !pending && !failed)
                        openGeneration(generation)
                    }}
                  >
                    {pending ? (
                      <div className={styles.pendingCard}>
                        <Loader2 className={styles.spin} size={34} />
                        <strong>Generation in progress</strong>
                      </div>
                    ) : failed ? (
                      <div className={styles.pendingCard}>
                        <X size={34} />
                        <strong>Generation failed</strong>
                        <span>
                          {generation.error ||
                            "Wavespeed rejected the request."}
                        </span>
                      </div>
                    ) : (
                      <div className={styles.cardImages}>
                        {images.slice(0, 4).map((image, index) => (
                          <button
                            type='button'
                            onClick={(event) => {
                              event.stopPropagation()
                              openGeneration(generation, index)
                            }}
                            key={`${generation.id}-${index}`}
                          >
                            <MediaPreview src={image} alt={generation.prompt} />
                          </button>
                        ))}
                      </div>
                    )}
                    <div className={styles.cardFooter}>
                      <div>
                        <span>
                          {failed
                            ? "failed"
                            : pending
                              ? generation.status || "pending"
                              : `${images.length} image(s)`}
                        </span>
                        <span>
                          {new Date(generation.createdAt).toLocaleString(
                            "ru-RU",
                          )}
                        </span>
                      </div>
                      <div className={styles.cardActions}>
                        {tab === "model" && !pending && !failed && (
                          <button
                            type='button'
                            onClick={(event) => {
                              event.stopPropagation()
                              saveModelFromGeneration(generation)
                            }}
                            title='Save model'
                          >
                            <Save size={17} />
                          </button>
                        )}
                        {!pending && !failed && (
                          <button
                            type='button'
                            onClick={(event) => {
                              event.stopPropagation()
                              downloadGeneration(generation)
                            }}
                            title='Download all'
                          >
                            <Download size={17} />
                          </button>
                        )}
                        <button
                          type='button'
                          onClick={(event) => {
                            event.stopPropagation()
                            deleteGeneration(generation.id)
                          }}
                          title='Delete generation'
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </section>

      {selectedGeneration && (
        <GenerationModal
          generation={selectedGeneration}
          imageIndex={selectedImageIndex}
          onImageIndexChange={setSelectedImageIndex}
          onClose={() => setSelectedGeneration(null)}
          onDownloadImage={downloadImage}
          onDownloadAll={downloadGeneration}
          onSaveModel={saveModelFromGeneration}
          onDelete={deleteGeneration}
        />
      )}

      {settingsOpen && (
        <div
          className={styles.modalOverlay}
          onMouseDown={(event) =>
            event.target === event.currentTarget && closeSettings()
          }
        >
          <section className={styles.modal}>
            <header>
              <h2>Settings</h2>
              <button type='button' onClick={closeSettings} aria-label='Close'>
                <X size={20} />
              </button>
            </header>

            <label className={styles.field}>
              <span>Gemini API key</span>
              <div className={styles.keyBox}>
                <KeyRound size={18} />
                <input
                  type={showGeminiKey ? "text" : "password"}
                  value={geminiApiKey}
                  onChange={(event) => {
                    setGeminiApiKey(event.target.value)
                    localStorage.setItem("gemini-api-key", event.target.value)
                  }}
                  disabled={demoMode}
                  placeholder='Gemini API key'
                />
                <button
                  type='button'
                  onClick={() => setShowGeminiKey((value) => !value)}
                  aria-label='Toggle Gemini key visibility'
                >
                  {showGeminiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            <label className={styles.field}>
              <span>Wavespeed API key</span>
              <div className={styles.keyBox}>
                <KeyRound size={18} />
                <input
                  type={showWavespeedKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(event) => {
                    setApiKey(event.target.value)
                    localStorage.setItem(
                      "wavespeed-api-key",
                      event.target.value,
                    )
                  }}
                  disabled={demoMode}
                  placeholder='Wavespeed API key'
                />
                <button
                  type='button'
                  onClick={() => setShowWavespeedKey((value) => !value)}
                  aria-label='Toggle Wavespeed key visibility'
                >
                  {showWavespeedKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            <label className={styles.field}>
              <span>Wavespeed endpoint</span>
              <input
                value={endpoint}
                onChange={(event) => {
                  setEndpoint(event.target.value)
                  localStorage.setItem("wavespeed-endpoint", event.target.value)
                }}
                disabled={demoMode}
              />
            </label>
            <label className={styles.field}>
              <span>Wavespeed motion endpoint</span>
              <input
                value={motionEndpoint}
                onChange={(event) => {
                  setMotionEndpoint(event.target.value)
                  localStorage.setItem(
                    "wavespeed-motion-endpoint",
                    event.target.value,
                  )
                }}
                disabled={demoMode}
                placeholder='https://api.wavespeed.ai/api/v3/...'
              />
            </label>
            <label className={styles.demoToggle}>
              <input
                type='checkbox'
                checked={demoMode}
                onChange={(event) => {
                  setDemoMode(event.target.checked)
                  localStorage.setItem(
                    "studio-demo-mode",
                    String(event.target.checked),
                  )
                }}
              />
              <span>Demo mode без внешних API</span>
            </label>
            <AccountPanel />
          </section>
        </div>
      )}
    </main>
  )
}

function GenerationModal({
  generation,
  imageIndex,
  onImageIndexChange,
  onClose,
  onDownloadImage,
  onDownloadAll,
  onSaveModel,
  onDelete,
}: {
  generation: Generation
  imageIndex: number
  onImageIndexChange: (index: number) => void
  onClose: () => void
  onDownloadImage: (imageUrl: string, filename: string) => void
  onDownloadAll: (generation: Generation) => void
  onSaveModel: (generation: Generation) => void
  onDelete: (id: string) => void
}) {
  const images = parseImages(generation.resultImages)
  const references = generationReferences(generation)
  const activeImage = images[imageIndex] || images[0]

  function go(direction: -1 | 1) {
    onImageIndexChange((imageIndex + direction + images.length) % images.length)
  }

  return (
    <div
      className={styles.viewerOverlay}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className={styles.viewer}
        role='dialog'
        aria-modal='true'
        aria-label='Generation result'
      >
        <div className={styles.viewerMedia}>
          <button
            className={styles.viewerClose}
            type='button'
            onClick={onClose}
            aria-label='Close preview'
          >
            <X size={20} />
          </button>
          {images.length > 1 && (
            <button
              className={styles.viewerPrev}
              type='button'
              onClick={() => go(-1)}
              aria-label='Previous image'
            >
              <ChevronLeft size={24} />
            </button>
          )}
          <MediaPreview src={activeImage} alt={generation.prompt} controls />
          {images.length > 1 && (
            <button
              className={styles.viewerNext}
              type='button'
              onClick={() => go(1)}
              aria-label='Next image'
            >
              <ChevronRight size={24} />
            </button>
          )}
          <button
            className={styles.viewerDownload}
            type='button'
            onClick={() =>
              onDownloadImage(
                activeImage,
                mediaFilename(
                  activeImage,
                  `wavespeed-${generation.id}-${imageIndex + 1}`,
                ),
              )
            }
            aria-label='Download current image'
          >
            <Download size={20} />
          </button>
          <div className={styles.viewerThumbs}>
            {images.map((image, index) => (
              <button
                className={index === imageIndex ? styles.thumbActive : ""}
                type='button'
                key={`${generation.id}-thumb-${index}`}
                onClick={() => onImageIndexChange(index)}
              >
                <MediaPreview src={image} alt='' />
              </button>
            ))}
          </div>
        </div>

        <aside className={styles.viewerInfo}>
          <span className={styles.viewerKicker}>
            {generation.mode} generation
          </span>
          <h2>Result details</h2>

          <div className={styles.infoBlock}>
            <strong>Prompt</strong>
            <p>{generation.prompt}</p>
          </div>

          <div className={styles.infoBlock}>
            <strong>Media count</strong>
            <p>{images.length}</p>
          </div>

          <div className={styles.infoBlock}>
            <strong>Used references</strong>
            {references.length > 0 ? (
              <div className={styles.usedRefs}>
                {references.map((reference, index) => (
                  <MediaPreview
                    src={reference}
                    alt=''
                    key={`${generation.id}-ref-${index}`}
                  />
                ))}
              </div>
            ) : (
              <p>No references saved for this generation.</p>
            )}
          </div>

          <div className={styles.viewerActions}>
            {generation.mode === "model" && (
              <button type='button' onClick={() => onSaveModel(generation)}>
                <Save size={17} />
                Save model
              </button>
            )}
            <button type='button' onClick={() => onDownloadAll(generation)}>
              <Download size={17} />
              All
            </button>
            <button type='button' onClick={() => onDelete(generation.id)}>
              <Trash2 size={17} />
              Delete
            </button>
          </div>
        </aside>
      </section>
    </div>
  )
}

function MediaPreview({
  src,
  alt,
  controls = false,
}: {
  src: string
  alt: string
  controls?: boolean
}) {
  const [failed, setFailed] = useState(src.startsWith("expired:"))

  useEffect(() => setFailed(src.startsWith("expired:")), [src])

  if (failed) {
    return (
      <span className={styles.mediaExpired}>
        <AlertTriangle size={22} />
        <strong>Output expired</strong>
        <small>WaveSpeed удалил временный файл</small>
      </span>
    )
  }

  if (isVideoMedia(src)) {
    return (
      <video
        src={src}
        onError={() => setFailed(true)}
        controls={controls}
        muted={!controls}
        playsInline
        loop={!controls}
      />
    )
  }

  return <img src={src} alt={alt} onError={() => setFailed(true)} />
}

function ReferenceUpload({
  title,
  description,
  images,
  onUpload,
  onClear,
}: {
  title: string
  description: string
  images: string[]
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void
  onClear: () => void
}) {
  return (
    <div className={styles.refBlock}>
      <div>
        <strong>{title}</strong>
        <button type='button' onClick={onClear}>
          Clear
        </button>
      </div>
      <label>
        <input type='file' accept='image/*' multiple onChange={onUpload} />
        {images.length === 0 ? (
          <>
            <Upload size={26} />
            <span>{description}</span>
          </>
        ) : (
          <div className={styles.thumbs}>
            {images.map((image, index) => (
              <img key={`${image.slice(0, 20)}-${index}`} src={image} alt='' />
            ))}
          </div>
        )}
      </label>
    </div>
  )
}
