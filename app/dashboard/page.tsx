"use client"

import { Instagram, RefreshCw } from "lucide-react"
import { AppNavbar } from "@/app/components/shared/AppNavbar"
import { DashboardState } from "@/app/components/dashboard/DashboardState"
import { InsightsChart } from "@/app/components/dashboard/InsightsChart"
import { MediaPerformance } from "@/app/components/dashboard/MediaPerformance"
import { MetricsOverview } from "@/app/components/dashboard/MetricsOverview"
import { ModelSidebar } from "@/app/components/dashboard/ModelSidebar"
import { ToastStack } from "@/app/components/wavespeed/ToastStack"
import { useInstagramDashboard } from "./hooks/useInstagramDashboard"
import styles from "./dashboard.module.scss"

export default function DashboardPage() {
  const dashboard = useInstagramDashboard()
  const model = dashboard.selectedModel
  const data = dashboard.insights

  return (
    <main className={styles.shell}>
      <ToastStack toasts={dashboard.toasts} onClose={dashboard.removeToast} />
      <AppNavbar
        subtitle='Instagram model analytics'
        activeApp='dashboard'
        theme={dashboard.theme}
        onToggleTheme={dashboard.toggleTheme}
      />

      <section className={styles.workspace}>
        <ModelSidebar
          models={dashboard.models}
          selectedId={dashboard.selectedId}
          configured={dashboard.configured}
          onSelect={dashboard.selectModel}
          onConnect={dashboard.connectInstagram}
          onDisconnect={dashboard.disconnectInstagram}
        />

        <section className={styles.dashboard}>
          {dashboard.loadingModels ? (
            <DashboardState kind='loading' />
          ) : !dashboard.models.length ? (
            <DashboardState kind='no-models' />
          ) : !dashboard.configured ? (
            <DashboardState
              kind='config'
              message={dashboard.configurationError}
            />
          ) : !model?.connectionId ? (
            <DashboardState
              kind='not-connected'
              onConnect={() => model && dashboard.connectInstagram(model.id)}
            />
          ) : dashboard.loadingInsights ? (
            <DashboardState kind='loading' />
          ) : dashboard.error ? (
            <DashboardState
              kind='error'
              message={dashboard.error}
              onReconnect={
                dashboard.reconnectRequired
                  ? () => dashboard.connectInstagram(model.id)
                  : undefined
              }
            />
          ) : data ? (
            <>
              <header className={styles.profileHeader}>
                <div className={styles.profile}>
                  <span className={styles.profileImage}>
                    {data.profile.profilePictureUrl ? (
                      <img src={data.profile.profilePictureUrl} alt='' />
                    ) : (
                      <Instagram size={22} />
                    )}
                  </span>
                  <div>
                    <small>{model.name}</small>
                    <h1>@{data.profile.username}</h1>
                    <p>
                      {data.profile.name || "Instagram professional account"}
                      <span />
                      {data.profile.mediaCount} posts
                    </p>
                  </div>
                </div>
                <div className={styles.controls}>
                  <div className={styles.periods}>
                    {[7, 30, 90].map((days) => (
                      <button
                        className={dashboard.days === days ? styles.active : ""}
                        type='button'
                        key={days}
                        onClick={() => dashboard.setDays(days)}
                      >
                        {days}D
                      </button>
                    ))}
                  </div>
                  <button
                    className={styles.refresh}
                    type='button'
                    onClick={dashboard.refreshInsights}
                    title='Refresh statistics'
                    aria-label='Refresh statistics'
                  >
                    <RefreshCw size={16} />
                  </button>
                </div>
              </header>

              <MetricsOverview data={data} />
              <InsightsChart data={data} />
              <MediaPerformance media={data.media} />
            </>
          ) : null}
        </section>
      </section>
    </main>
  )
}
