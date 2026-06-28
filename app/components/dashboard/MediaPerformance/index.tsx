import {
  Bookmark,
  Eye,
  ExternalLink,
  Heart,
  MessageCircle,
  Share2,
} from "lucide-react"
import { InstagramMedia } from "../types"
import styles from "./index.module.scss"

const compact = new Intl.NumberFormat("ru-RU", { notation: "compact" })

export function MediaPerformance({ media }: { media: InstagramMedia[] }) {
  return (
    <section className={styles.section}>
      <header>
        <div>
          <span>CONTENT</span>
          <h2>Published media</h2>
        </div>
        <strong>{media.length}</strong>
      </header>
      {!media.length ? (
        <div className={styles.empty}>За выбранный период публикаций нет.</div>
      ) : (
        <div className={styles.grid}>
          {media.map((item) => (
            <article key={item.id}>
              <div className={styles.preview}>
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt='' />
                ) : (
                  <Eye size={24} />
                )}
                <span>{item.media_product_type || item.media_type}</span>
                {item.permalink && (
                  <a
                    href={item.permalink}
                    target='_blank'
                    rel='noreferrer'
                    title='Open in Instagram'
                    aria-label='Open in Instagram'
                  >
                    <ExternalLink size={15} />
                  </a>
                )}
              </div>
              <div className={styles.content}>
                <p>{item.caption || "Без подписи"}</p>
                <time>{new Date(item.timestamp).toLocaleDateString("ru-RU")}</time>
                <div className={styles.stats}>
                  <span title='Likes'><Heart size={13} />{compact.format(item.likes)}</span>
                  <span title='Comments'><MessageCircle size={13} />{compact.format(item.comments)}</span>
                  <span title='Saved'><Bookmark size={13} />{compact.format(item.saved)}</span>
                  <span title='Shares'><Share2 size={13} />{compact.format(item.shares)}</span>
                  <span title='Reach'><Eye size={13} />{compact.format(item.reach)}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
