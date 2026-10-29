import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { ENV } from "@/env.public";

export const authClient = createAuthClient({
  baseURL: ENV.VITE_SERVER_URL,
  plugins: [
    inferAdditionalFields({
      user: {
        golongan: { type: "string", required: false },
        unit: { type: "string", required: false },
        province: { type: "string", required: false },
        role: { type: "string", required: false },
        workspaceId: { type: "string", required: false },
      },
    }),
  ],
});
