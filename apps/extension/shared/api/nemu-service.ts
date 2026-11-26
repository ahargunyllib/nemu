import {
  EXTENSION_HEADERS,
  type ExtensionConfig,
  type ExtensionIdentity,
} from "@nemu/contracts/extension";
import type {
  CommandRoute,
  GroundedAnswer,
  HelpExplanation,
  ScreenSnapshot,
} from "@nemu/contracts/school";
import { type Client, createORPCClient, ORPCError } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";

import { serverUrl } from "../lib/config";

type Call<Input, Output> = Client<Record<never, never>, Input, Output, Error>;

/** The procedures the extension calls; their schemas come from `@nemu/contracts`. */
export type NemuServiceClient = {
  extensionConfig: Call<undefined, ExtensionConfig>;
  extensionIdentify: Call<undefined, ExtensionIdentity>;
  helpRoute: Call<{ utterance: string }, CommandRoute>;
  helpAsk: Call<{ question: string }, GroundedAnswer>;
  helpExplain: Call<{ snapshot: ScreenSnapshot; question: string | null }, HelpExplanation>;
};

export type ExtensionCredentials = { installCode: string; email?: string | null };

/**
 * A client that proves who is asking with the install code and the page email instead of a login
 * (ADR-0015). Extension pages and the background call the Nemu Service under the manifest's host
 * permission, so CORS never applies.
 */
export function createNemuServiceClient(credentials: ExtensionCredentials): NemuServiceClient {
  const headers: Record<string, string> = {
    [EXTENSION_HEADERS.installCode]: credentials.installCode,
  };
  if (credentials.email) headers[EXTENSION_HEADERS.email] = credentials.email;
  return createORPCClient(new RPCLink({ url: `${serverUrl()}/rpc`, headers }));
}

/** The sentence to show for a failed call: the service's own Indonesian refusal, or a network one. */
export function failureMessage(error: unknown): string {
  if (error instanceof ORPCError && error.code !== "INTERNAL_SERVER_ERROR" && error.message) {
    return error.message;
  }
  return "Nemu belum bisa dihubungi. Coba lagi sebentar lagi.";
}

/** Whether the Nemu Service refused the install code itself, so the settings need a new one. */
export function isInvalidInstallCode(error: unknown): boolean {
  return (
    error instanceof ORPCError &&
    error.code === "UNAUTHORIZED" &&
    (error.data as { reason?: string } | undefined)?.reason === "invalid_install_code"
  );
}
