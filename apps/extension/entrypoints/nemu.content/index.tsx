import ReactDOM from "react-dom/client";

import { ALLOWED_MATCHES } from "../../shared/lib/config";
import { loadNemuFont } from "./nemu-font";
import { NemuOverlay } from "./nemu-overlay";

import "./style.css";

export default defineContentScript({
  matches: ALLOWED_MATCHES,
  cssInjectionMode: "ui",

  async main(ctx) {
    loadNemuFont();
    const ui = await createShadowRootUi(ctx, {
      name: "nemu-overlay",
      position: "inline",
      anchor: "body",
      // Keys typed into the Composer must not trigger the page's own shortcuts.
      isolateEvents: ["keydown", "keyup", "keypress"],
      onMount(container) {
        const root = ReactDOM.createRoot(container);
        root.render(<NemuOverlay />);
        return root;
      },
      onRemove(root) {
        root?.unmount();
      },
    });
    ui.mount();
  },
});
