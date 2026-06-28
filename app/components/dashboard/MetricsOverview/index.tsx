import { Eye, Heart, MousePointer2, Users } from "lucide-react"
import { InstagramInsights } from "../types"
import styles from "./index.module.scss"

const formatter = new Intl.NumberFormat("ru-RU", { notation: "compact" })

export function MetricsOverview({ data }: { data: InstagramInsights }) {
  const metrics = [
    { label: "Followers", value: data.profile.followers, icon: Users },
    { label: "Reach", value: data.summary.reach, icon: Eye },
    {
      label: "Profile views",
      value: data.summary.profileViews,
      icon: MousePointer2,
    },
    { label: "Interactions", value: data.summary.interactions, icon: Heart },
  ]
  return (
    <section className={styles.metrics}>
      {metrics.map((metric) => (
        <article key={metric.label}>
          <span>
            <metric.icon size={17} />
          </span>
          <div>
            <small>{metric.label}</small>
            <strong>{formatter.format(metric.value)}</strong>
          </div>
        </article>
      ))}
    </section>
  )
}
