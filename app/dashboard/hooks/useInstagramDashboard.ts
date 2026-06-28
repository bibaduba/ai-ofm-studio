"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Toast } from "@/app/components/wavespeed/types"
import {
  InstagramInsights,
  InstagramModel,
} from "@/app/components/dashboard/types"

export function useInstagramDashboard() {
  const [models, setModels] = useState<InstagramModel[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [configured, setConfigured] = useState(true)
  const [configurationError, setConfigurationError] = useState("")
  const [days, setDays] = useState(30)
  const [insights, setInsights] = useState<InstagramInsights | null>(null)
  const [loadingModels, setLoadingModels] = useState(true)
  const [loadingInsights, setLoadingInsights] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [error, setError] = useState("")
  const [reconnectRequired, setReconnectRequired] = useState(false)
  const [theme, setTheme] = useState<"light" | "dark">("light")
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = crypto.randomUUID()
      setToasts((current) => [{ id, ...toast }, ...current].slice(0, 4))
      window.setTimeout(() => removeToast(id), 4500)
    },
    [removeToast],
  )

  const selectedModel = useMemo(
    () => models.find((model) => model.id === selectedId),
    [models, selectedId],
  )

  const loadModels = useCallback(async () => {
    setLoadingModels(true)
    try {
      const response = await fetch("/api/instagram/connections", {
        cache: "no-store",
      })
      if (response.status === 401) {
        window.location.href = "/login"
        return
      }
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Models loading failed.")
      setModels(data.models)
      setConfigured(data.configured)
      setConfigurationError(data.configurationError || "")
      setSelectedId((current) => {
        const requested = new URLSearchParams(window.location.search).get(
          "model",
        )
        if (
          requested &&
          data.models.some((model: InstagramModel) => model.id === requested)
        ) {
          return requested
        }
        if (
          current &&
          data.models.some((model: InstagramModel) => model.id === current)
        ) {
          return current
        }
        return (
          data.models.find((model: InstagramModel) => model.connectionId)?.id ||
          data.models[0]?.id ||
          ""
        )
      })
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Models loading failed.",
      )
    } finally {
      setLoadingModels(false)
    }
  }, [])

  useEffect(() => {
    const savedTheme =
      localStorage.getItem("studio-theme") === "dark" ? "dark" : "light"
    setTheme(savedTheme)
    document.documentElement.dataset.theme = savedTheme

    const params = new URLSearchParams(window.location.search)
    const status = params.get("instagram")
    const message = params.get("message") || undefined
    if (status === "connected") {
      showToast({
        type: "success",
        title: "Instagram connected",
        message: "Статистика аккаунта доступна в dashboard.",
      })
    } else if (status) {
      showToast({
        type: "error",
        title: "Instagram connection failed",
        message: message || "Повтори подключение аккаунта.",
      })
    }
    if (status) {
      params.delete("instagram")
      params.delete("message")
      const query = params.toString()
      window.history.replaceState(
        {},
        "",
        `/dashboard${query ? `?${query}` : ""}`,
      )
    }
    loadModels()
  }, [loadModels, showToast])

  useEffect(() => {
    if (!selectedModel?.connectionId) {
      setInsights(null)
      setError("")
      setReconnectRequired(false)
      return
    }

    let active = true
    setLoadingInsights(true)
    setError("")
    setReconnectRequired(false)
    fetch(`/api/instagram/insights?modelId=${selectedModel.id}&days=${days}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) {
          const requestError = new Error(
            data.error || "Instagram statistics loading failed.",
          ) as Error & { reconnectRequired?: boolean }
          requestError.reconnectRequired = Boolean(data.reconnectRequired)
          throw requestError
        }
        if (active) setInsights(data)
      })
      .catch((requestError: Error & { reconnectRequired?: boolean }) => {
        if (!active) return
        setInsights(null)
        setError(requestError.message)
        setReconnectRequired(Boolean(requestError.reconnectRequired))
      })
      .finally(() => active && setLoadingInsights(false))

    return () => {
      active = false
    }
  }, [days, refreshKey, selectedModel])

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark"
    setTheme(nextTheme)
    localStorage.setItem("studio-theme", nextTheme)
    document.documentElement.dataset.theme = nextTheme
  }

  function selectModel(id: string) {
    setSelectedId(id)
    const url = new URL(window.location.href)
    url.searchParams.set("model", id)
    window.history.replaceState({}, "", `${url.pathname}?${url.searchParams}`)
  }

  function connectInstagram(modelId: string) {
    window.location.href = `/api/instagram/oauth/start?modelId=${encodeURIComponent(modelId)}`
  }

  async function disconnectInstagram(modelId: string) {
    if (!window.confirm("Отключить Instagram от этой модели?")) return
    const response = await fetch(
      `/api/instagram/connections?modelId=${encodeURIComponent(modelId)}`,
      { method: "DELETE" },
    )
    const data = await response.json()
    if (!response.ok) {
      showToast({
        type: "error",
        title: "Instagram was not disconnected",
        message: data.error,
      })
      return
    }
    setInsights(null)
    await loadModels()
    showToast({ type: "success", title: "Instagram disconnected" })
  }

  return {
    models,
    selectedId,
    selectedModel,
    configured,
    configurationError,
    days,
    setDays,
    refreshInsights: () => setRefreshKey((value) => value + 1),
    insights,
    loadingModels,
    loadingInsights,
    error,
    reconnectRequired,
    theme,
    toasts,
    removeToast,
    toggleTheme,
    selectModel,
    connectInstagram,
    disconnectInstagram,
  }
}
