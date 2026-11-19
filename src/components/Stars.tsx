const PATH = 'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z'
const HEART = 'M12 20.5s-7.5-4.6-9.3-9.2C1.4 7.9 3.6 4.5 7 4.5c2 0 3.6 1.1 5 2.9 1.4-1.8 3-2.9 5-2.9 3.4 0 5.6 3.4 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z'

// Read-only star display with half stars, plus the Like heart.
export default function Stars({ rating, liked, size = 13 }: { rating: number; liked?: boolean; size?: number }) {
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'center' }} role="img" aria-label={`${rating} out of 5 stars${liked ? ', liked' : ''}`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = rating >= i ? 1 : rating >= i - 0.5 ? 0.5 : 0
        const id = `half-${i}`
        return (
          <svg key={i} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
            {fill === 0.5 && (
              <defs>
                <clipPath id={id}>
                  <rect x="0" y="0" width="12" height="24" />
                </clipPath>
              </defs>
            )}
            <path d={PATH} fill="none" stroke="var(--border-strong)" strokeWidth={1.6} />
            {fill > 0 && <path d={PATH} fill="var(--accent)" clipPath={fill === 0.5 ? `url(#${id})` : undefined} />}
          </svg>
        )
      })}
      {liked && (
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ marginLeft: 4 }}>
          <path d={HEART} fill="var(--like)" />
        </svg>
      )}
    </div>
  )
}
