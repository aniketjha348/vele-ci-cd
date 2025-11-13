declare module 'simple-peer' {
  interface SimplePeerOptions {
    initiator?: boolean
    trickle?: boolean
    stream?: MediaStream
    config?: {
      iceServers?: Array<{ urls: string }>
    }
  }

  class SimplePeer {
    constructor(options?: SimplePeerOptions)
    signal(data: any): void
    destroy(): void
    on(event: 'signal', handler: (data: any) => void): void
    on(event: 'stream', handler: (stream: MediaStream) => void): void
    on(event: 'connect', handler: () => void): void
    on(event: 'error', handler: (err: Error) => void): void
  }

  namespace SimplePeer {
    type Instance = SimplePeer
  }

  export = SimplePeer
}

