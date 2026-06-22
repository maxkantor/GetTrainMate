import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { prerenderSeoPlugin } from './vite-plugin-prerender-seo'

const ogTitle = 'GetTrainMate | Find Your Perfect Training Partner'
const ogDescription = 'Match, train, and connect with people who fit your goals and vibe.'

/** Must be absolute HTTPS for Facebook/LinkedIn og:image (relative URLs break link previews). */
const DEFAULT_PUBLIC_SITE_URL = 'https://gettrainmate.com'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname), '')
  const siteUrl = (env.VITE_PUBLIC_SITE_URL || DEFAULT_PUBLIC_SITE_URL).trim().replace(/\/$/, '')
  const ogImagePath = '/images/og-image.jpg?v=2'
  const ogImageUrl = `${siteUrl}${ogImagePath}`
  const canonicalLine = `<link rel="canonical" href="${siteUrl}/" />`
  const ogUrlLine = `<meta property="og:url" content="${siteUrl}/" />`
  const gsc = (env.VITE_GSC_VERIFICATION || '').trim()
  const gscMetaLine = gsc
    ? `<meta name="google-site-verification" content="${gsc.replace(/"/g, '')}" />`
    : ''
  const themeColor = env.VITE_THEME_COLOR || '#070b1a'

  return {
    plugins: [
      react(),
      prerenderSeoPlugin(),
      {
        name: 'inject-og-meta',
        transformIndexHtml(html) {
          return html
            .replace(/%OG_TITLE%/g, ogTitle)
            .replace(/%OG_DESCRIPTION%/g, ogDescription)
            .replace(/%OG_IMAGE_URL%/g, ogImageUrl)
            .replace(/%CANONICAL_LINE%/g, canonicalLine)
            .replace(/%OG_URL_LINE%/g, ogUrlLine)
            .replace(/%GSC_META_LINE%/g, gscMetaLine)
            .replace(/%THEME_COLOR%/g, themeColor)
        },
      },
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return
            if (id.includes('@mui')) return 'mui'
            if (id.includes('aws-amplify') || id.includes('@aws-amplify')) return 'amplify'
            if (id.includes('framer-motion')) return 'motion'
            if (id.includes('react-dom') || id.includes('react-router')) return 'react-vendor'
          },
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
    },
    envDir: path.resolve(__dirname),
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: process.env.VITE_API_URL || 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
  }
})
