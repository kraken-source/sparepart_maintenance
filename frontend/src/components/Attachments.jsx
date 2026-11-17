import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import { fileSize } from '../image'

/**
 * Object URL dari Blob/File, otomatis di-revoke saat berubah / unmount.
 * Sengaja dibuat di dalam effect (bukan useMemo): di StrictMode effect dijalankan dua kali,
 * dan URL hasil useMemo akan ter-revoke oleh cleanup pertama.
 */
function useObjectUrl(blob) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!blob) return undefined
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}

const isPdf = (mime) => mime === 'application/pdf'

/** Thumbnail lampiran yang sudah tersimpan di server. Klik = buka di tab baru. */
export function AttachmentThumb({ attachment, onDelete, size = 72 }) {
  const blob = useQuery({
    queryKey: ['attachment', attachment.id],
    queryFn: () => api.attachmentBlob(attachment.id),
    staleTime: Infinity,
  })
  const url = useObjectUrl(blob.data)

  return (
    <Thumb
      url={url}
      pdf={isPdf(attachment.mime)}
      name={attachment.original_name}
      meta={fileSize(attachment.size)}
      loading={blob.isLoading}
      error={blob.isError}
      onDelete={onDelete}
      size={size}
    />
  )
}

/** Thumbnail file yang baru dipilih (belum diupload). */
export function PendingThumb({ file, onRemove }) {
  const url = useObjectUrl(file)
  return (
    <Thumb url={url} pdf={isPdf(file.type)} name={file.name} meta={`${fileSize(file.size)} · baru`} onDelete={onRemove} pending />
  )
}

function Thumb({ url, pdf, name, meta, loading, error, onDelete, pending, size = 72 }) {
  return (
    <div className={`thumb ${pending ? 'pending' : ''}`} style={{ width: size }} title={`${name}\n${meta}`}>
      <button
        type="button"
        className="thumb-img"
        style={{ height: size }}
        disabled={!url}
        onClick={() => url && window.open(url, '_blank', 'noopener')}
      >
        {error ? '⚠' : loading || !url ? '…' : pdf ? <span className="pdf">PDF</span> : <img src={url} alt={name} />}
      </button>
      {onDelete && (
        <button type="button" className="thumb-del" onClick={onDelete} aria-label={`Hapus ${name}`}>
          ×
        </button>
      )}
    </div>
  )
}
