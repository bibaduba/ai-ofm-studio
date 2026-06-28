"use client"

import styles from "./page.module.scss"
import { AppNavbar } from "@/app/components/shared/AppNavbar"
import { GeneratorPanel } from "@/app/components/main/GeneratorPanel"
import { GeminiSettingsModal } from "@/app/components/main/GeminiSettingsModal"
import { HistoryPanel } from "@/app/components/main/HistoryPanel"
import { ProfileSelector } from "@/app/components/main/ProfileSelector"
import { useGeminiStudio } from "@/app/hooks/useGeminiStudio"

export default function Home() {
  const studio = useGeminiStudio()

  return (
    <main className={styles.shell}>
      <AppNavbar
        subtitle={"Gemini API"}
        activeApp='gemini'
        theme={studio.theme}
        onToggleTheme={studio.toggleTheme}
        onOpenSettings={() => studio.setSettingsOpen(true)}
      >
        <ProfileSelector
          profiles={studio.profiles}
          activeProfile={studio.activeProfile}
          activeId={studio.profileId}
          open={studio.profileOpen}
          newName={studio.newProfileName}
          onToggle={() => studio.setProfileOpen((value) => !value)}
          onSelect={(id) => {
            studio.setProfileId(id)
            studio.setProfileOpen(false)
          }}
          onNewNameChange={studio.setNewProfileName}
          onCreate={studio.createProfile}
        />
      </AppNavbar>

      <section className={styles.studio}>
        <GeneratorPanel
          mediaType={studio.mediaType}
          sourceImages={studio.sourceImages}
          prompt={studio.prompt}
          model={studio.activeModel}
          resolution={studio.activeResolution}
          aspectRatio={studio.activeAspectRatio}
          durationSeconds={studio.durationSeconds}
          availableModels={studio.availableModels}
          availableAspectRatios={studio.availableAspectRatios}
          availableImageModelIds={studio.availableImageModelIds}
          availableVideoModelIds={studio.availableVideoModelIds}
          hasCheckedModels={studio.hasCheckedModels}
          loading={studio.loading}
          error={studio.error}
          onMediaTypeChange={studio.changeMediaType}
          onClearReferences={() => studio.setSourceImages([])}
          onFiles={studio.handleFiles}
          onRemoveReference={(index) =>
            studio.setSourceImages((current) =>
              current.filter((_, itemIndex) => itemIndex !== index),
            )
          }
          onPromptChange={(value) =>
            studio.mediaType === "image"
              ? studio.setImagePrompt(value)
              : studio.setVideoPrompt(value)
          }
          onModelChange={(value) =>
            studio.mediaType === "image"
              ? studio.setImageModel(value)
              : studio.setVideoModel(value)
          }
          onResolutionChange={(value) =>
            studio.mediaType === "image"
              ? studio.setImageResolution(value)
              : studio.setVideoResolution(value)
          }
          onAspectRatioChange={(value) =>
            studio.mediaType === "image"
              ? studio.setImageAspectRatio(value)
              : studio.setVideoAspectRatio(value)
          }
          onDurationChange={studio.setDurationSeconds}
          onGenerate={studio.generate}
        />
        <HistoryPanel
          profileName={studio.activeProfile?.name || "Personal"}
          generations={studio.generations}
          historyType={studio.historyType}
          favoritesOnly={studio.favoritesOnly}
          search={studio.search}
          view={studio.view}
          onHistoryTypeChange={(type) => {
            studio.setHistoryType(type)
            studio.setFavoritesOnly(false)
          }}
          onFavorites={() => studio.setFavoritesOnly(true)}
          onSearchChange={studio.setSearch}
          onViewChange={studio.setView}
          onFavorite={studio.toggleFavorite}
          onDelete={studio.deleteGeneration}
        />
      </section>

      {studio.settingsOpen && (
        <GeminiSettingsModal
          apiKey={studio.apiKey}
          wavespeedApiKey={studio.wavespeedApiKey}
          wavespeedEndpoint={studio.wavespeedEndpoint}
          showGeminiKey={studio.showGeminiKey}
          showWavespeedKey={studio.showWavespeedKey}
          checkingModels={studio.checkingModels}
          hasCheckedModels={studio.hasCheckedModels}
          imageModelIds={studio.availableImageModelIds}
          videoModelIds={studio.availableVideoModelIds}
          onClose={() => studio.setSettingsOpen(false)}
          onApiKeyChange={(value) => {
            studio.setApiKey(value)
            studio.resetAvailableModels()
          }}
          onWavespeedApiKeyChange={(value) => {
            studio.setWavespeedApiKey(value)
            localStorage.setItem("wavespeed-api-key", value)
          }}
          onEndpointChange={(value) => {
            studio.setWavespeedEndpoint(value)
            localStorage.setItem("wavespeed-endpoint", value)
          }}
          onToggleGeminiKey={() => studio.setShowGeminiKey((value) => !value)}
          onToggleWavespeedKey={() =>
            studio.setShowWavespeedKey((value) => !value)
          }
          onCheckModels={studio.checkModels}
        />
      )}
    </main>
  )
}
