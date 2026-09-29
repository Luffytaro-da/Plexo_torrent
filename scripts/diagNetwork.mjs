import os from 'node:os'
import net from 'node:net'
import { execSync } from 'node:child_process'

console.log('='.repeat(70))
console.log('  RELAYTORRENT WINDOWS NETWORK & MULTI-INTERFACE ROUTING DIAGNOSTIC')
console.log('='.repeat(70))

// 1. Interfaces via OS
console.log('\n[1] Node os.networkInterfaces():')
const ifaces = os.networkInterfaces()
for (const [name, addrs] of Object.entries(ifaces)) {
  for (const addr of addrs || []) {
    if (addr.family === 'IPv4') {
      console.log(`  - ${name.padEnd(25)} IP: ${addr.address.padEnd(16)} Internal: ${addr.internal}`)
    }
  }
}

// 2. Windows NetAdapter via PowerShell
console.log('\n[2] Windows NetAdapter Status & Metrics:')
let adapters = []
try {
  const raw = execSync(
    'powershell.exe -NoProfile -Command "Get-NetAdapter | Select-Object Name, InterfaceDescription, Status, LinkSpeed, InterfaceIndex | ConvertTo-Json -Compress"',
    { timeout: 5000, encoding: 'utf8' }
  )
  const parsed = JSON.parse(raw)
  adapters = Array.isArray(parsed) ? parsed : [parsed]
  for (const a of adapters) {
    console.log(`  - Name: "${a.Name}" | Status: ${a.Status} | Index: ${a.InterfaceIndex} | Desc: ${a.InterfaceDescription}`)
  }
} catch (e) {
  console.log('  (PowerShell Get-NetAdapter failed or timed out:', e.message, ')')
}

// 3. Windows Route Table (Default Gateways & Active Routes)
console.log('\n[3] Windows Active IPv4 Routes:')
try {
  const raw = execSync(
    'powershell.exe -NoProfile -Command "Get-NetRoute -AddressFamily IPv4 | Where-Object { $_.NextHop -ne \'0.0.0.0\' -or $_.DestinationPrefix -eq \'0.0.0.0/0\' } | Select-Object DestinationPrefix, NextHop, InterfaceAlias, RouteMetric, InterfaceMetric | ConvertTo-Json -Compress"',
    { timeout: 5000, encoding: 'utf8' }
  )
  const parsed = JSON.parse(raw)
  const routes = Array.isArray(parsed) ? parsed : [parsed]
  for (const r of routes.slice(0, 10)) {
    console.log(`  - Dest: ${r.DestinationPrefix.padEnd(18)} Gateway: ${(r.NextHop || '-').padEnd(16)} Iface: ${r.InterfaceAlias.padEnd(15)} Metric: ${r.RouteMetric}`)
  }
} catch (e) {
  console.log('  (Failed to query routes:', e.message, ')')
}

// 4. Windows NDIS Hardware Adapter Statistics
console.log('\n[4] Windows NDIS Hardware Statistics (Get-NetAdapterStatistics):')
try {
  const raw = execSync(
    'powershell.exe -NoProfile -Command "Get-NetAdapterStatistics | Select-Object Name, ReceivedBytes, SentBytes | ConvertTo-Json -Compress"',
    { timeout: 5000, encoding: 'utf8' }
  )
  const parsed = JSON.parse(raw)
  const stats = Array.isArray(parsed) ? parsed : [parsed]
  for (const s of stats) {
    console.log(`  - ${s.Name.padEnd(20)} Received: ${s.ReceivedBytes} B | Sent: ${s.SentBytes} B`)
  }
} catch (e) {
  console.log('  (Failed to query adapter statistics:', e.message, ')')
}

// 5. Test Controlled Socket Binding to Available IPv4 Interfaces
console.log('\n[5] Controlled Socket Binding & Routing Test:')
const server = net.createServer((c) => {
  c.on('data', () => {})
})

await new Promise((resolve) => {
  server.listen(0, '127.0.0.1', () => {
    const port = server.address().port
    console.log(`  Loopback echo target listening on 127.0.0.1:${port}`)
    resolve(port)
  })
})

const testPort = server.address().port
const ipv4Addrs = []
for (const [name, addrs] of Object.entries(ifaces)) {
  for (const addr of addrs || []) {
    if (addr.family === 'IPv4' && !addr.internal) {
      ipv4Addrs.push({ name, address: addr.address })
    }
  }
}

for (const target of ipv4Addrs) {
  await new Promise((resolve) => {
    console.log(`  Testing outgoing socket bound to localAddress: ${target.address} (${target.name})...`)
    const socket = net.connect({
      host: '127.0.0.1',
      port: testPort,
      localAddress: target.address
    })

    socket.on('connect', () => {
      console.log(`    -> Result: CONNECTED. actual socket localAddress: ${socket.localAddress}:${socket.localPort}`)
      socket.destroy()
      resolve()
    })

    socket.on('error', (err) => {
      console.log(`    -> Result: FAILED (${err.code}: ${err.message})`)
      console.log(`       Explanation: Under Windows Strong Host Model, binding localAddress to ${target.address} for a destination not reachable via that interface causes ${err.code}.`)
      resolve()
    })
  })
}

server.close()
console.log('\n' + '='.repeat(70))
console.log('  DIAGNOSTIC COMPLETED')
console.log('='.repeat(70) + '\n')
