import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  output: process.env.STATIC_EXPORT ? 'export' : undefined,
  images: {
    unoptimized: true,
  },
  webpack(config, { isServer }) {
    // Nullify crunker for SSR (it uses browser APIs)
    if (isServer) {
      config.module.rules.push({
        test: /crunker/,
        use: 'null-loader',
      })
    }

    // Handle .jsonc files
    config.module.rules.push({
      test: /\.jsonc$/,
      use: ['jsonc-loader'],
    })

    // Handle SVG files as URL strings
    config.module.rules.push({
      test: /\.svg$/,
      type: 'asset/resource',
      generator: {
        filename: 'static/media/[name].[hash][ext]',
      },
    })

    // Path aliases
    config.resolve.alias = {
      ...config.resolve.alias,
      '@components': path.resolve(__dirname, 'src/components'),
      '@data': path.resolve(__dirname, 'src/data'),
      '@atoms': path.resolve(__dirname, 'src/atoms'),
      '@helpers': path.resolve(__dirname, 'src/helpers'),
      '@announcement-data': path.resolve(__dirname, 'src/announcement-data'),
      '@hooks': path.resolve(__dirname, 'src/hooks'),
      '@assets': path.resolve(__dirname, 'src/assets'),
    }

    return config
  },
}

export default nextConfig
