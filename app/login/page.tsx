"use client";

import { Loader2, LockKeyhole, Sparkles, UserRound } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./login.module.scss";

export default function LoginPage() {
  const router = useRouter();
  const [nextPath, setNextPath] = useState("/");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const destination = new URLSearchParams(window.location.search).get("next") || "/";
    setNextPath(destination.startsWith("/") ? destination : "/");
    fetch("/api/auth/me").then((response) => {
      if (response.ok) router.replace(destination.startsWith("/") ? destination : "/");
    });
  }, [router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (mode === "register" && password !== confirmPassword) {
      setError("Пароли не совпадают.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось войти.");
      router.replace(nextPath);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Не удалось войти.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.authCard}>
        <header>
          <span className={styles.logo}><Sparkles size={22} /></span>
          <div><h1>AI OFM Studio</h1><p>Личный workspace для генераций</p></div>
        </header>

        <div className={styles.tabs}>
          <button type="button" className={mode === "login" ? styles.active : ""} onClick={() => { setMode("login"); setError(""); }}>Вход</button>
          <button type="button" className={mode === "register" ? styles.active : ""} onClick={() => { setMode("register"); setError(""); }}>Регистрация</button>
        </div>

        <form onSubmit={submit}>
          <label><span>Логин</span><div><UserRound size={18} /><input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="your_login" required /></div></label>
          <label><span>Пароль</span><div><LockKeyhole size={18} /><input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Минимум 8 символов" required /></div></label>
          {mode === "register" && <label><span>Повторите пароль</span><div><LockKeyhole size={18} /><input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></div></label>}
          {error && <p className={styles.error}>{error}</p>}
          <button className={styles.submit} disabled={loading} type="submit">
            {loading && <Loader2 className={styles.spin} size={18} />}
            {mode === "login" ? "Войти" : "Создать аккаунт"}
          </button>
        </form>
      </section>
    </main>
  );
}
