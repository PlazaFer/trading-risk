import { useEffect, useState } from 'react'
import { ImageOff } from 'lucide-react'
import { resolveImageUrl } from '../../lib/imageStore.js'

/**
 * Renders an image descriptor, resolving it to a public bucket URL on demand.
 * Cancels on unmount so fast calendar scrubbing can't set state on a dead
 * component.
 */
export default function SmartImage({ descriptor, className = '', alt = 'Captura del trade' }) {
  const [url, setUrl] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    setUrl(null)
    setFailed(false)

    resolveImageUrl(descriptor)
      .then((resolved) => {
        if (!alive) return
        if (resolved) setUrl(resolved)
        else setFailed(true)
      })
      .catch(() => alive && setFailed(true))

    return () => {
      alive = false
    }
  }, [descriptor])

  if (failed) {
    return (
      <div className={`grid place-items-center bg-bg-sub text-ink-faint ${className}`}>
        <ImageOff className="h-5 w-5" />
      </div>
    )
  }

  if (!url) return <div className={`skeleton ${className}`} />

  return <img src={url} alt={alt} className={className} loading="lazy" />
}
