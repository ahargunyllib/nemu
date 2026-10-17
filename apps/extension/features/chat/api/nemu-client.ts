import type { NemuRequest, NemuResponse } from "@nemu/contracts";
import { type Client, createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";

import { DEFAULT_SERVER_URL } from "../../../shared/lib/config";
import type { ProcessInstanceClient } from "../../process-status/api/request-process-instance";
import type { NemuChatClient } from "./request-nemu-chat";

type NemuRouterClient = {
  nemuChat: Client<Record<never, never>, NemuRequest, NemuResponse, Error>;
  getProcessInstance: Client<Record<never, never>, { instanceId: string }, unknown, Error>;
};

/** Background-only: the Demo App session cookie rides along with `credentials: "include"`. */
export function createNemuClient(): NemuChatClient & ProcessInstanceClient {
  const serverUrl: string = import.meta.env.WXT_SERVER_URL || DEFAULT_SERVER_URL;
  const link = new RPCLink({
    url: `${serverUrl.replace(/\/$/, "")}/rpc`,
    fetch(url, options) {
      return fetch(url, { ...options, credentials: "include" });
    },
  });
  const client: NemuRouterClient = createORPCClient(link);
  return {
    nemuChat: (request) => client.nemuChat(request),
    getProcessInstance: (input) => client.getProcessInstance(input),
  };
}
