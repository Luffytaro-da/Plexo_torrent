import net from 'node:net'
import os from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import {
  getRouteRecord,
  installMultiInterfaceSocketInterceptor,
  parseConnectArgs,
  uninstallMultiInterfaceSocketInterceptor
} from '../../src/main/network/deviceBinding'

const localIp = Object.values(os.networkInterfaces())
  .flat()
  .find((address) => address && address.family === 'IPv4' && !address.internal)?.address

afterEach(() => uninstallMultiInterfaceSocketInterceptor())

describe('parseConnectArgs', () => {
  it('reads the normalized array passed by net.connect to Socket#connect', () => {
    const callback = (): void => {}
    const parsed = parseConnectArgs([[{ host: '203.0.113.5', port: 6881 }, callback]])
    expect(parsed?.options).toMatchObject({ host: '203.0.113.5', port: 6881 })
    expect(parsed?.cb).toBe(callback)
  })

  it('reads object and port/host forms and ignores IPC paths', () => {
    expect(parseConnectArgs([{ host: '1.2.3.4', port: 1 }])?.options.host).toBe('1.2.3.4')
    expect(parseConnectArgs([80, '1.2.3.4'])?.options).toEqual({ port: 80, host: '1.2.3.4' })
    expect(parseConnectArgs(['/tmp/sock'])).toBeNull()
  })
})

describe.skipIf(!localIp)('WebTorrent TCP connection path', () => {
  it('routes net.connect({ host, port }) and records the route', async () => {
    const server = net.createServer()
    await new Promise<void>((resolve) => server.listen(0, localIp, () => resolve()))
    const port = (server.address() as net.AddressInfo).port
    const selection = { id: 'test', displayName: 'Test NIC', address: localIp as string }
    const calls: string[] = []
    installMultiInterfaceSocketInterceptor((host, peerPort) => {
      calls.push(`${host}:${peerPort}`)
      return { targetInterface: selection }
    })

    const socket = net.connect({ host: localIp as string, port })
    await new Promise<void>((resolve) => socket.once('connect', () => resolve()))
    expect(calls).toEqual([`${localIp}:${port}`])
    expect(getRouteRecord(localIp, port)?.actualLocalAddress).toBe(localIp)
    socket.destroy()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })
})