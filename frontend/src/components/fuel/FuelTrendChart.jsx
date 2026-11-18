import { useState } from 'react'
import { km, tanggal } from '../../format'
import { kmPerLiter, liter } from '../../fuel'
import { niceTicks, rupiah, useWidth } from '../reports/charts'

const shortDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })

/**
 * Tren konsumsi (km/L) per segmen isi penuh → isi penuh, dengan garis rata-rata.
 * Satu seri: tanpa legenda (judul kartu menamainya), garis 2px, titik 8px dengan cincin permukaan,
 * label langsung hanya di titik terakhir, crosshair + tooltip saat hover.
 * Sumbu X berurutan per segmen (bukan skala waktu) agar segmen berdekatan tetap terbaca.
 *
 * segments: [{ date, km_per_liter, distance, liters, cost, fuel_type }] urut lama → baru
 */
export default function FuelTrendChart({ segments, average }) {
  const [ref, width] = useWidth()
  const [hover, setHover] = useState(null)

  const height = 220
  const pad = { top: 28, right: 56, bottom: 28, left: 48 }
  const innerW = Math.max(0, width - pad.left - pad.right)
  const innerH = height - pad.top - pad.bottom

  const ticks = niceTicks(Math.max(...segments.map((s) => s.km_per_liter), average ?? 0) * 1.1)
  const yMax = ticks[ticks.length - 1]
  const y = (v) => pad.top + innerH - (v / yMax) * innerH
  const x = (i) => pad.left + (segments.length > 1 ? (innerW * i) / (segments.length - 1) : innerW / 2)
  const every = Math.max(1, Math.ceil(64 / Math.max(innerW / Math.max(segments.length - 1, 1), 1)))
  const last = segments.length - 1

  const path = segments.map((s, i) => `${i ? 'L' : 'M'}${x(i)},${y(s.km_per_liter)}`).join('')

  // Titik terdekat dari posisi mouse (area hover = seluruh plot, lebih besar dari titiknya).
  const onMove = (e) => {
    const box = e.currentTarget.getBoundingClientRect()
    const mx = ((e.clientX - box.left) / box.width) * width
    let best = 0
    segments.forEach((_, i) => { if (Math.abs(x(i) - mx) < Math.abs(x(best) - mx)) best = i })
    setHover(best)
  }

  const h = hover != null ? segments[hover] : null

  return (
    <div className="viz" ref={ref}>
      {width > 0 && (
        <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img"
          aria-label={`Tren konsumsi BBM, ${segments.length} segmen, rata-rata ${kmPerLiter(average)}`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} className={t === 0 ? 'viz-baseline' : 'viz-grid'} />
              <text x={pad.left - 8} y={y(t)} className="viz-tick" textAnchor="end" dominantBaseline="middle">
                {t.toLocaleString('id-ID')}
              </text>
            </g>
          ))}
          <text x={pad.left - 8} y={10} className="viz-tick" textAnchor="end">km/L</text>

          {/* garis rata-rata (referensi), diberi label langsung di kanan */}
          {average != null && (
            <g>
              <line x1={pad.left} x2={width - pad.right} y1={y(average)} y2={y(average)} className="viz-ref" />
              <text x={width - pad.right + 6} y={y(average)} className="viz-tick" dominantBaseline="middle">rata-rata</text>
            </g>
          )}

          {segments.map((s, i) => i % every === 0 || i === last ? (
            <text key={i} x={x(i)} y={height - 8} className="viz-tick" textAnchor="middle">{shortDate(s.date)}</text>
          ) : null)}

          {h && <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + innerH} className="viz-crosshair" />}
          {segments.length > 1 && <path d={path} className="viz-line" />}
          {segments.map((s, i) => (
            <circle key={i} cx={x(i)} cy={y(s.km_per_liter)} r={hover === i ? 6 : 4} className="viz-dot" />
          ))}
          {/* label langsung hanya di titik terakhir */}
          <text x={x(last)} y={y(segments[last].km_per_liter) - 12} className="viz-label" textAnchor="middle">
            {segments[last].km_per_liter.toLocaleString('id-ID', { maximumFractionDigits: 1 })}
          </text>

          <rect x={pad.left - 12} y={pad.top} width={innerW + 24} height={innerH} fill="transparent"
            onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
        </svg>
      )}

      {h && (
        <div className="viz-tooltip" style={{ left: Math.min(Math.max(x(hover), 100), width - 100) }}>
          <strong>{tanggal(h.date)}</strong>
          <div className="tt-row tt-total">Konsumsi <span>{kmPerLiter(h.km_per_liter)}</span></div>
          <div className="tt-row">Jarak <span>{km(h.distance)}</span></div>
          <div className="tt-row">BBM terpakai <span>{liter(h.liters)}</span></div>
          <div className="tt-row">Biaya <span>{rupiah(h.cost)}</span></div>
          {h.fuel_type && <small className="muted">{h.fuel_type}</small>}
        </div>
      )}
    </div>
  )
}
