"use client"

import { Check, Instagram, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { AppNavbar } from "@/app/components/shared/AppNavbar"
import styles from "./select.module.scss"

type Account = {
  id: string
  username: string
  name: string | null
  profilePictureUrl: string | null
  facebookPageName: string
}

export default function SelectInstagramAccountPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [modelName, setModelName] = useState("")
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState("")
  const [error, setError] = useState("")
  const [theme, setTheme] = useState<"light" | "dark">("light")
  const state =
    typeof window === "undefined"
      ? ""
      : new URLSearchParams(window.location.search).get("state") || ""

  useEffect(() => {
    const savedTheme =
      localStorage.getItem("studio-theme") === "dark" ? "dark" : "light"
    setTheme(savedTheme)
    document.documentElement.dataset.theme = savedTheme
    fetch(`/api/instagram/oauth/select?state=${encodeURIComponent(state)}`)
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || "Selection failed.")
        setAccounts(data.accounts)
        setModelName(data.model?.name || "model")
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false))
  }, [state])

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark"
    setTheme(nextTheme)
    localStorage.setItem("studio-theme", nextTheme)
    document.documentElement.dataset.theme = nextTheme
  }

  async function selectAccount(account: Account) {
    setSavingId(account.id)
    setError("")
    const response = await fetch("/api/instagram/oauth/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state, instagramUserId: account.id }),
    })
    const data = await response.json()
    if (!response.ok) {
      setError(data.error || "Account selection failed.")
      setSavingId("")
      return
    }
    window.location.href = `/dashboard?instagram=connected&model=${encodeURIComponent(data.modelId)}`
  }

  return (
    <main className={styles.shell}>
      <AppNavbar
        subtitle='Choose Instagram account'
        activeApp='dashboard'
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <section className={styles.panel}>
        <span className={styles.icon}><Instagram size={23} /></span>
        <h1>Select Instagram for {modelName}</h1>
        <p>Выбери профессиональный аккаунт, который будет привязан к модели.</p>
        {loading ? (
          <Loader2 className={styles.spin} />
        ) : (
          <div className={styles.accounts}>
            {accounts.map((account) => (
              <button
                type='button'
                key={account.id}
                onClick={() => selectAccount(account)}
                disabled={Boolean(savingId)}
              >
                <span className={styles.avatar}>
                  {account.profilePictureUrl ? (
                    <img src={account.profilePictureUrl} alt='' />
                  ) : (
                    <Instagram size={20} />
                  )}
                </span>
                <span className={styles.copy}>
                  <strong>@{account.username}</strong>
                  <small>{account.name || account.facebookPageName}</small>
                </span>
                {savingId === account.id ? (
                  <Loader2 className={styles.spin} size={18} />
                ) : (
                  <Check size={18} />
                )}
              </button>
            ))}
          </div>
        )}
        {error && <div className={styles.error}>{error}</div>}
      </section>
    </main>
  )
}
