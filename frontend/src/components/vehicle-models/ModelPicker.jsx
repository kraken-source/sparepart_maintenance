import ModelThumb from './ModelThumb'

/**
 * Pilihan model 3D di form kendaraan: kartu bergambar dari master, hanya untuk jenis kendaraan
 * yang dipilih. Model nonaktif tidak ditawarkan, kecuali yang sedang dipakai kendaraan ini.
 */
export default function ModelPicker({ models, type, value, currentId, onChange, error }) {
  const options = (models ?? []).filter((m) => m.vehicle_type === type && (m.is_active || m.id === currentId))

  return (
    <fieldset className={`model-picker ${error ? 'has-error' : ''}`}>
      <legend>Model 3D</legend>
      {!models && <p className="muted">Memuat daftar model…</p>}
      <div className="model-options" role="radiogroup" aria-label="Model 3D">
        {options.map((m) => (
          <label key={m.id} className={`model-option ${value === m.id ? 'selected' : ''}`}>
            <input type="radio" name="vehicle_model" checked={value === m.id} onChange={() => onChange(m.id)} />
            <ModelThumb model={m} />
            <span className="model-option-name">{m.name}</span>
            <small className="muted">{m.source === 'builtin' ? 'Bawaan' : 'File .glb'}{m.is_active ? '' : ' · nonaktif'}</small>
          </label>
        ))}
      </div>
      {error
        ? <small className="error">{error}</small>
        : <small className="muted">Model baru ditambahkan admin di menu Master Data → Model 3D.</small>}
    </fieldset>
  )
}
