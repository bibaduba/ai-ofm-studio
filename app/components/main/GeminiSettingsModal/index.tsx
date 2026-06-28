"use client"

import { Eye, EyeOff, KeyRound, Loader2, X } from "lucide-react"
import { AccountPanel } from "@/app/components/shared/AccountPanel"
import styles from "./index.module.scss"

type GeminiSettingsModalProps = {
  apiKey: string
  wavespeedApiKey: string
  wavespeedEndpoint: string
  showGeminiKey: boolean
  showWavespeedKey: boolean
  checkingModels: boolean
  hasCheckedModels: boolean
  imageModelIds: string[]
  videoModelIds: string[]
  onClose: () => void
  onApiKeyChange: (value: string) => void
  onWavespeedApiKeyChange: (value: string) => void
  onEndpointChange: (value: string) => void
  onToggleGeminiKey: () => void
  onToggleWavespeedKey: () => void
  onCheckModels: () => void
}

export function GeminiSettingsModal(props: GeminiSettingsModalProps) {
  return (
    <div
      className={styles.overlay}
      role='presentation'
      onMouseDown={(event) =>
        event.target === event.currentTarget && props.onClose()
      }
    >
      <section
        className={styles.modal}
        role='dialog'
        aria-modal='true'
        aria-label='Settings'
      >
        <header>
          <div>
            <span>Workspace</span>
            <h2>Settings</h2>
          </div>
          <button
            type='button'
            aria-label='Close settings'
            onClick={props.onClose}
          >
            <X size={20} />
          </button>
        </header>
        <div className={styles.section}>
          <label>Gemini API key</label>
          <div className={styles.keyBox}>
            <KeyRound size={18} />
            <input
              type={props.showGeminiKey ? "text" : "password"}
              value={props.apiKey}
              onChange={(event) => props.onApiKeyChange(event.target.value)}
              placeholder='Gemini API key'
            />
            <button
              type='button'
              onClick={props.onToggleGeminiKey}
              aria-label='Toggle Gemini key visibility'
            >
              {props.showGeminiKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
            <button
              type='button'
              onClick={props.onCheckModels}
              disabled={props.checkingModels}
            >
              {props.checkingModels ? (
                <Loader2 className={styles.spin} size={16} />
              ) : (
                "Check"
              )}
            </button>
          </div>
        </div>
        <div className={styles.section}>
          <label>Wavespeed API key</label>
          <div className={styles.keyBox}>
            <KeyRound size={18} />
            <input
              type={props.showWavespeedKey ? "text" : "password"}
              value={props.wavespeedApiKey}
              onChange={(event) =>
                props.onWavespeedApiKeyChange(event.target.value)
              }
              placeholder='Wavespeed API key'
            />
            <button
              type='button'
              onClick={props.onToggleWavespeedKey}
              aria-label='Toggle Wavespeed key visibility'
            >
              {props.showWavespeedKey ? (
                <EyeOff size={16} />
              ) : (
                <Eye size={16} />
              )}
            </button>
          </div>
        </div>
        <div className={styles.section}>
          <label>Wavespeed endpoint</label>
          <input
            className={styles.input}
            value={props.wavespeedEndpoint}
            onChange={(event) => props.onEndpointChange(event.target.value)}
          />
        </div>
        {props.hasCheckedModels && (
          <div className={styles.status}>
            <span>
              Image:{" "}
              {props.imageModelIds.length
                ? props.imageModelIds.join(", ")
                : "нет доступных image-моделей"}
            </span>
            <span>
              Video:{" "}
              {props.videoModelIds.length
                ? props.videoModelIds.join(", ")
                : "нет доступных Veo-моделей"}
            </span>
          </div>
        )}
        <AccountPanel />
      </section>
    </div>
  )
}
