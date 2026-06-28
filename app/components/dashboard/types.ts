export type InstagramModel = {
  id: string
  name: string
  faceReferences: string
  bodyReferences: string
  createdAt: string
  connectionId: string | null
  instagramUserId: string | null
  instagramUsername: string | null
  instagramDisplayName: string | null
  instagramProfilePictureUrl: string | null
  tokenExpiresAt: string | null
}

export type MetricPoint = { date: string; value: number }
export type InstagramMetric = {
  name: string
  total: number
  points: MetricPoint[]
}

export type InstagramMedia = {
  id: string
  caption?: string
  media_type: string
  media_product_type?: string
  imageUrl: string | null
  permalink?: string
  timestamp: string
  likes: number
  comments: number
  saved: number
  shares: number
  reach: number
  views: number
  totalInteractions: number
}

export type InstagramInsights = {
  profile: {
    id: string
    username: string
    name?: string | null
    profilePictureUrl?: string | null
    followers: number
    mediaCount: number
  }
  period: { days: number; since: number; until: number }
  summary: {
    reach: number
    profileViews: number
    interactions: number
    engagementRate: number
  }
  metrics: Record<string, InstagramMetric>
  media: InstagramMedia[]
  partialMediaInsights: boolean
}
