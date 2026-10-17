# Chat endpoint sits in front of a swappable Responder

The AI's stack and where it runs are still open, but the Demo App, Nemu Extension and Admin Workspace have to be built now. So the Nemu Service's chat endpoint owns the request/response contract (Zod schemas shared with the extension) and hands every request to one Responder interface. Until the AI team's Responder lands, a fixture Responder returns hard-coded, contract-valid replies for Momen 1–3, so the whole demo runs end to end without AI. Retrieval, SBM lookup and calculation functions live behind the Responder, not in the endpoint.
