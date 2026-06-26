"use client";

import {
  ChevronDown,
  Download,
  Eye,
  EyeOff,
  Grid2X2,
  Heart,
  ImageIcon,
  KeyRound,
  List,
  Loader2,
  Moon,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  UserRound,
  Wand2,
  X
} from "lucide-react";
import Link from "next/link";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import styles from "./page.module.scss";
import { AccountPanel } from "@/app/components/AccountPanel";

type MediaType = "image" | "video";

type Profile = {
  id: string;
  name: string;
};

type SourceImage = {
  dataUrl: string;
  mimeType: string;
};

type Generation = {
  id: string;
  mediaType: MediaType;
  prompt: string;
  imageData: string;
  sourceImages: string | null;
  model: string;
  aspectRatio: string;
  resolution: string;
  favorite: boolean;
  createdAt: string;
};

type ModelsResponse = {
  models: Array<{ id: string; displayName?: string }>;
  imageModelIds: string[];
  videoModelIds: string[];
};

const modelOptions = [
  { value: "gemini-2.5-flash-image", label: "Nano Banana" },
  { value: "gemini-3-pro-image-preview", label: "Nano Banana Pro" }
];

const videoModelOptions = [
  { value: "veo-3.1-fast-generate-preview", label: "Veo 3.1 Fast" },
  { value: "veo-3.1-generate-preview", label: "Veo 3.1" },
  { value: "veo-3.1-lite-generate-preview", label: "Veo 3.1 Lite" },
  { value: "veo-3.0-fast-generate-001", label: "Veo 3 Fast" }
];

const imageAspectRatios = ["1:1", "2:3", "3:2", "3:4", "4:5", "9:16", "16:9"];
const videoAspectRatios = ["16:9", "9:16"];
const resolutions = ["1K", "2K", "4K"];
const videoResolutions = ["720p", "1080p", "4k"];
const videoDurations = ["4", "6", "8"];

