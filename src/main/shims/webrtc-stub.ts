// Stub for node-datachannel and webrtc-polyfill in desktop Electron
// RelayTorrent uses pure native TCP sockets for standard BitTorrent swarms.

export class RTCPeerConnection {
  oniceconnectionstatechange: any = null
  onicegatheringstatechange: any = null
  onsignalingstatechange: any = null
  onicecandidate: any = null
  ondatachannel: any = null
  ontrack: any = null
  onconnectionstatechange: any = null
  iceGatheringState = 'complete'
  iceConnectionState = 'closed'
  signalingState = 'stable'
  connectionState = 'closed'

  createDataChannel() {
    return {
      onopen: null,
      onclose: null,
      onerror: null,
      onmessage: null,
      send() {},
      close() {}
    }
  }

  async createOffer() {
    return { type: 'offer', sdp: '' }
  }

  async createAnswer() {
    return { type: 'answer', sdp: '' }
  }

  async setLocalDescription() {}
  async setRemoteDescription() {}
  async addIceCandidate() {}
  async getStats() {
    return new Map()
  }
  getSenders() {
    return []
  }
  getReceivers() {
    return []
  }
  addTrack() {}
  removeTrack() {}
  close() {}
}

export class RTCSessionDescription {
  type: string
  sdp: string
  constructor(init?: { type?: string; sdp?: string }) {
    this.type = init?.type || 'offer'
    this.sdp = init?.sdp || ''
  }
}

export class RTCIceCandidate {
  candidate: string
  constructor(init?: { candidate?: string }) {
    this.candidate = init?.candidate || ''
  }
}

export class RTCIceTransport {}
export class RTCDataChannel {}
export class RTCSctpTransport {}
export class RTCDtlsTransport {}
export class RTCCertificate {}
export class MediaStream {}
export class MediaStreamTrack {}

export default {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  RTCDataChannel
}
