import { NextResponse } from "next/server"
import { getCurrentUser } from "@/app/lib/auth"
import { db, type InstagramConnectionRecord } from "@/app/lib/db"
import {
  getInstagramProfile,
  getUsableInstagramToken,
  instagramGet,
  instagramGetUrl,
} from "@/app/lib/instagram"

type InsightValue = {
  value: number | Record<string, number>
  end_time?: string
}

type Insight = {
  name: string
  period?: string
  values?: InsightValue[]
  total_value?: { value?: number | Record<string, number> }
}

type InsightsResponse = { data: Insight[] }

type InstagramMedia = {
  id: string
  caption?: string
  media_type: string
  media_product_type?: string
  media_url?: string
  thumbnail_url?: string
  permalink?: string
  timestamp: string
  like_count?: number
  comments_count?: number
}

type MediaResponse = {
  data: InstagramMedia[]
  paging?: { next?: string }
}

function numericValue(value: number | Record<string, number> | undefined) {
  if (typeof value === "number") return value
  if (!value) return 0
  return Object.values(value).reduce(
    (total, item) => total + (typeof item === "number" ? item : 0),
    0,
  )
}

function serializeMetric(metric: string, insight?: Insight) {
  const points = (insight?.values || [])
    .filter((value) => value.end_time)
    .map((value) => ({
      date: value.end_time as string,
      value: numericValue(value.value),
    }))
  const total = insight?.total_value
    ? numericValue(insight.total_value.value)
    : points.reduce((sum, point) => sum + point.value, 0)
  return { name: metric, total, points }
}

async function getAccountMetric(
  metric: string,
  instagramUserId: string,
  accessToken: string,
  since: number,
  until: number,
) {
  try {
    const result = await instagramGet<InsightsResponse>(
      `${instagramUserId}/insights`,
      accessToken,
      { metric, period: "day", since, until },
    )
    return serializeMetric(metric, result.data[0])
  } catch {
    try {
      const result = await instagramGet<InsightsResponse>(
        `${instagramUserId}/insights`,
        accessToken,
        { metric, period: "day", metric_type: "total_value", since, until },
      )
      return serializeMetric(metric, result.data[0])
    } catch {
      return serializeMetric(metric)
    }
  }
}

async function getAllMedia(
  instagramUserId: string,
  accessToken: string,
  since: number,
): Promise<InstagramMedia[]> {
  let page: MediaResponse | null = await instagramGet<MediaResponse>(
    `${instagramUserId}/media`,
    accessToken,
    {
      fields:
        "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count",
      since,
      limit: 100,
    },
  )
  const media: InstagramMedia[] = []
  let pageCount = 0

  while (page && pageCount < 10) {
    media.push(...page.data)
    pageCount += 1
    page = page.paging?.next
      ? await instagramGetUrl<MediaResponse>(page.paging.next, accessToken)
      : null
  }
  return media
}

async function enrichMedia(media: InstagramMedia, accessToken: string) {
  let insights: Insight[] = []
  try {
    const result = await instagramGet<InsightsResponse>(
      `${media.id}/insights`,
      accessToken,
      { metric: "reach,saved,shares,views,total_interactions" },
    )
    insights = result.data
  } catch {
    try {
      const result = await instagramGet<InsightsResponse>(
        `${media.id}/insights`,
        accessToken,
        { metric: "reach" },
      )
      insights = result.data
    } catch {
      insights = []
    }
  }

  const metric = (name: string) => {
    const insight = insights.find((item) => item.name === name)
    return insight?.values?.length
      ? insight.values.reduce(
          (sum, value) => sum + numericValue(value.value),
          0,
        )
      : numericValue(insight?.total_value?.value)
  }
  const likes = media.like_count || 0
  const comments = media.comments_count || 0
  const saved = metric("saved")
  const shares = metric("shares")
  const totalInteractions =
    metric("total_interactions") || likes + comments + saved + shares

  return {
    ...media,
    imageUrl: media.thumbnail_url || media.media_url || null,
    likes,
    comments,
    saved,
    shares,
    reach: metric("reach"),
    views: metric("views"),
    totalInteractions,
  }
}

export async function GET(request: Request) {
  const user = getCurrentUser()
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(request.url)
  const modelId = url.searchParams.get("modelId") || ""
  const requestedDays = Number(url.searchParams.get("days") || 30)
  const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 30
  const connection = db
    .prepare(
      `SELECT * FROM instagram_connections
       WHERE wavespeedModelId = ? AND userId = ?`,
    )
    .get(modelId, user.id) as InstagramConnectionRecord | undefined

  if (!connection) {
    return NextResponse.json(
      { error: "Instagram is not connected to this model." },
      { status: 404 },
    )
  }

  try {
    const accessToken = getUsableInstagramToken(connection)
    const until = Math.floor(Date.now() / 1000)
    const since = until - days * 86400
    const [profile, metrics, rawMedia] = await Promise.all([
      getInstagramProfile(connection.instagramUserId, accessToken),
      Promise.all(
        [
          "reach",
          "profile_views",
          "follower_count",
          "website_clicks",
          "accounts_engaged",
          "total_interactions",
        ].map((metric) =>
          getAccountMetric(
            metric,
            connection.instagramUserId,
            accessToken,
            since,
            until,
          ),
        ),
      ),
      getAllMedia(connection.instagramUserId, accessToken, since),
    ])
    const enrichedMedia = await Promise.all(
      rawMedia.slice(0, 36).map((item) => enrichMedia(item, accessToken)),
    )
    const media = [
      ...enrichedMedia,
      ...rawMedia.slice(36).map((item) => ({
        ...item,
        imageUrl: item.thumbnail_url || item.media_url || null,
        likes: item.like_count || 0,
        comments: item.comments_count || 0,
        saved: 0,
        shares: 0,
        reach: 0,
        views: 0,
        totalInteractions: (item.like_count || 0) + (item.comments_count || 0),
      })),
    ]
    const metricMap = Object.fromEntries(
      metrics.map((metric) => [metric.name, metric]),
    )
    const mediaInteractions = media.reduce(
      (total, item) => total + item.totalInteractions,
      0,
    )
    const mediaReach = media.reduce((total, item) => total + item.reach, 0)
    const reach = metricMap.reach?.total || mediaReach
    const interactions =
      metricMap.total_interactions?.total || mediaInteractions

    return NextResponse.json({
      profile: {
        id: profile.id,
        username: profile.username,
        name: profile.name || connection.displayName,
        profilePictureUrl:
          profile.profile_picture_url || connection.profilePictureUrl,
        followers: profile.followers_count || 0,
        mediaCount: profile.media_count || rawMedia.length,
      },
      period: { days, since, until },
      summary: {
        reach,
        profileViews: metricMap.profile_views?.total || 0,
        interactions,
        engagementRate: reach ? (interactions / reach) * 100 : 0,
      },
      metrics: metricMap,
      media: media.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      ),
      partialMediaInsights: rawMedia.length > media.length,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Instagram insights failed."
    const tokenProblem = /token|session|oauth|access/i.test(message)
    return NextResponse.json(
      { error: message, reconnectRequired: tokenProblem },
      { status: tokenProblem ? 401 : 502 },
    )
  }
}