function fileToSourceImage(file: File): Promise<SourceImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({ dataUrl: String(reader.result), mimeType: file.type || "image/png" });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export default function Home() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profileId, setProfileId] = useState("");
  const [newProfileName, setNewProfileName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [wavespeedApiKey, setWavespeedApiKey] = useState("");
  const [wavespeedEndpoint, setWavespeedEndpoint] = useState(
    "https://api.wavespeed.ai/api/v3/bytedance/seedream-v4.5/edit-sequential"
  );
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showWavespeedKey, setShowWavespeedKey] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mediaType, setMediaType] = useState<MediaType>("image");
  const [historyType, setHistoryType] = useState<"all" | MediaType>("all");
  const [imagePrompt, setImagePrompt] = useState(
    "Создай глянцевую fashion-фотографию с мягким светом, естественной кожей, чистой композицией и премиальным editorial mood."
  );
  const [videoPrompt, setVideoPrompt] = useState(
    "Cinematic fashion video, soft pink studio light, smooth camera push-in, elegant movement, realistic skin, premium editorial mood."
  );
  const [imageModel, setImageModel] = useState(modelOptions[0].value);
  const [videoModel, setVideoModel] = useState(videoModelOptions[0].value);
  const [imageAspectRatio, setImageAspectRatio] = useState("1:1");
  const [videoAspectRatio, setVideoAspectRatio] = useState("16:9");
  const [imageResolution, setImageResolution] = useState("1K");
  const [videoResolution, setVideoResolution] = useState("720p");
  const [durationSeconds, setDurationSeconds] = useState("8");
  const [availableModelIds, setAvailableModelIds] = useState<string[] | null>(null);
  const [availableImageModelIds, setAvailableImageModelIds] = useState<string[]>([]);
  const [availableVideoModelIds, setAvailableVideoModelIds] = useState<string[]>([]);
  const [checkingModels, setCheckingModels] = useState(false);
  const [sourceImages, setSourceImages] = useState<SourceImage[]>([]);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [search, setSearch] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setApiKey(localStorage.getItem("gemini-api-key") || "");
    setWavespeedApiKey(localStorage.getItem("wavespeed-api-key") || "");
    setWavespeedEndpoint(
      localStorage.getItem("wavespeed-endpoint") ||
        "https://api.wavespeed.ai/api/v3/bytedance/seedream-v4.5/edit-sequential"
    );
    setDemoMode(localStorage.getItem("studio-demo-mode") === "true");
    const savedTheme = localStorage.getItem("studio-theme") === "dark" ? "dark" : "light";
    setTheme(savedTheme);
    document.documentElement.dataset.theme = savedTheme;
    fetch("/api/profiles")
      .then((res) => res.json())
      .then((data: Profile[]) => {
        setProfiles(data);
        setProfileId(data[0]?.id || "");
      });
  }, []);

  useEffect(() => {
    if (!profileId) return;
    const params = new URLSearchParams({ profileId, search });
    if (favoritesOnly) params.set("favorite", "true");
    if (historyType !== "all") params.set("mediaType", historyType);
    fetch(`/api/generations?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => setGenerations(Array.isArray(data) ? data : []));
  }, [profileId, search, favoritesOnly, historyType]);

  useEffect(() => {
    if (!settingsOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSettingsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [settingsOpen]);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("studio-theme", nextTheme);
    document.documentElement.dataset.theme = nextTheme;
  }

  const activeProfile = useMemo(
    () => profiles.find((profile) => profile.id === profileId),
    [profiles, profileId]
  );
  const prompt = mediaType === "image" ? imagePrompt : videoPrompt;
  const activeModel = mediaType === "image" ? imageModel : videoModel;
  const activeAspectRatio = mediaType === "image" ? imageAspectRatio : videoAspectRatio;
  const activeResolution = mediaType === "image" ? imageResolution : videoResolution;
  const availableModels = mediaType === "image" ? modelOptions : videoModelOptions;
  const availableAspectRatios = mediaType === "image" ? imageAspectRatios : videoAspectRatios;
  const currentModelIsAvailable =
    !availableModelIds ||
    (mediaType === "image"
      ? availableImageModelIds.includes(imageModel)
      : availableVideoModelIds.includes(videoModel));
  const hasCheckedModels = availableModelIds !== null;

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    const maxImages = mediaType === "video" ? 3 : 14;
    const nextImages = await Promise.all(files.slice(0, maxImages).map(fileToSourceImage));
    setSourceImages((current) => [...current, ...nextImages].slice(0, maxImages));
    event.target.value = "";
  }

  async function createProfile() {
    const name = newProfileName.trim();
    if (!name) return;
    const response = await fetch("/api/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    });
    const profile = await response.json();
    setProfiles((current) => [profile, ...current.filter((item) => item.id !== profile.id)]);
    setProfileId(profile.id);
    setNewProfileName("");
  }

  async function checkModels() {
    setError("");
    if (demoMode) {
      setAvailableModelIds(modelOptions.map((option) => option.value));
      setAvailableImageModelIds(modelOptions.map((option) => option.value));
      setAvailableVideoModelIds([]);
      setError("Demo mode не обращается к Google. Для реальной проверки моделей отключите Demo mode.");
      return;
    }
    if (!apiKey.trim()) {
      setError("Добавьте Gemini API key, чтобы проверить доступные модели.");
      return;
    }

    localStorage.setItem("gemini-api-key", apiKey.trim());
    setCheckingModels(true);
    try {
      const response = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() })
      });
      const data = (await response.json()) as ModelsResponse & { error?: string };
      if (!response.ok) throw new Error(data.error || "Не удалось проверить модели.");

      const ids = data.models.map((model) => model.id);
      setAvailableModelIds(ids);
      setAvailableImageModelIds(data.imageModelIds);
      setAvailableVideoModelIds(data.videoModelIds);

      if (data.imageModelIds.length > 0) {
        setImageModel(data.imageModelIds[0]);
      }
      if (data.videoModelIds.length > 0) {
        setVideoModel(data.videoModelIds[0]);
      }

      if (data.imageModelIds.length === 0 && data.videoModelIds.length === 0) {
        setError(
          "Этот ключ видит только text-модели. Для картинок нужен доступ к gemini-2.5-flash-image или gemini-3-pro-image-preview."
        );
      }
    } catch (modelsError) {
      setError(modelsError instanceof Error ? modelsError.message : "Ошибка проверки моделей.");
    } finally {
      setCheckingModels(false);
    }
  }

  async function generate() {
    setError("");
    if (!profileId || (!demoMode && !apiKey.trim()) || !prompt.trim()) {
      setError("Выберите профиль, добавьте Gemini API key или включите Demo mode, и заполните prompt.");
      return;
    }
    if (demoMode && mediaType === "video") {
      setError("Demo mode сейчас генерирует mock-картинки. Переключитесь на Image для проверки без ключа.");
      return;
    }
    if (!currentModelIsAvailable) {
      setError(
        mediaType === "image"
          ? "Выбранная image-модель недоступна этому ключу. Нажмите Check models или используйте ключ с доступом к Nano Banana."
          : "Выбранная video-модель недоступна этому ключу. Нажмите Check models или используйте ключ с доступом к Veo."
      );
      return;
    }

    if (!demoMode) {
      localStorage.setItem("gemini-api-key", apiKey.trim());
    }
    setLoading(true);
    try {
      const response = await fetch("/api/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId,
          apiKey: demoMode ? "" : apiKey.trim(),
          mock: demoMode,
          mediaType,
          prompt,
          model: activeModel,
          aspectRatio: activeAspectRatio,
          resolution: activeResolution,
          durationSeconds,
          sourceImages
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось сгенерировать.");
      setGenerations((current) => [data, ...current]);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Ошибка генерации.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleFavorite(item: Generation) {
    const response = await fetch("/api/generations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, favorite: !item.favorite })
    });
    const updated = await response.json();
    setGenerations((current) =>
      current.map((generation) => (generation.id === updated.id ? updated : generation))
    );
  }

  async function deleteGeneration(id: string) {
    await fetch(`/api/generations?id=${id}`, { method: "DELETE" });
    setGenerations((current) => current.filter((generation) => generation.id !== id));
  }

  return (
    <main className={styles.shell}>
      <nav className={styles.navbar}>
        <div className={styles.brand}>
          <div className={styles.brandMark}>
            <Sparkles size={20} />
          </div>
          <div>
            <strong>AI OFM Studio</strong>
            <span>{demoMode ? "Demo mode" : "Gemini API"}</span>
          </div>
        </div>

        <div className={styles.navProfile}>
          <button type="button" className={styles.profileTrigger} onClick={() => setProfileOpen((value) => !value)}>
            <UserRound size={17} />
            <span>{activeProfile?.name || "Profile"}</span>
            <ChevronDown size={16} />
          </button>
          {profileOpen && (
            <div className={styles.profileMenu}>
              {profiles.map((profile) => (
                <button
                  type="button"
                  className={profile.id === profileId ? styles.profileActive : ""}
                  key={profile.id}
                  onClick={() => {
                    setProfileId(profile.id);
                    setProfileOpen(false);
                  }}
                >
                  {profile.name}
                </button>
              ))}
              <div className={styles.profileCreate}>
                <input
                  value={newProfileName}
                  onChange={(event) => setNewProfileName(event.target.value)}
                  placeholder="New profile"
                />
                <button type="button" aria-label="Create profile" onClick={createProfile}>
                  <Plus size={16} />
                </button>
              </div>
            </div>
          )}
        </div>

        <button className={styles.themeToggle} type="button" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === "dark" ? <Moon size={17} /> : <Sun size={17} />}
          <span />
        </button>
        <button className={styles.settingsButton} type="button" onClick={() => setSettingsOpen(true)} aria-label="Settings">
          <Settings2 size={19} />
        </button>
        <div className={styles.appSwitch}>
          <Link className={styles.switchActive} href="/">
            Gemini
          </Link>
          <Link href="/wavespeed">Wavespeed</Link>
        </div>
      </nav>

      <section className={styles.studio}>
        <aside className={styles.generatorPanel}>
          <div className={styles.tabs}>
            <button
              className={mediaType === "image" ? styles.activeTab : ""}
              type="button"
              onClick={() => {
                setMediaType("image");
                setError("");
              }}
            >
              Image
            </button>
            <button
              className={mediaType === "video" ? styles.activeTab : ""}
              type="button"
              onClick={() => {
                setMediaType("video");
                setError("");
                setSourceImages((current) => current.slice(0, 3));
              }}
            >
              Video
            </button>
            <button className={styles.clearButton} type="button" onClick={() => setSourceImages([])}>
              Clear
            </button>
          </div>

          <div className={styles.uploadHeader}>
            <div className={styles.badgeIcon}>
              <ImageIcon size={18} />
            </div>
            <span>{mediaType === "image" ? "Reference Images" : "Start / Reference Frames"}</span>
          </div>

          <label className={styles.dropzone}>
            <input multiple accept="image/*" type="file" onChange={handleFiles} />
            <Upload size={30} />
            <strong>{mediaType === "image" ? "Upload Your Images" : "Upload Video Frames"}</strong>
            <span>
              {sourceImages.length}/{mediaType === "image" ? 14 : 3} reference images
            </span>
          </label>

          {sourceImages.length > 0 && (
            <div className={styles.referenceGrid}>
              {sourceImages.map((image, index) => (
                <div className={styles.referenceThumb} key={`${image.dataUrl.slice(0, 24)}-${index}`}>
                  <img alt="" src={image.dataUrl} />
                  <button
                    type="button"
                    aria-label="Remove reference"
                    onClick={() =>
                      setSourceImages((current) => current.filter((_, itemIndex) => itemIndex !== index))
                    }
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className={styles.settings}>
            <div className={styles.settingsTitle}>
              <Settings2 size={18} />
              <span>Advanced Settings</span>
            </div>

            <label className={styles.field}>
              <span>Prompt</span>
              <textarea
                value={prompt}
                onChange={(event) =>
                  mediaType === "image"
                    ? setImagePrompt(event.target.value)
                    : setVideoPrompt(event.target.value)
                }
              />
            </label>

            <div className={styles.fieldGrid}>
              <label className={styles.field}>
                <span>Model</span>
                <select
                  value={activeModel}
                  onChange={(event) =>
                    mediaType === "image"
                      ? setImageModel(event.target.value)
                      : setVideoModel(event.target.value)
                  }
                >
                  {availableModels.map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                      disabled={
                        hasCheckedModels &&
                        (mediaType === "image"
                          ? !availableImageModelIds.includes(option.value)
                          : !availableVideoModelIds.includes(option.value))
                      }
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>Resolution</span>
                <select
                  value={activeResolution}
                  onChange={(event) =>
                    mediaType === "image"
                      ? setImageResolution(event.target.value)
                      : setVideoResolution(event.target.value)
                  }
                >
                  {(mediaType === "image" ? resolutions : videoResolutions).map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
            </div>

            {mediaType === "image" && imageModel === "gemini-3-pro-image-preview" && (
              <p className={styles.modelHint}>
                Nano Banana Pro обычно требует включенный billing и доступную квоту проекта.
              </p>
            )}

            {mediaType === "video" && (
              <div className={styles.segmented}>
                {videoDurations.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={durationSeconds === item ? styles.selected : ""}
                    onClick={() => setDurationSeconds(item)}
                  >
                    {item}s
                  </button>
                ))}
              </div>
            )}

            <div className={styles.segmented}>
              {availableAspectRatios.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={activeAspectRatio === item ? styles.selected : ""}
                  onClick={() =>
                    mediaType === "image" ? setImageAspectRatio(item) : setVideoAspectRatio(item)
                  }
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button className={styles.generateButton} type="button" onClick={generate} disabled={loading}>
            {loading ? <Loader2 className={styles.spin} size={20} /> : <Wand2 size={20} />}
            Generate {mediaType === "image" ? "Image" : "Video"}
          </button>
        </aside>

        <section className={styles.historyPanel}>
          <header className={styles.historyHeader}>
            <div>
              <span className={styles.eyebrow}>{activeProfile?.name || "Personal"}</span>
              <h1>History</h1>
            </div>
            <div className={styles.controls}>
              <button
                className={historyType === "all" && !favoritesOnly ? styles.controlActive : ""}
                type="button"
                onClick={() => {
                  setHistoryType("all");
                  setFavoritesOnly(false);
                }}
              >
                All
              </button>
              <button
                className={historyType === "image" && !favoritesOnly ? styles.controlActive : ""}
                type="button"
                onClick={() => {
                  setHistoryType("image");
                  setFavoritesOnly(false);
                }}
              >
                <ImageIcon size={18} />
                Image
              </button>
              <button
                className={historyType === "video" && !favoritesOnly ? styles.controlActive : ""}
                type="button"
                onClick={() => {
                  setHistoryType("video");
                  setFavoritesOnly(false);
                }}
              >
                Video
              </button>
              <button
                className={favoritesOnly ? styles.controlActive : ""}
                type="button"
                onClick={() => setFavoritesOnly(true)}
              >
                <Heart size={18} />
                Favorites
              </button>
              <div className={styles.search}>
                <Search size={18} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search"
                />
              </div>
              <div className={styles.viewToggle}>
                <button
                  className={view === "list" ? styles.controlActive : ""}
                  type="button"
                  aria-label="List view"
                  onClick={() => setView("list")}
                >
                  <List size={18} />
                </button>
                <button
                  className={view === "grid" ? styles.controlActive : ""}
                  type="button"
                  aria-label="Grid view"
                  onClick={() => setView("grid")}
                >
                  <Grid2X2 size={18} />
                </button>
              </div>
            </div>
          </header>

          {generations.length === 0 ? (
            <div className={styles.emptyState}>
              <Sparkles size={32} />
              <h2>No generations yet</h2>
              <p>Сгенерированные изображения и видео появятся здесь вместе с prompt и настройками.</p>
            </div>
          ) : (
            <div className={view === "grid" ? styles.historyGrid : styles.historyList}>
              {generations.map((item) => {
                const references = item.sourceImages ? (JSON.parse(item.sourceImages) as SourceImage[]) : [];
                return (
                  <article className={styles.historyCard} key={item.id}>
                    <div className={styles.imageWrap}>
                      {item.mediaType === "video" ? (
                        <video controls playsInline src={item.imageData} />
                      ) : (
                        <img alt={item.prompt} src={item.imageData} />
                      )}
                      <button type="button" onClick={() => toggleFavorite(item)} aria-label="Favorite">
                        <Heart fill={item.favorite ? "currentColor" : "none"} size={24} />
                      </button>
                    </div>
                    <div className={styles.cardBody}>
                      <div className={styles.cardMeta}>
                        <span>{item.mediaType}</span>
                        <span>{item.model.replace("gemini-", "")}</span>
                      </div>
                      <h2>Prompt</h2>
                      <p>{item.prompt}</p>
                      {references.length > 0 && (
                        <div className={styles.referenceStrip}>
                          {references.slice(0, 5).map((reference, index) => (
                            <img alt="" src={reference.dataUrl} key={`${item.id}-${index}`} />
                          ))}
                        </div>
                      )}
                      <div className={styles.pills}>
                        <span>{item.aspectRatio}</span>
                        <span>{item.resolution}</span>
                        <span>{formatDate(item.createdAt)}</span>
                      </div>
                      <div className={styles.cardActions}>
                        <a
                          href={item.imageData}
                          download={`generation-${item.id}.${item.mediaType === "video" ? "mp4" : "png"}`}
                        >
                          <Download size={18} />
                        </a>
                        <button type="button" onClick={() => deleteGeneration(item.id)} aria-label="Delete">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </section>

      {settingsOpen && (
        <div
          className={styles.modalOverlay}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSettingsOpen(false);
          }}
        >
          <section className={styles.settingsModal} role="dialog" aria-modal="true" aria-label="Settings">
            <header className={styles.modalHeader}>
              <div>
                <span className={styles.eyebrow}>Workspace</span>
                <h2>Settings</h2>
              </div>
              <button type="button" aria-label="Close settings" onClick={() => setSettingsOpen(false)}>
                <X size={20} />
              </button>
            </header>

            <div className={styles.modalSection}>
              <label>Gemini API key</label>
              <div className={styles.keyBox}>
                <KeyRound size={18} />
                <input
                  type={showGeminiKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(event) => {
                    setApiKey(event.target.value);
                    setAvailableModelIds(null);
                    setAvailableImageModelIds([]);
                    setAvailableVideoModelIds([]);
                  }}
                  placeholder="Gemini API key"
                  disabled={demoMode}
                />
                <button type="button" onClick={() => setShowGeminiKey((value) => !value)} aria-label="Toggle Gemini key visibility">
                  {showGeminiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <button type="button" onClick={checkModels} disabled={checkingModels}>
                  {checkingModels ? <Loader2 className={styles.spin} size={16} /> : "Check"}
                </button>
              </div>
            </div>

            <div className={styles.modalSection}>
              <label>Wavespeed API key</label>
              <div className={styles.keyBox}>
                <KeyRound size={18} />
                <input
                  type={showWavespeedKey ? "text" : "password"}
                  value={wavespeedApiKey}
                  onChange={(event) => {
                    setWavespeedApiKey(event.target.value);
                    localStorage.setItem("wavespeed-api-key", event.target.value);
                  }}
                  placeholder="Wavespeed API key"
                  disabled={demoMode}
                />
                <button type="button" onClick={() => setShowWavespeedKey((value) => !value)} aria-label="Toggle Wavespeed key visibility">
                  {showWavespeedKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className={styles.modalSection}>
              <label>Wavespeed endpoint</label>
              <input
                className={styles.settingsInput}
                value={wavespeedEndpoint}
                onChange={(event) => {
                  setWavespeedEndpoint(event.target.value);
                  localStorage.setItem("wavespeed-endpoint", event.target.value);
                }}
                disabled={demoMode}
              />
            </div>

            <label className={styles.demoToggle}>
              <input
                type="checkbox"
                checked={demoMode}
              onChange={(event) => {
                setDemoMode(event.target.checked);
                localStorage.setItem("studio-demo-mode", String(event.target.checked));
                setError("");
              }}
              />
              <span>Demo mode без Google API</span>
            </label>

            {hasCheckedModels && (
              <div className={styles.modelStatus}>
                <span>
                  Image:{" "}
                  {availableImageModelIds.length > 0
                    ? availableImageModelIds.join(", ")
                    : "нет доступных image-моделей"}
                </span>
                <span>
                  Video:{" "}
                  {availableVideoModelIds.length > 0
                    ? availableVideoModelIds.join(", ")
                    : "нет доступных Veo-моделей"}
                </span>
              </div>
            )}
            <AccountPanel />
          </section>
        </div>
      )}
    </main>
  );
}
