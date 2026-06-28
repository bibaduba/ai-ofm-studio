"use client"

import Link from "next/link"
import { Moon, Settings2, Sparkles, Sun } from "lucide-react"
import { ReactNode } from "react"
import styles from "./index.module.scss"

type AppNavbarProps = {
  subtitle: string
  activeApp: "gemini" | "wavespeed"
  theme: "light" | "dark"
  onToggleTheme: () => void
  onOpenSettings: () => void
  children?: ReactNode
}

export function AppNavbar({
  subtitle,
  activeApp,
  theme,
  onToggleTheme,
  onOpenSettings,
  children,
}: AppNavbarProps) {
  return (
    <nav className={styles.navbar}>
      <div className={styles.brand}>
        <span className={styles.brandMark}>
          <Sparkles size={20} />
        </span>
        <div>
          <strong>AI OFM Studio</strong>
          <span>{subtitle}</span>
        </div>
      </div>

      {children && <div className={styles.slot}>{children}</div>}

      <button
        className={styles.themeToggle}
        type='button'
        onClick={onToggleTheme}
        aria-label='Toggle theme'
      >
        {theme === "dark" ? <Moon size={17} /> : <Sun size={17} />}
        <span />
      </button>
      <button
        className={styles.settingsButton}
        type='button'
        onClick={onOpenSettings}
        aria-label='Settings'
      >
        <Settings2 size={19} />
      </button>
      <div className={styles.appSwitch}>
        <Link className={activeApp === "gemini" ? styles.active : ""} href='/'>
          Gemini
        </Link>
        <Link
          className={activeApp === "wavespeed" ? styles.active : ""}
          href='/wavespeed'
        >
          Wavespeed
        </Link>
      </div>
    </nav>
  )
}
