export interface SearchResult {
  title: string
  url: string
  snippet: string
  published_at?: string
}

export interface FetchedPage {
  url: string
  title: string
  content: string
  truncated: boolean
}

/**
 * Outbound proxy configuration consumed by `web_search` / `web_fetch`.
 * Field names match the Rust `ProxyConfig` serde contract shared with the
 * desktop download path (`jan_utils::network::ProxyConfig`).
 */
export interface ProxyConfig {
  /** Proxy URL, e.g. `http://proxy.local:8080` or `socks5://127.0.0.1:1080`. */
  url: string
  username?: string
  password?: string
  /** Hosts that bypass the proxy. */
  no_proxy?: string[]
  /** Disable TLS certificate verification for requests through this proxy. */
  ignore_ssl?: boolean
}
