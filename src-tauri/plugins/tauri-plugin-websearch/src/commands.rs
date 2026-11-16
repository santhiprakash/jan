use crate::provider::{clamp_count, create_provider, FetchedPage, SearchResult};
use jan_utils::network::ProxyConfig;
use serde::Serialize;

#[derive(Debug, Clone, Serialize, thiserror::Error)]
#[error("WebSearchError: {message}")]
pub struct WebSearchError {
    pub message: String,
}

impl WebSearchError {
    fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
        }
    }
}

impl From<String> for WebSearchError {
    fn from(message: String) -> Self {
        Self::new(message)
    }
}

/// Search the web and return normalized results. `provider` selects the backend
/// (defaults to Exa); `api_key` (keyed backends) and `endpoint` (self-hosted
/// backends) are forwarded to the chosen backend. `proxy` is the user's
/// configured outbound proxy (Settings → Privacy → HTTPS Proxy); absent keeps
/// reqwest's env/system proxy defaults.
#[tauri::command]
pub async fn web_search(
    query: String,
    count: Option<u64>,
    provider: Option<String>,
    api_key: Option<String>,
    endpoint: Option<String>,
    proxy: Option<ProxyConfig>,
) -> Result<Vec<SearchResult>, WebSearchError> {
    let query = query.trim();
    if query.is_empty() {
        return Err(WebSearchError::new("web_search 'query' must not be empty."));
    }
    let backend = create_provider(provider.as_deref(), api_key, endpoint, proxy)?;
    let results = backend.search(query, clamp_count(count)).await?;
    Ok(results)
}

/// Fetch a web page by URL and return normalized, bounded readable content.
/// `proxy` is the user's configured outbound proxy, same as [`web_search`].
#[tauri::command]
pub async fn web_fetch(
    url: String,
    provider: Option<String>,
    api_key: Option<String>,
    endpoint: Option<String>,
    proxy: Option<ProxyConfig>,
) -> Result<FetchedPage, WebSearchError> {
    let url = url.trim();
    if url.is_empty() {
        return Err(WebSearchError::new("web_fetch 'url' must not be empty."));
    }
    if !(url.starts_with("http://") || url.starts_with("https://")) {
        return Err(WebSearchError::new(format!(
            "web_fetch 'url' must be an http(s) URL, got: {url}"
        )));
    }
    let backend = create_provider(provider.as_deref(), api_key, endpoint, proxy)?;
    let page = backend.fetch(url).await?;
    Ok(page)
}
