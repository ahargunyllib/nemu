import ReactDOM from "react-dom/client";

import { requestSiteAccess } from "../../features/allowed-sites/api/request-site-access";
import { KNOWN_SITE_MATCHES } from "../../shared/lib/config";
import { loadNemuFont } from "./nemu-font";
import { NemuApp } from "./nemu-app";

import "./style.css";

export default defineContentScript({
  // Every site the extension can reach (ADR-0016). The background also registers this script on
  // sites granted later from the settings page.
  matches: [...KNOWN_SITE_MATCHES],
  cssInjectionMode: "ui",

  async main(ctx) {
    // WS-1 (a): off the school's WS-03 list nothing appears and nothing on the page is read.
    const access = await requestSiteAccess(location.href);
    if (!access) return;
    loadNemuFont();
    const ui = await createShadowRootUi(ctx, {
      name: "nemu-overlay",
      position: "inline",
      anchor: "body",
      // Keys typed into the type box must not trigger the page's own shortcuts.
      isolateEvents: ["keydown", "keyup", "keypress"],
      onMount(container) {
        const root = ReactDOM.createRoot(container);
        root.render(<NemuApp access={access} />);
        return root;
      },
      onRemove(root) {
        root?.unmount();
      },
    });
    ui.mount();
  },
});
