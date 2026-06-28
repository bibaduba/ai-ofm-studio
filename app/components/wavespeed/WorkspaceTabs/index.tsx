"use client"
import { WavespeedTab } from "../types"
import styles from "./index.module.scss"
export function WorkspaceTabs({
  active,
  onChange,
}: {
  active: WavespeedTab
  onChange: (tab: WavespeedTab) => void
}) {
  const tabs: Array<[WavespeedTab, string]> = [
    ["model", "Create model"],
    ["scene", "Generate scenes"],
    ["motion", "Video motion"],
  ]

  const getPosition = () => {
    switch (active) {
      case "model":
        return {
          transform: "translateX(0)",
        }
      case "scene":
        return {
          transform: "translateX(calc(100%))",
        }
      case "motion":
        return {
          transform: "translateX(calc(200%))",
        }
      default:
        return {
          transform: "translateX(0)",
        }
    }
  }

  return (
    <section className={styles.tabs}>
      <div className={styles.zone_wrapper}>
        {tabs.map(([value]) => (
          <div
            key={value}
            className={`${styles.active_zone} ${active === value ? styles.active : ""}`}
            style={{ ...getPosition() }}
          />
        ))}
      </div>

      {tabs.map(([value, label]) => (
        <button type='button' key={value} onClick={() => onChange(value)}>
          <p
            className={`${styles.label} ${active === value ? styles.active : ""}`}
          >
            {label}
          </p>
        </button>
      ))}
    </section>
  )
}
