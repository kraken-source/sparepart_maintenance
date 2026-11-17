import { useEffect, useMemo, useRef, useState } from 'react'

/**
 * Grafik laporan biaya, digambar langsung dengan SVG (tanpa library).
 * Mengikuti spesifikasi panduan dataviz: kolom maks. 24px, ujung data membulat 4px,
 * celah 2px warna permukaan antar segmen, grid tipis solid, legenda untuk >= 2 seri,
 * tooltip saat hover, dan tabel sebagai alternatif.
 */

// ---------- warna kategori: urutan tetap, tidak pernah diulang ----------
const SLOTS = 8
/** Warna kategori dari urutan tetap master kategori. Lewat 8 → "lainnya" (abu-abu), bukan warna baru. */
export const categoryColor = (categories, name) => {
  const i = categories.indexOf(name)
  return i >= 0 && i < SLOTS ? `var(--cat-${i + 1})` : 'var(--cat-other)'
}

// ---------- format angka ----------
export const rupiah = (n) => 'Rp ' + Math.round(n || 0).toLocaleString('id-ID')

/** Rupiah ringkas: Rp 850 rb · Rp 1,2 jt · Rp 3 M */
export function rupiahShort(n) {
  const v = Math.abs(n || 0)
  const fmt = (x, unit) => `Rp ${x.toLocaleString('id-ID', { maximumFractionDigits: x < 10 ? 1 : 0 })} ${unit}`
  if (v >= 1e9) return fmt(n / 1e9, 'M')
  if (v >= 1e6) return fmt(n / 1e6, 'jt')
  if (v >= 1e3) return fmt(n / 1e3, 'rb')
  return rupiah(n)
}

/** Skala sumbu Y dengan langkah "bulat" (1, 2, 2.5, 5 × 10^n). */
export function niceTicks(max, count = 4) {
  if (max <= 0) return [0, 1]
  const raw = max / count
  const pow = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw)
  const top = Math.ceil(max / step) * step
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step)
}

