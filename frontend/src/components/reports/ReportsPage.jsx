import { useState } from 'react'
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { api, errorMessage } from '../../api'
import { ACTIONS, km, tanggal } from '../../format'
import { HorizontalBars, MonthlyStackedChart, categoryColor, rupiah, rupiahShort } from './charts'

const iso = (d) => d.toLocaleDateString('sv-SE')
const today = () => new Date()

/** Preset periode: [label, fungsi → {from, to}] */
const PRESETS = {
  this_month: ['Bulan ini', () => { const t = today(); return { from: iso(new Date(t.getFullYear(), t.getMonth(), 1)), to: iso(t) } }],
  '3m': ['3 bulan terakhir', () => lastMonths(3)],
  '6m': ['6 bulan terakhir', () => lastMonths(6)],
  '12m': ['12 bulan terakhir', () => lastMonths(12)],
  this_year: ['Tahun ini', () => { const t = today(); return { from: `${t.getFullYear()}-01-01`, to: iso(t) } }],
  last_year: ['Tahun lalu', () => { const y = today().getFullYear() - 1; return { from: `${y}-01-01`, to: `${y}-12-31` } }],
  custom: ['Rentang sendiri…', null],
}
function lastMonths(n) {
  const t = today()
  return { from: iso(new Date(t.getFullYear(), t.getMonth() - (n - 1), 1)), to: iso(t) }
}

