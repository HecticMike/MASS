import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const withTrailingSlash = (value: string) => (value.endsWith('/') ? value : `${value}/`)

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  const envBase = process.env.VITE_PUBLIC_BASE_PATH ?? process.env.PUBLIC_BASE_PATH
  const base =
    typeof envBase === 'string' && envBase.trim().length > 0
      ? withTrailingSlash(envBase.trim())
      : command === 'build'
        ? '/mass/'
        : '/'

  return {
    base,
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          sw: resolve(__dirname, 'src/sw.ts'),
        },
        output: {
          entryFileNames: (chunk) =>
            chunk.name === 'sw' ? 'sw.js' : 'assets/[name].[hash].js',
          chunkFileNames: 'assets/[name].[hash].js',
          assetFileNames: 'assets/[name].[hash][extname]',
        },
      },
    },
  }
})
