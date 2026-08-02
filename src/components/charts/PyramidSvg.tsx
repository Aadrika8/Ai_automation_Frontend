/* Hand-rolled testing-pyramid SVG — geometry ported from the demo.
   Layers are drawn bottom→top; colors come from the tier CSS variables. */
import type { LayerId, LayerInfo } from '../../api'
import { cx } from '../../lib/format'

const TOP = 22
const BOTTOM = 420
const HALF_BASE = 278
const GAP = 5

export function PyramidSvg({ layers, hotLayer, onHover, onSelect }: {
  /** bottom-first (unit → e2e) */
  layers: LayerInfo[]
  hotLayer: LayerId | null
  onHover: (id: LayerId | null) => void
  onSelect: (id: LayerId) => void
}) {
  const bandH = (BOTTOM - TOP - (layers.length - 1) * GAP) / layers.length
  const hw = (y: number) => HALF_BASE * (y - TOP) / (BOTTOM - TOP)

  return (
    <svg viewBox="0 0 600 440" className="w-full h-auto" role="img" aria-label="Testing pyramid with selectable layers">
      {layers.map((layer, i) => {
        const by = BOTTOM - i * (bandH + GAP)
        const ty = by - bandH
        const points = `${300 - hw(by)},${by} ${300 + hw(by)},${by} ${300 + hw(ty)},${ty} ${300 - hw(ty)},${ty}`
        return (
          <polygon
            key={layer.id}
            points={points}
            fill={`var(${layer.colorVar})`}
            className={cx(
              'cursor-pointer transition-[filter,transform] duration-200 [transform-box:fill-box] origin-center',
              hotLayer === layer.id && 'brightness-110 scale-[1.025]',
            )}
            onMouseEnter={() => onHover(layer.id)}
            onMouseLeave={() => onHover(null)}
            onClick={() => onSelect(layer.id)}
          >
            <title>{layer.name}</title>
          </polygon>
        )
      })}
    </svg>
  )
}
