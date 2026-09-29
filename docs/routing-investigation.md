# Multi-interface routing: Plexo vs RelayTorrent (pre-fix comparison)

Plexo owns each HTTP range socket through its custom agent and binds that socket as part of the same call chain as network selection. RelayTorrent delegates peer socket creation to WebTorrent, so the selection can be lost before `net.connect()`.

The installed WebTorrent implementation creates outgoing TCP peers with `net.connect({ host, port })`. Node forwards this through `Socket#connect` using a normalized argument array. The previous interceptor spread that array as an object, lost `host` and `port`, swallowed the error, and allowed the original unrouted connection to continue.

RelayTorrent also cannot read the peer socket from WebTorrent's `wire` object. Routing metadata must therefore be recorded by remote `ip:port` and joined to the later wire event. Source-address binding on Windows is best effort; it does not prove physical adapter traffic without OS-level counters.

Inbound peers, UDP/DHT/tracker sockets, and hostname-based HTTP connections remain outside the TCP peer router. If measured adapter counters still show one interface after this fix, evaluate a torrent engine with native outgoing-interface binding rather than adding UI-only attribution.