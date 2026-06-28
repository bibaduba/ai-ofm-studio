import { Instagram, Link2, Loader2, Plus, RefreshCw } from "lucide-react"
import Link from "next/link"
import styles from "./index.module.scss"

type Props = {
  kind: "loading" | "no-models" | "not-connected" | "error" | "config"
  message?: string
  onConnect?: () => void
  onReconnect?: () => void
}

export function DashboardState(props: Props) {
  const content = {
    loading: {
      icon: <Loader2 className={styles.spin} />,
      title: "Loading Instagram data",
      description: "Получаем доступную статистику аккаунта.",
    },
    "no-models": {
      icon: <Plus />,
      title: "Create your first model",
      description: "После сохранения модели к ней можно привязать Instagram.",
    },
    "not-connected": {
      icon: <Instagram />,
      title: "Instagram is not connected",
      description: "Подключи профессиональный Creator или Business аккаунт.",
    },
    error: {
      icon: <RefreshCw />,
      title: "Statistics unavailable",
      description: props.message || "Instagram временно не вернул статистику.",
    },
    config: {
      icon: <Link2 />,
      title: "Instagram OAuth is not configured",
      description: props.message || "Добавь Meta credentials в окружение.",
    },
  }[props.kind]

  return (
    <section className={styles.state}>
      <span>{content.icon}</span>
      <h2>{content.title}</h2>
      <p>{content.description}</p>
      {props.kind === "no-models" && (
        <Link href='/wavespeed'><Plus size={16} />Create model</Link>
      )}
      {props.kind === "not-connected" && props.onConnect && (
        <button type='button' onClick={props.onConnect}><Instagram size={16} />Connect Instagram</button>
      )}
      {props.kind === "error" && props.onReconnect && (
        <button type='button' onClick={props.onReconnect}><RefreshCw size={16} />Reconnect Instagram</button>
      )}
    </section>
  )
}
