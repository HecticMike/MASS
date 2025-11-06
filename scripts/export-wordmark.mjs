import opentype from 'opentype.js'
import { resolve } from 'node:path'

const fontPath = resolve('src/assets/fonts/Pacifico-Regular.ttf')
const size = Number(process.argv[2] ?? 220)
const text = process.argv[3] ?? 'mass'

const font = await new Promise((resolveFont, reject) => {
  opentype.load(fontPath, (err, loaded) => {
    if (err || !loaded) {
      reject(err ?? new Error('Unable to load font'))
      return
    }
    resolveFont(loaded)
  })
})

const glyphPath = font.getPath(text, 0, 0, size, { kerning: true })
const bbox = glyphPath.getBoundingBox()

const translate = (path, dx, dy) => {
  for (const command of path.commands) {
    if ('x' in command && typeof command.x === 'number') {
      command.x += dx
    }
    if ('y' in command && typeof command.y === 'number') {
      command.y += dy
    }
    if ('x1' in command && typeof command.x1 === 'number') {
      command.x1 += dx
    }
    if ('y1' in command && typeof command.y1 === 'number') {
      command.y1 += dy
    }
    if ('x2' in command && typeof command.x2 === 'number') {
      command.x2 += dx
    }
    if ('y2' in command && typeof command.y2 === 'number') {
      command.y2 += dy
    }
  }
}

translate(glyphPath, -bbox.x1, -bbox.y1)

const payload = {
  width: +(bbox.x2 - bbox.x1).toFixed(2),
  height: +(bbox.y2 - bbox.y1).toFixed(2),
  d: glyphPath.toPathData(2),
}

console.log(JSON.stringify(payload, null, 2))
