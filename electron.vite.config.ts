import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin({
        exclude: [
          'webtorrent',
          'bittorrent-tracker',
          'parse-torrent',
          'magnet-uri',
          'uint8-util',
          'create-torrent',
          'node-datachannel',
          'webrtc-polyfill',
          'bufferutil',
          'utf-8-validate',
          'utp-native'
        ]
      })
    ],
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
        'uint8-util': resolve('src/main/shims/uint8-util-stub.ts'),
        'utp-native': resolve('src/main/shims/utp-native-stub.ts'),
        'node-datachannel': resolve('src/main/shims/webrtc-stub.ts'),
        'webrtc-polyfill': resolve('src/main/shims/webrtc-stub.ts'),
        'bufferutil': resolve('src/main/shims/bufferutil-stub.ts'),
        'utf-8-validate': resolve('src/main/shims/utf8-validate-stub.ts')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        output: {
          format: 'cjs',
          entryFileNames: '[name].cjs'
        }
      }
    },
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [react(), tailwindcss()]
  }
})
