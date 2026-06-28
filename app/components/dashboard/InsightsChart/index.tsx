"use client"

import { useMemo, useState } from "react"
import { InstagramInsights } from "../types"
import styles from "./index.module.scss"

const chartOptions = [
  { key: "reach", label: "Reach" },
  { key: "profile_views", label: "Profile views" },
  { key: "follower_count", label: "Followers" },
] as const

export function InsightsChart({ data }: { data: InstagramInsights }) {
  const [metricKey, setMetricKey] = useState<string>("reach")
  const metric = data.metrics[metricKey]
  const chart = useMemo(() => {
    const points = metric?.points || []
    if (!points.length) return { path: "", points: [], min: 0, max: 0 }
    const values = points.map((point) => point.value)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = Math.max(1, max - min)
    const normalized = points.map((point, index) => ({
      x: points.length === 1 ? 400 : 28 + (index / (points.length - 1)) * 744,
      y: 190 - ((point.value - min) / range) * 150,
      ...point,
    }))
    return {
      path: normalized
        .map((point, index) =>
          `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`,
        )
        .join(" "),
      points: normalized,
      min,
      max,
    }
  }, [metric])

  return (
    <section className={styles.chartPanel}>
      <header>
        <div>
          <span>PERFORMANCE</span>
          <h2>{data.period.days}-day overview</h2>
        </div>
        <div className={styles.switcher}>
          {chartOptions.map((option) => (
            <button
              className={metricKey === option.key ? styles.active : ""}
              type='button'
              key={option.key}
              onClick={() => setMetricKey(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>
      {chart.path ? (
        <div className={styles.chart}>
          <svg viewBox='0 0 800 220' role='img' aria-label='Instagram metric chart'>
            {[40, 90, 140, 190].map((y) => (
              <line key={y} x1='28' x2='772' y1={y} y2={y} />
            ))}
            <path d={chart.path} />
            {chart.points.map((point) => (
              <circle key={`${point.date}-${point.x}`} cx={point.x} cy={point.y} r='4'>
                <title>
                  {new Date(point.date).toLocaleDateString("ru-RU")}: {point.value}
                </title>
              </circle>
            ))}
          </svg>
          <div className={styles.axis}>
            <span>{new Date(chart.points[0].date).toLocaleDateString("ru-RU")}</span>
            <span>
              {new Date(
                chart.points[chart.points.length - 1].date,
              ).toLocaleDateString("ru-RU")}
            </span>
          </div>
        </div>
      ) : (
        <div className={styles.noData}>Instagram не вернул данные этой метрики за период.</div>
      )}
    </section>
  )
}
