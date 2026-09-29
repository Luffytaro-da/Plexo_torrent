import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  _electron as electron,
  expect,
  test as base,
  type ElectronApplication,
  type Page
} from '@playwright/test'
import type { IpcContract } from '../../src/shared/ipc-contract'

export { expect }

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '../..')

export class RelayApp {
  electronApp!: ElectronApplication
  page!: Page

  constructor(readonly dirs: { userData: string; downloads: string }) {}

  async launch(extraEnv: Record<string, string> = {}): Promise<this> {
    const testEnv: Record<string, string> = {
      ...(process.env as Record<string, string>),
      RELAY_USER_DATA: this.dirs.userData,
      RELAY_TEST_INTERFACES: 'eth0=192.168.1.50,wlan0=192.168.1.51',
      ...extraEnv
    }
    delete testEnv.ELECTRON_RENDERER_URL

    this.electronApp = await electron.launch({
      args: [PROJECT_ROOT, ...(process.platform === 'linux' ? ['--no-sandbox'] : [])],
      env: testEnv
    })

    const child = this.electronApp.process()
    child.stdout?.on('data', (d) => console.log(`[Electron stdout]: ${String(d)}`))
    child.stderr?.on('data', (d) => console.error(`[Electron stderr]: ${String(d)}`))

    this.page = await this.electronApp.firstWindow()
    await this.page.waitForLoadState('domcontentloaded')
    return this
  }

  async quit(): Promise<void> {
    if (this.electronApp) {
      await this.electronApp.close()
    }
  }

  api = new Proxy({} as {
    [K in keyof IpcContract]: (...args: IpcContract[K]['args']) => Promise<IpcContract[K]['result']>
  }, {
    get:
      (_target, name: string) =>
      (...args: unknown[]) =>
        this.page.evaluate(
          ([method, params]) =>
            (window.relayTorrent as unknown as Record<string, (...a: unknown[]) => unknown>)[method](
              ...params
            ),
          [name, args] as const
        )
  })
}

interface TestFixtures {
  app: RelayApp
}

export const test = base.extend<TestFixtures>({
  app: async ({}, use) => {
    const root = await mkdtemp(join(tmpdir(), 'relay-e2e-'))
    const dirs = { userData: join(root, 'userData'), downloads: join(root, 'downloads') }
    await Promise.all([mkdir(dirs.userData), mkdir(dirs.downloads)])

    const relayApp = new RelayApp(dirs)
    await relayApp.launch()
    await use(relayApp)

    await relayApp.quit().catch(() => {})
    await rm(root, { recursive: true, force: true })
  }
})
