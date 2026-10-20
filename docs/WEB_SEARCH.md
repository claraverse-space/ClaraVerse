# Web search providers

The built-in `search_web` tool uses **SearXNG** by default. Existing
`SEARXNG_URL` and `SEARXNG_URLS` settings keep working, including load balancing
and the search cache.

To use hosted web search, set this in the backend environment
(or the root `.env` file for Docker Compose), then restart the backend:

```dotenv
SEARCH_PROVIDER=parallel
```

This setting switches `search_web` only. Existing Docker Compose services and
their dependencies remain in the stack, and image search still uses SearXNG.

[Parallel Search MCP](https://docs.parallel.ai/integrations/mcp/search-mcp)
provides free web search using Fast mode, with no account or API key required.
The backend connects to `https://search.parallel.ai/mcp` over Streamable HTTP.
Search queries are sent to Parallel, so keep the default `searxng` provider if
you want search to stay on your own infrastructure. Anonymous usage has rate
limits; service errors are returned to the caller without switching providers.

Use the existing `search_web` tool through Clara's usual tool routing. The
disabled-tools setting and permission hooks still apply. Results
retain source URLs and excerpts for citations. `scrape_web` and image search
continue to use their existing implementations.

Related searches in one conversation share an opaque session identifier derived
from the application's conversation ID; a new conversation starts a new session.
The backend does not send the user's ID or credentials to Parallel. Requests
have a 30-second deadline, and channel callers also propagate cancellation.

Set `SEARCH_PROVIDER=searxng` (or leave it unset) to use SearXNG again. An unknown
provider is reported as a configuration error. Changing provider does not change
or remove your SearXNG URLs.
