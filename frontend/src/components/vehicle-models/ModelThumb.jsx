/** Gambar thumbnail model 3D, atau penanda kosong bila belum ada (thumbnail dibuat saat model dibuka admin). */
export default function ModelThumb({ model, src, className = '' }) {
  const url = src ?? model?.thumbnail_url
  return (
    <div className={`model-thumb ${className}`}>
      {url ? (
        <img src={url} alt={model?.name ? `Model ${model.name}` : 'Thumbnail model'} loading="lazy" />
      ) : (
        <span className="model-thumb-empty">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M12 3 3 7.5v9L12 21l9-4.5v-9L12 3Zm0 0v18M3 7.5l9 4.5 9-4.5" strokeLinejoin="round" />
          </svg>
          Belum ada gambar
        </span>
      )}
    </div>
  )
}
