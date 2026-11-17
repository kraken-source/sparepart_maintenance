const MAX_SIDE = 1600
const QUALITY = 0.82

/**
 * Perkecil foto sebelum diupload (sisi terpanjang maks. 1600 px, JPEG).
 * Foto HP 4–8 MB biasanya menjadi ±200–500 KB dan tetap terbaca jelas.
 * PDF dan gambar yang sudah kecil dikembalikan apa adanya.
 */
export async function shrinkImage(file) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file

  let bitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return file // format tidak dikenali browser (mis. HEIC) – biarkan server yang memvalidasi
  }

  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  if (scale === 1 && file.size < 1024 * 1024) {
    bitmap.close()
    return file
  }

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff' // latar putih untuk PNG transparan
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY))
  if (!blob || blob.size >= file.size) return file

  const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
  return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() })
}

export const fileSize = (bytes) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
