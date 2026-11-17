import { useTheme } from '../theme'
import { Icon } from './Sidebar'

/** Tombol ganti tema terang / gelap. Ikon menunjukkan tema tujuan. */
export default function ThemeToggle() {
  const theme = useTheme((s) => s.theme)
  const toggle = useTheme((s) => s.toggle)
  const next = theme === 'dark' ? 'terang' : 'gelap'

  return (
    <button className="icon-btn" onClick={toggle} title={`Ganti ke tema ${next}`} aria-label={`Ganti ke tema ${next}`}>
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
    </button>
  )
}
