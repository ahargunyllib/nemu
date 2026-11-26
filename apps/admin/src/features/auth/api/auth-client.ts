import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { ENV } from "@/env.public";

export const authClient = createAuthClient({
  baseURL: ENV.VITE_SERVER_URL,
  // The role and workspace the Nemu Service seeds on each account (never set from the browser).
  plugins: [
    inferAdditionalFields({
      user: {
        role: { type: "string", required: false, input: false },
        workspaceId: { type: "string", required: false, input: false },
      },
    }),
  ],
});
