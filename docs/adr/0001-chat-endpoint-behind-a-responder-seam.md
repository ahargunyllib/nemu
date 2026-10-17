# Chat endpoint sits in front of a swappable responder

The Nemu Service's chat endpoint (`nemuChat`) validates against the shared `@nemu/contracts` schemas and hands every request to one `NemuService` interface. The real implementation calls the AI pipeline (`runNemu` in `@nemu/ai`). A dev-only env switch swaps in a fixture responder that answers from `@nemu/contracts/fixtures`, so the extension and Demo App can be built and tested without an OpenRouter key, credits, or non-deterministic answers. Retrieval, SBM lookup and calculation functions live behind the interface, not in the endpoint.
