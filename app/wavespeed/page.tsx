"use client"

import styles from "./wavespeed.module.scss"
import { AppNavbar } from "@/app/components/shared/AppNavbar"
import { GenerationModal } from "@/app/components/wavespeed/GenerationModal"
import { GenerationResults } from "@/app/components/wavespeed/GenerationResults"
import { ModelForm } from "@/app/components/wavespeed/ModelForm"
import { MotionForm } from "@/app/components/wavespeed/MotionForm"
import { SceneForm } from "@/app/components/wavespeed/SceneForm"
import { ToastStack } from "@/app/components/wavespeed/ToastStack"
import { WavespeedSettingsModal } from "@/app/components/wavespeed/WavespeedSettingsModal"
import { WorkspaceTabs } from "@/app/components/wavespeed/WorkspaceTabs"
import { useWavespeedStudio } from "./hooks/useWavespeedStudio"

export default function WavespeedPage() {
  const studio = useWavespeedStudio()

  return (
    <main className={styles.shell}>
      <ToastStack toasts={studio.toasts} onClose={studio.removeToast} />
      <AppNavbar
        subtitle='AI Instagram model workflow'
        activeApp='wavespeed'
        theme={studio.theme}
        onToggleTheme={studio.toggleTheme}
        onOpenSettings={() => studio.setSettingsOpen(true)}
      />
      <WorkspaceTabs active={studio.tab} onChange={studio.setTab} />

      <section className={styles.workspace}>
        <aside className={styles.panel}>
          {studio.tab === "model" && (
            <ModelForm
              name={studio.modelName}
              faceReferences={studio.faceReferences}
              bodyReferences={studio.bodyReferences}
              count={studio.count}
              prompt={studio.modelPrompt}
              loading={studio.loading}
              onNameChange={studio.setModelName}
              onFaceUpload={(event) =>
                studio.uploadRefs(event, studio.setFaceReferences, 2)
              }
              onBodyUpload={(event) =>
                studio.uploadRefs(event, studio.setBodyReferences, 2)
              }
              onClearFace={() => studio.setFaceReferences([])}
              onClearBody={() => studio.setBodyReferences([])}
              onCountChange={studio.setCount}
              onPromptChange={studio.setModelPrompt}
              onSave={studio.saveModel}
              onGenerate={() => studio.generate("model")}
            />
          )}
          {studio.tab === "scene" && (
            <SceneForm
              models={studio.models}
              selectedModel={studio.selectedModel}
              selectedModelId={studio.selectedModelId}
              sceneReference={studio.sceneReference}
              count={studio.count}
              prompt={studio.scenePrompt}
              loading={studio.loading}
              promptLoading={studio.promptLoading}
              onModelChange={studio.setSelectedModelId}
              onSceneUpload={studio.uploadScene}
              onCountChange={studio.setCount}
              onPromptChange={studio.setScenePrompt}
              onGeneratePrompt={studio.generateScenePrompt}
              onGenerate={() => studio.generate("scene")}
            />
          )}
          {studio.tab === "motion" && (
            <MotionForm
              image={studio.motionImage}
              video={studio.motionVideo}
              orientation={studio.characterOrientation}
              prompt={studio.motionPrompt}
              negativePrompt={studio.motionNegativePrompt}
              keepOriginalSound={studio.keepOriginalSound}
              loading={studio.loading}
              onImageUpload={(event) =>
                studio.uploadMotionFile(event, studio.setMotionImage)
              }
              onVideoUpload={(event) =>
                studio.uploadMotionFile(event, studio.setMotionVideo)
              }
              onOrientationChange={studio.setCharacterOrientation}
              onPromptChange={studio.setMotionPrompt}
              onNegativePromptChange={studio.setMotionNegativePrompt}
              onKeepSoundChange={studio.setKeepOriginalSound}
              onGenerate={() => studio.generate("motion")}
            />
          )}
          {studio.error && <p className={styles.error}>{studio.error}</p>}
        </aside>

        <GenerationResults
          tab={studio.tab}
          generations={studio.visibleGenerations}
          onOpen={studio.openGeneration}
          onSaveModel={studio.saveModelFromGeneration}
          onDownload={studio.downloadGeneration}
          onRegenerate={studio.prepareRegeneration}
          onDelete={studio.deleteGeneration}
        />
      </section>

      {studio.selectedGeneration && (
        <GenerationModal
          generation={studio.selectedGeneration}
          imageIndex={studio.selectedImageIndex}
          onImageIndexChange={studio.setSelectedImageIndex}
          onClose={() => studio.setSelectedGeneration(null)}
          onDownloadImage={studio.downloadImage}
          onDownloadAll={studio.downloadGeneration}
          onSaveModel={studio.saveModelFromGeneration}
          onRegenerate={studio.prepareRegeneration}
          onDelete={studio.deleteGeneration}
        />
      )}

      {studio.settingsOpen && (
        <WavespeedSettingsModal
          geminiApiKey={studio.geminiApiKey}
          wavespeedApiKey={studio.apiKey}
          endpoint={studio.endpoint}
          motionEndpoint={studio.motionEndpoint}
          showGeminiKey={studio.showGeminiKey}
          showWavespeedKey={studio.showWavespeedKey}
          onClose={studio.closeSettings}
          onGeminiKeyChange={(value) => {
            studio.setGeminiApiKey(value)
            localStorage.setItem("gemini-api-key", value)
          }}
          onWavespeedKeyChange={(value) => {
            studio.setApiKey(value)
            localStorage.setItem("wavespeed-api-key", value)
          }}
          onEndpointChange={(value) => {
            studio.setEndpoint(value)
            localStorage.setItem("wavespeed-endpoint", value)
          }}
          onMotionEndpointChange={(value) => {
            studio.setMotionEndpoint(value)
            localStorage.setItem("wavespeed-motion-endpoint", value)
          }}
          onToggleGeminiKey={() => studio.setShowGeminiKey((value) => !value)}
          onToggleWavespeedKey={() =>
            studio.setShowWavespeedKey((value) => !value)
          }
        />
      )}
    </main>
  )
}
