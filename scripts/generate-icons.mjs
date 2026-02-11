import { PNG } from 'pngjs'
import fs from 'node:fs'
import path from 'node:path'

function hexToRgb(hex) {
  const h = hex.replace('#', '').trim()
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function fill(png, { r, g, b, a = 255 }) {
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const i = (png.width * y + x) << 2
      png.data[i] = r
      png.data[i + 1] = g
      png.data[i + 2] = b
      png.data[i + 3] = a
    }
  }
}

function roundedRectMask(png, radius) {
  const w = png.width
  const h = png.height
  const r = radius

  function insideCorner(cx, cy, x, y) {
    const dx = x - cx
    const dy = y - cy
    return dx * dx + dy * dy <= r * r
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const inMain = x >= r && x < w - r || y >= r && y < h - r
      const inCorner =
        (x < r && y < r && insideCorner(r, r, x, y)) ||
        (x >= w - r && y < r && insideCorner(w - r - 1, r, x, y)) ||
        (x < r && y >= h - r && insideCorner(r, h - r - 1, x, y)) ||
        (x >= w - r && y >= h - r && insideCorner(w - r - 1, h - r - 1, x, y))

      const ok = inMain || inCorner
      if (!ok) {
        const i = (w * y + x) << 2
        png.data[i + 3] = 0
      }
    }
  }
}

function drawSimpleF(png, color) {
  // Very simple blocky F (no anti-alias) so it looks crisp at small sizes.
  const w = png.width
  const h = png.height

  const { r, g, b } = color

  const stroke = Math.max(10, Math.floor(w * 0.11))
  const left = Math.floor(w * 0.30)
  const top = Math.floor(h * 0.22)
  const height = Math.floor(h * 0.56)

  const midY = top + Math.floor(height * 0.42)
  const barW1 = Math.floor(w * 0.36)
  const barW2 = Math.floor(w * 0.30)

  function rect(x0, y0, x1, y1) {
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (w * y + x) << 2
        png.data[i] = r
        png.data[i + 1] = g
        png.data[i + 2] = b
        png.data[i + 3] = 255
      }
    }
  }

  // vertical
  rect(left, top, left + stroke, top + height)
  // top bar
  rect(left, top, left + barW1, top + stroke)
  // mid bar
  rect(left, midY, left + barW2, midY + stroke)
}

function makeIcon(size, outPath) {
  const png = new PNG({ width: size, height: size })

  // background
  fill(png, { ...hexToRgb('#EFF6FF'), a: 255 })

  // subtle border (1-2px)
  const border = Math.max(2, Math.floor(size * 0.02))
  const borderColor = hexToRgb('#BFDBFE')
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const isBorder = x < border || y < border || x >= size - border || y >= size - border
      if (isBorder) {
        const i = (size * y + x) << 2
        png.data[i] = borderColor.r
        png.data[i + 1] = borderColor.g
        png.data[i + 2] = borderColor.b
        png.data[i + 3] = 255
      }
    }
  }

  // rounded mask
  roundedRectMask(png, Math.floor(size * 0.22))

  // F
  drawSimpleF(png, hexToRgb('#1D4ED8'))

  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, PNG.sync.write(png))
}

makeIcon(192, 'public/icons/icon-192.png')
makeIcon(512, 'public/icons/icon-512.png')
makeIcon(180, 'public/apple-touch-icon.png')

console.log('Generated icons')
