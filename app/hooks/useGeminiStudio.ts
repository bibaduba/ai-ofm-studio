"use client"

import { ChangeEvent, useEffect, useMemo, useState } from "react"
import {
  imageAspectRatios,
  modelOptions,
  videoAspectRatios,
  videoModelOptions,
} from "@/app/components/main/constants"
import {
  Generation,
  HistoryType,
  MediaType,
  ModelsResponse,
  Profile,
  SourceImage,
} from "@/app/components/main/types"
import { fileToSourceImage } from "@/app/components/main/utils"

const wavespeedDefaultEndpoint =
  "https://api.wavespeed.ai/api/v3/bytedance/seedream-v4.5/edit-sequential"

export function useGeminiStudio() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [profileId, setProfileId] = useState("")
  const [newProfileName, setNewProfileName] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [wavespeedApiKey, setWavespeedApiKey] = useState("")
  const [wavespeedEndpoint, setWavespeedEndpoint] = useState(
    wavespeedDefaultEndpoint,
  )
  const [showGeminiKey, setShowGeminiKey] = useState(false)
  const [showWavespeedKey, setShowWavespeedKey] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [theme, setTheme] = useState<"light" | "dark">("light")
  const [mediaType, setMediaType] = useState<MediaType>("image")
  const [historyType, setHistoryType] = useState<HistoryType>("all")
  const [imagePrompt, setImagePrompt] = useState(
    "Создай глянцевую fashion-фотографию с мягким светом, естественной кожей, чистой композицией и премиальным editorial mood.",
  )
  const [videoPrompt, setVideoPrompt] = useState(
    "Cinematic fashion video, soft pink studio light, smooth camera push-in, elegant movement, realistic skin, premium editorial mood.",
  )
  const [imageModel, setImageModel] = useState(modelOptions[0].value)
  const [videoModel, setVideoModel] = useState(videoModelOptions[0].value)
  const [imageAspectRatio, setImageAspectRatio] = useState("1:1")
  const [videoAspectRatio, setVideoAspectRatio] = useState("16:9")
  const [imageResolution, setImageResolution] = useState("1K")
  const [videoResolution, setVideoResolution] = useState("720p")
  const [durationSeconds, setDurationSeconds] = useState("8")
  const [availableModelIds, setAvailableModelIds] = useState<string[] | null>(
    null,
  )
  const [availableImageModelIds, setAvailableImageModelIds] = useState<
    string[]
  >([])
  const [availableVideoModelIds, setAvailableVideoModelIds] = useState<
    string[]
  >([])
  const [checkingModels, setCheckingModels] = useState(false)
  const [sourceImages, setSourceImages] = useState<SourceImage[]>([])
  const [generations, setGenerations] = useState<Generation[]>([])
  const [search, setSearch] = useState("")
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [view, setView] = useState<"grid" | "list">("grid")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    setApiKey(localStorage.getItem("gemini-api-key") || "")
    setWavespeedApiKey(localStorage.getItem("wavespeed-api-key") || "")
    setWavespeedEndpoint(
      localStorage.getItem("wavespeed-endpoint") || wavespeedDefaultEndpoint,
    )
    const savedTheme =
      localStorage.getItem("studio-theme") === "dark" ? "dark" : "light"
    setTheme(savedTheme)
    document.documentElement.dataset.theme = savedTheme
    fetch("/api/profiles")
      .then(async (response) => {
        if (response.status === 401) {
          window.location.href = "/login"
          return []
        }
        const data = await response.json()
        return Array.isArray(data) ? (data as Profile[]) : []
      })
      .then((data) => {
        setProfiles(data)
        setProfileId(data[0]?.id || "")
      })
  }, [])

  useEffect(() => {
    if (!profileId) return
    const params = new URLSearchParams({ profileId, search })
    if (favoritesOnly) params.set("favorite", "true")
    if (historyType !== "all") params.set("mediaType", historyType)
    fetch(`/api/generations?${params.toString()}`)
      .then((response) => response.json())
      .then((data) => setGenerations(Array.isArray(data) ? data : []))
  }, [profileId, search, favoritesOnly, historyType])

  useEffect(() => {
    if (!settingsOpen) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSettingsOpen(false)
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [settingsOpen])

  const activeProfile = useMemo(
    () => profiles.find((profile) => profile.id === profileId),
    [profiles, profileId],
  )
  const prompt = mediaType === "image" ? imagePrompt : videoPrompt
  const activeModel = mediaType === "image" ? imageModel : videoModel
  const activeAspectRatio =
    mediaType === "image" ? imageAspectRatio : videoAspectRatio
  const activeResolution =
    mediaType === "image" ? imageResolution : videoResolution
  const availableModels =
    mediaType === "image" ? modelOptions : videoModelOptions
  const availableAspectRatios =
    mediaType === "image" ? imageAspectRatios : videoAspectRatios
  const hasCheckedModels = availableModelIds !== null
  const currentModelIsAvailable =
    !availableModelIds ||
    (mediaType === "image"
      ? availableImageModelIds.includes(imageModel)
      : availableVideoModelIds.includes(videoModel))

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark"
    setTheme(nextTheme)
    localStorage.setItem("studio-theme", nextTheme)
    document.documentElement.dataset.theme = nextTheme
  }

  function changeMediaType(type: MediaType) {
    setMediaType(type)
    setError("")
    if (type === "video") setSourceImages((current) => current.slice(0, 3))
  }

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || [])
    if (!files.length) return
    const maxImages = mediaType === "video" ? 3 : 14
    const nextImages = await Promise.all(
      files.slice(0, maxImages).map(fileToSourceImage),
    )
    setSourceImages((current) =>
      [...current, ...nextImages].slice(0, maxImages),
    )
    event.target.value = ""
  }

  async function createProfile() {
    const name = newProfileName.trim()
    if (!name) return
    const response = await fetch("/api/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
    const profile = await response.json()
    if (!response.ok) {
      setError(profile.error || "Не удалось создать профиль.")
      return
    }
    setProfiles((current) => [
      profile,
      ...current.filter((item) => item.id !== profile.id),
    ])
    setProfileId(profile.id)
    setNewProfileName("")
    setProfileOpen(false)
  }

  async function checkModels() {
    setError("")

    if (!apiKey.trim()) {
      setError("Добавьте Gemini API key, чтобы проверить доступные модели.")
      return
    }
    localStorage.setItem("gemini-api-key", apiKey.trim())
    setCheckingModels(true)
    try {
      const response = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      })
      const data = (await response.json()) as ModelsResponse & {
        error?: string
      }
      if (!response.ok)
        throw new Error(data.error || "Не удалось проверить модели.")
      setAvailableModelIds(data.models.map((model) => model.id))
      setAvailableImageModelIds(data.imageModelIds)
      setAvailableVideoModelIds(data.videoModelIds)
      if (data.imageModelIds.length) setImageModel(data.imageModelIds[0])
      if (data.videoModelIds.length) setVideoModel(data.videoModelIds[0])
      if (!data.imageModelIds.length && !data.videoModelIds.length)
        setError(
          "Этот ключ видит только text-модели. Для картинок нужен доступ к image-модели Gemini.",
        )
    } catch (modelsError) {
      setError(
        modelsError instanceof Error
          ? modelsError.message
          : "Ошибка проверки моделей.",
      )
    } finally {
      setCheckingModels(false)
    }
  }

  async function generate() {
    setError("")
    if (!profileId || !apiKey.trim() || !prompt.trim()) {
      setError("Выберите профиль, добавьте Gemini API key.")
      return
    }

    if (!currentModelIsAvailable) {
      setError(
        mediaType === "image"
          ? "Выбранная image-модель недоступна этому ключу."
          : "Выбранная video-модель недоступна этому ключу.",
      )
      return
    }
    localStorage.setItem("gemini-api-key", apiKey.trim())
    setLoading(true)
    try {
      const response = await fetch("/api/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId,
          apiKey: apiKey.trim(),
          mediaType,
          prompt,
          model: activeModel,
          aspectRatio: activeAspectRatio,
          resolution: activeResolution,
          durationSeconds,
          sourceImages,
        }),
      })
      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error || "Не удалось сгенерировать.")
      setGenerations((current) => [data, ...current])
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Ошибка генерации.",
      )
    } finally {
      setLoading(false)
    }
  }

  async function toggleFavorite(item: Generation) {
    const response = await fetch("/api/generations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, favorite: !item.favorite }),
    })
    const updated = await response.json()
    setGenerations((current) =>
      current.map((generation) =>
        generation.id === updated.id ? updated : generation,
      ),
    )
  }

  async function deleteGeneration(id: string) {
    await fetch(`/api/generations?id=${id}`, { method: "DELETE" })
    setGenerations((current) =>
      current.filter((generation) => generation.id !== id),
    )
  }

  function resetAvailableModels() {
    setAvailableModelIds(null)
    setAvailableImageModelIds([])
    setAvailableVideoModelIds([])
  }

  return {
    profiles,
    profileId,
    setProfileId,
    newProfileName,
    setNewProfileName,
    apiKey,
    setApiKey,
    wavespeedApiKey,
    setWavespeedApiKey,
    wavespeedEndpoint,
    setWavespeedEndpoint,
    showGeminiKey,
    setShowGeminiKey,
    showWavespeedKey,
    setShowWavespeedKey,
    settingsOpen,
    setSettingsOpen,
    profileOpen,
    setProfileOpen,
    theme,
    mediaType,
    historyType,
    setHistoryType,
    imagePrompt,
    setImagePrompt,
    videoPrompt,
    setVideoPrompt,
    imageModel,
    setImageModel,
    videoModel,
    setVideoModel,
    imageAspectRatio,
    setImageAspectRatio,
    videoAspectRatio,
    setVideoAspectRatio,
    imageResolution,
    setImageResolution,
    videoResolution,
    setVideoResolution,
    durationSeconds,
    setDurationSeconds,
    availableImageModelIds,
    setAvailableImageModelIds,
    availableVideoModelIds,
    setAvailableVideoModelIds,
    sourceImages,
    setSourceImages,
    generations,
    search,
    setSearch,
    favoritesOnly,
    setFavoritesOnly,
    view,
    setView,
    loading,
    checkingModels,
    error,
    setError,
    activeProfile,
    prompt,
    activeModel,
    activeAspectRatio,
    activeResolution,
    availableModels,
    availableAspectRatios,
    hasCheckedModels,
    toggleTheme,
    changeMediaType,
    handleFiles,
    createProfile,
    checkModels,
    generate,
    toggleFavorite,
    deleteGeneration,
    resetAvailableModels,
  }
}
