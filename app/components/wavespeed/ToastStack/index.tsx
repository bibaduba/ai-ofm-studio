"use client"
import { AlertTriangle, CheckCircle2, Sparkles, X } from "lucide-react"
import { Toast } from "../types"
import styles from "./index.module.scss"
export function ToastStack({
  toasts,
  onClose,
}: {
  toasts: Toast[]
  onClose: (id: string) => void
}) {
  return (
    <div className={styles.stack} aria-live='polite' aria-atomic='true'>
      {toasts.map((toast) => (
        <div className={`${styles.toast} ${styles[toast.type]}`} key={toast.id}>
          <div className={styles.icon}>
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
            onClick={() => onClose(toast.id)}
            aria-label='Close notification'
          >
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  )
}
