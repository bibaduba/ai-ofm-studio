"use client"

import { LogOut, UserRound } from "lucide-react"
import { useEffect, useState } from "react"
import styles from "./index.module.scss"

export function AccountPanel() {
  const [username, setUsername] = useState("")

  useEffect(() => {
    fetch("/api/auth/me").then(async (response) => {
      if (response.status === 401) window.location.href = "/login"
      else if (response.ok) setUsername((await response.json()).username)
    })
  }, [])

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" })
    window.location.href = "/login"
  }

  return (
    <section className={styles.panel}>
      <div className={styles.user}>
        <span>
          <UserRound size={17} />
        </span>
        <div>
          <small>Аккаунт</small>
          <strong>{username || "..."}</strong>
        </div>
      </div>
      <button type='button' onClick={logout}>
        <LogOut size={16} />
      </button>
    </section>
  )
}
