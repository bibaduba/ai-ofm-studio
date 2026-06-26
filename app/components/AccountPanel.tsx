"use client";

import { Download, FileUp, Loader2, LogOut, UserRound } from "lucide-react";
import { ChangeEvent, useEffect, useState } from "react";
import styles from "./AccountPanel.module.scss";

export function AccountPanel() {
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/auth/me").then(async (response) => {
      if (response.status === 401) window.location.href = "/login";
      else if (response.ok) setUsername((await response.json()).username);
    });
  }, []);

  async function exportData() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/account/export");
      if (!response.ok) throw new Error("Не удалось создать экспорт.");
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = `ai-ofm-${username || "account"}-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(href);
      setMessage("Экспорт готов. Импортируйте этот файл на опубликованном сайте.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка экспорта.");
    } finally {
      setBusy(false);
    }
  }

  async function importData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMessage("");
    try {
      const payload = JSON.parse(await file.text());
      const response = await fetch("/api/account/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Ошибка импорта.");
      setMessage(`Импортировано: ${data.imported.models} моделей, ${data.imported.generations + data.imported.wavespeedGenerations} генераций.`);
      window.setTimeout(() => window.location.reload(), 900);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Некорректный файл экспорта.");
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <section className={styles.panel}>
      <div className={styles.user}><span><UserRound size={17} /></span><div><small>Аккаунт</small><strong>{username || "..."}</strong></div></div>
      <div className={styles.actions}>
        <button type="button" onClick={exportData} disabled={busy}><Download size={16} />Экспорт</button>
        <label className={busy ? styles.disabled : ""}><FileUp size={16} />Импорт<input type="file" accept="application/json,.json" onChange={importData} disabled={busy} /></label>
        <button type="button" className={styles.logout} onClick={logout} disabled={busy}><LogOut size={16} aria-label="Выйти" /></button>
      </div>
      {busy && <Loader2 className={styles.spin} size={17} />}
      {message && <p>{message}</p>}
    </section>
  );
}
