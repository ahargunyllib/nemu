import { Hono } from "hono";

import { api } from "./api/routes";
import type { MockEnv } from "./env";
import { halaman } from "./page/routes";

// Static files in public/ (the mock page) are served before this Worker runs; it only handles
// the page's own calls and the AlurSekolah-shaped read API.
const app = new Hono<{ Bindings: MockEnv }>();

app.route("/_mock", halaman);
app.route("/api/v1", api);

export default app;
