import type { InterfacePolicy, NetworkInterfaceInfo } from '../../shared/types'

export class InterfacePolicyEngine {
  /**
   * Filters and orders available network interfaces based on a torrent's InterfacePolicy.
   */
  static getEligibleInterfaces(
    policy: InterfacePolicy,
    allInterfaces: NetworkInterfaceInfo[]
  ): NetworkInterfaceInfo[] {
    const online = allInterfaces.filter((iface) => iface.isOnline && iface.enabled)
    if (online.length === 0) return []

    switch (policy.mode) {
      case 'single': {
        if (!policy.targetInterfaceId) return [online[0]]
        const target = online.find((iface) => iface.id === policy.targetInterfaceId)
        return target ? [target] : [online[0]]
      }

      case 'custom': {
        if (!policy.enabledInterfaceIds || policy.enabledInterfaceIds.length === 0) {
          return online
        }
        const allowed = new Set(policy.enabledInterfaceIds)
        const custom = online.filter((iface) => allowed.has(iface.id))
        return custom.length > 0 ? custom : online
      }

      case 'preferred': {
        if (!policy.targetInterfaceId) return online
        const target = online.find((iface) => iface.id === policy.targetInterfaceId)
        if (!target) return online
        // Put preferred first, followed by others
        return [target, ...online.filter((iface) => iface.id !== policy.targetInterfaceId)]
      }

      case 'automatic':
      default:
        return online
    }
  }

  /**
   * Selects an interface for a new connection using round-robin / load-balancing among eligible interfaces.
   */
  static selectInterfaceForConnection(
    policy: InterfacePolicy,
    allInterfaces: NetworkInterfaceInfo[],
    connectionCounter: number
  ): NetworkInterfaceInfo | null {
    const eligible = this.getEligibleInterfaces(policy, allInterfaces)
    if (eligible.length === 0) return null

    if (policy.mode === 'single') {
      return eligible[0]
    }

    if (policy.mode === 'preferred') {
      // 75% traffic to preferred if available, 25% distributed across others
      if (eligible.length > 1 && connectionCounter % 4 === 0) {
        const secondaryIndex = 1 + ((connectionCounter / 4) % (eligible.length - 1))
        return eligible[secondaryIndex]
      }
      return eligible[0]
    }

    // Automatic / Custom: distribute evenly
    const index = connectionCounter % eligible.length
    return eligible[index]
  }
}