/** Lebar kontainer (responsif). */
function useWidth() {
  const ref = useRef(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    if (!ref.current) return undefined
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}

/** Path kolom dengan sudut atas membulat r px, bawah persegi (menempel ke baseline / segmen). */
function topRoundedRect(x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h)
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`
}

export function Legend({ items }) {
  return (
    <div className="viz-legend">
      {items.map((it) => (
        <span key={it.label}>
          <i style={{ background: it.color }} /> {it.label}
        </span>
      ))}
    </div>
  )
}

/**
 * Kolom bertumpuk biaya per bulan, dipecah per kategori.
 * months: [{ label, total, by_category: { [cat]: number } }]
 */
export function MonthlyStackedChart({ months, categories }) {
  const [ref, width] = useWidth()
  const [hover, setHover] = useState(null)

  const height = 260
  const pad = { top: 16, right: 12, bottom: 28, left: 64 }
  const innerW = Math.max(0, width - pad.left - pad.right)
  const innerH = height - pad.top - pad.bottom

  const used = useMemo(
    () => categories.filter((c) => months.some((m) => (m.by_category[c] ?? 0) > 0)),
    [categories, months],
  )
  const ticks = niceTicks(Math.max(0, ...months.map((m) => m.total)))
  const yMax = ticks[ticks.length - 1]
  const y = (v) => pad.top + innerH - (v / yMax) * innerH

  const band = months.length ? innerW / months.length : 0
  const barW = Math.min(24, band * 0.6)
  // Tampilkan label bulan secukupnya agar tidak bertabrakan (±56px per label)
  const every = Math.max(1, Math.ceil(56 / Math.max(band, 1)))
  const GAP = 2

  return (
    <div className="viz" ref={ref}>
      {used.length > 1 && <Legend items={used.map((c) => ({ label: c, color: categoryColor(categories, c) }))} />}
      {width > 0 && (
        // viewBox + width 100%: di layar skalanya 1:1, saat dicetak ikut mengecil ke lebar kertas
        <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Biaya maintenance per bulan per kategori">
          {/* grid + sumbu Y */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} className={t === 0 ? 'viz-baseline' : 'viz-grid'} />
              <text x={pad.left - 8} y={y(t)} className="viz-tick" textAnchor="end" dominantBaseline="middle">
                {t === 0 ? '0' : rupiahShort(t)}
              </text>
            </g>
          ))}

          {months.map((m, i) => {
            const cx = pad.left + band * i + band / 2
            const x0 = cx - barW / 2
            // susun segmen dari bawah ke atas mengikuti urutan kategori tetap
            let acc = 0
            const segs = used
              .map((c) => ({ c, v: m.by_category[c] ?? 0 }))
              .filter((s) => s.v > 0)
              .map((s, idx, arr) => {
                const yTop = y(acc + s.v)
                const yBot = y(acc)
                acc += s.v
                const isTop = idx === arr.length - 1
                // celah 2px antar segmen (bukan garis tepi)
                const h = Math.max(0, yBot - yTop - (idx > 0 ? GAP : 0))
                return { ...s, yTop, h, isTop }
              })
            return (
              <g key={m.month}>
                {segs.map((s) =>
                  s.isTop ? (
                    <path key={s.c} d={topRoundedRect(x0, s.yTop, barW, s.h, 4)} fill={categoryColor(categories, s.c)} />
                  ) : (
                    <rect key={s.c} x={x0} y={s.yTop} width={barW} height={s.h} fill={categoryColor(categories, s.c)} />
                  ),
                )}
                {i % every === 0 && (
                  <text x={cx} y={height - 8} className="viz-tick" textAnchor="middle">
                    {m.label.replace(/ (\d{2})(\d{2})$/, " '$2")}
                  </text>
                )}
                {/* area hover selebar band, lebih besar dari mark */}
                <rect
                  x={pad.left + band * i}
                  y={pad.top}
                  width={band}
                  height={innerH}
                  fill="transparent"
                  onMouseEnter={() => setHover({ i, x: cx })}
                  onMouseLeave={() => setHover(null)}
                />
                {hover?.i === i && <rect x={pad.left + band * i} y={pad.top} width={band} height={innerH} className="viz-hoverband" pointerEvents="none" />}
              </g>
            )
          })}
        </svg>
      )}

      {hover && (
        <div className="viz-tooltip" style={{ left: Math.min(Math.max(hover.x, 90), width - 90) }}>
          <strong>{months[hover.i].label}</strong>
          {used
            .filter((c) => (months[hover.i].by_category[c] ?? 0) > 0)
            .map((c) => (
              <div key={c} className="tt-row">
                <i style={{ background: categoryColor(categories, c) }} /> {c}
                <span>{rupiah(months[hover.i].by_category[c])}</span>
              </div>
            ))}
          <div className="tt-row tt-total">
            Total <span>{rupiah(months[hover.i].total)}</span>
          </div>
          <small className="muted">{months[hover.i].count} catatan</small>
        </div>
      )}
    </div>
  )
}

/**
 * Bar horizontal (besaran per entitas). Nama di kiri, nilai di ujung bar.
 * rows: [{ key, label, sub?, value, share, color }]
 */
export function HorizontalBars({ rows, ariaLabel }) {
  const [hover, setHover] = useState(null)
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <div className="hbars" role="img" aria-label={ariaLabel}>
      {rows.map((r) => (
        <div
          key={r.key}
          className={`hbar ${hover === r.key ? 'hover' : ''}`}
          onMouseEnter={() => setHover(r.key)}
          onMouseLeave={() => setHover(null)}
          title={`${r.label}: ${rupiah(r.value)} (${Math.round(r.share * 100)}%)`}
        >
          <div className="hbar-label">
            <span>{r.label}</span>
            {r.sub && <small className="muted">{r.sub}</small>}
          </div>
          <div className="hbar-track">
            <span className="hbar-fill" style={{ width: `${(r.value / max) * 100}%`, background: r.color }} />
            <span className="hbar-value">
              {rupiahShort(r.value)} <small className="muted">· {Math.round(r.share * 100)}%</small>
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