/** Halaman laporan biaya maintenance. */
export default function ReportsPage({ vehicles }) {
  const [preset, setPreset] = useState('12m')
  const [range, setRange] = useState(() => PRESETS['12m'][1]())
  const [vehicleId, setVehicleId] = useState('')
  const [showTable, setShowTable] = useState(false)
  const [printedAt] = useState(() => new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }))

  const params = { ...range, vehicle_id: vehicleId || undefined }
  const report = useQuery({
    queryKey: ['report', params],
    queryFn: () => api.costReport(params),
    placeholderData: keepPreviousData,
    enabled: !!range.from && !!range.to && range.from <= range.to,
  })
  const exportXlsx = useMutation({ mutationFn: () => api.exportCostReport(params) })

  const choosePreset = (key) => {
    setPreset(key)
    if (PRESETS[key][1]) setRange(PRESETS[key][1]())
  }

  const d = report.data
  const vehicleName = vehicleId ? vehicles?.find((v) => v.id === Number(vehicleId)) : null

  return (
    <section className="report">
      {/* Filter dalam satu baris di atas grafik */}
      <div className="report-filters no-print">
        <select value={preset} onChange={(e) => choosePreset(e.target.value)} aria-label="Periode">
          {Object.entries(PRESETS).map(([k, [label]]) => <option key={k} value={k}>{label}</option>)}
        </select>
        {preset === 'custom' && (
          <>
            <input type="date" value={range.from} max={range.to} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} aria-label="Dari tanggal" />
            <span className="muted">s/d</span>
            <input type="date" value={range.to} min={range.from} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} aria-label="Sampai tanggal" />
          </>
        )}
        <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} aria-label="Kendaraan">
          <option value="">Semua kendaraan</option>
          {vehicles?.map((v) => <option key={v.id} value={v.id}>{v.plate_number} – {v.brand} {v.model}</option>)}
        </select>
        <span className="spacer" />
        <button onClick={() => exportXlsx.mutate()} disabled={!d || exportXlsx.isPending}>
          {exportXlsx.isPending ? 'Menyiapkan…' : '⬇ Export Excel'}
        </button>
        <button onClick={() => window.print()} disabled={!d}>🖨 Cetak / PDF</button>
      </div>
      {exportXlsx.isError && <p className="error no-print">Gagal export: {errorMessage(exportXlsx.error)}</p>}
      {report.isError && <p className="error">Gagal memuat laporan: {errorMessage(report.error)}</p>}

      {/* Judul khusus cetak */}
      <div className="print-only print-head">
        <h1>Laporan Biaya Maintenance</h1>
        {d && (
          <p>
            Periode {tanggal(d.filter.from)} – {tanggal(d.filter.to)} ·{' '}
            {d.filter.vehicle ? `${d.filter.vehicle.plate_number} – ${d.filter.vehicle.brand} ${d.filter.vehicle.model}` : 'Semua kendaraan'} ·
            dicetak {printedAt}
          </p>
        )}
      </div>

      {!d && report.isLoading && <p className="muted">Memuat laporan…</p>}

      {d && (
        <div className={`report-body ${report.isFetching ? 'refreshing' : ''}`}>
          <div className="report-tiles">
            <Tile label="Total biaya" value={rupiah(d.summary.total)} sub={`${tanggal(d.filter.from)} – ${tanggal(d.filter.to)}`} hero />
            <Tile label="Jumlah catatan" value={d.summary.count.toLocaleString('id-ID')} sub={vehicleName ? vehicleName.plate_number : 'semua kendaraan'} />
            <Tile label="Rata-rata per bulan" value={rupiahShort(d.summary.avg_per_month)} sub={`dari ${d.summary.months} bulan`} />
            <Tile
              label="Kategori terbesar"
              value={d.summary.top_category?.category ?? '-'}
              sub={d.summary.top_category ? `${rupiahShort(d.summary.top_category.total)} · ${Math.round(d.summary.top_category.share * 100)}% dari total` : 'belum ada biaya'}
              swatch={d.summary.top_category && categoryColor(d.categories, d.summary.top_category.category)}
            />
          </div>

          {d.summary.count === 0 ? (
            <div className="card empty-report">Tidak ada catatan maintenance pada periode ini.</div>
          ) : (
            <>
              <div className="card">
                <div className="card-head">
                  <h3>Biaya per bulan</h3>
                  <button className="link no-print" onClick={() => setShowTable((s) => !s)}>
                    {showTable ? 'Sembunyikan tabel' : 'Lihat tabel'}
                  </button>
                </div>
                <MonthlyStackedChart months={d.monthly} categories={d.categories} />
                {/* Tabel: selalu ikut tercetak (warna terang di kertas butuh angka pendamping) */}
                <div className={showTable ? '' : 'print-only'}>
                  <MonthlyTable d={d} />
                </div>
              </div>

              <div className="report-grid">
                <div className="card">
                  <h3>Biaya per kategori</h3>
                  <HorizontalBars
                    ariaLabel="Biaya per kategori"
                    rows={d.by_category.map((c) => ({
                      key: c.category, label: c.category, sub: `${c.count} catatan`,
                      value: c.total, share: c.share, color: categoryColor(d.categories, c.category),
                    }))}
                  />
                </div>
                {!vehicleId && (
                  <div className="card">
                    <h3>Biaya per kendaraan</h3>
                    <HorizontalBars
                      ariaLabel="Biaya per kendaraan"
                      rows={d.by_vehicle.map((v) => ({
                        key: v.vehicle_id, label: v.plate_number, sub: v.name,
                        value: v.total, share: v.share, color: 'var(--seq-1)',
                      }))}
                    />
                  </div>
                )}
              </div>

              <div className="card">
                <h3>10 part dengan biaya terbesar</h3>
                <table className="report-table">
                  <thead>
                    <tr><th>#</th><th>Part</th><th>Kategori</th><th className="num">Catatan</th><th className="num">Total biaya</th><th className="num">Porsi</th></tr>
                  </thead>
                  <tbody>
                    {d.by_part.map((p, i) => (
                      <tr key={p.part_id}>
                        <td className="muted">{i + 1}</td>
                        <td>{p.name}</td>
                        <td><i className="swatch" style={{ background: categoryColor(d.categories, p.category) }} /> {p.category}</td>
                        <td className="num">{p.count}</td>
                        <td className="num">{rupiah(p.total)}</td>
                        <td className="num">{(p.share * 100).toLocaleString('id-ID', { maximumFractionDigits: 1 })}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <details className="card details-records" open={false}>
                <summary>Rincian {d.records.length} catatan</summary>
                <RecordsTable records={d.records} showVehicle={!vehicleId} />
              </details>
              {/* versi cetak: rincian selalu tampil */}
              <div className="card print-only">
                <h3>Rincian catatan</h3>
                <RecordsTable records={d.records} showVehicle={!vehicleId} />
              </div>
            </>
          )}
        </div>
      )}
    </section>
  )
}

function Tile({ label, value, sub, hero, swatch }) {
  return (
    <div className={`tile ${hero ? 'tile-hero' : ''}`}>
      <span className="tile-label">{label}</span>
      <span className="tile-value">
        {swatch && <i className="swatch" style={{ background: swatch }} />}
        {value}
      </span>
      <span className="tile-sub">{sub}</span>
    </div>
  )
}

function MonthlyTable({ d }) {
  const used = d.categories.filter((c) => d.monthly.some((m) => (m.by_category[c] ?? 0) > 0))
  return (
    <table className="report-table compact">
      <thead>
        <tr>
          <th>Bulan</th>
          {used.map((c) => <th key={c} className="num">{c}</th>)}
          <th className="num">Total</th>
        </tr>
      </thead>
      <tbody>
        {d.monthly.map((m) => (
          <tr key={m.month} className={m.total ? '' : 'muted'}>
            <td>{m.label}</td>
            {used.map((c) => <td key={c} className="num">{m.by_category[c] ? rupiah(m.by_category[c]) : '-'}</td>)}
            <td className="num"><strong>{m.total ? rupiah(m.total) : '-'}</strong></td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td><strong>Total</strong></td>
          {used.map((c) => (
            <td key={c} className="num">{rupiah(d.monthly.reduce((s, m) => s + (m.by_category[c] ?? 0), 0))}</td>
          ))}
          <td className="num"><strong>{rupiah(d.summary.total)}</strong></td>
        </tr>
      </tfoot>
    </table>
  )
}

function RecordsTable({ records, showVehicle }) {
  return (
    <table className="report-table compact">
      <thead>
        <tr>
          <th>Tanggal</th>{showVehicle && <th>Plat</th>}<th>Part</th><th>Tindakan</th>
          <th className="num">Odometer</th><th>Merek</th><th>Bengkel</th><th className="num">Biaya</th>
        </tr>
      </thead>
      <tbody>
        {records.map((r) => (
          <tr key={r.id}>
            <td>{tanggal(r.service_date)}</td>
            {showVehicle && <td>{r.plate_number}</td>}
            <td>{r.part}</td>
            <td>{ACTIONS[r.action]}</td>
            <td className="num">{km(r.odometer)}</td>
            <td>{r.part_brand || '-'}</td>
            <td>{r.workshop || '-'}</td>
            <td className="num">{rupiah(r.cost)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
