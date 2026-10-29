import ReactDOM from "react-dom/client";

import { OtherSitePopup } from "../../features/toolbar-popup/components/other-site-popup";
import { DEFAULT_SERVER_URL, demoAppUrl } from "../../shared/lib/config";

import "./style.css";

function openApp() {
  const serverUrl: string = import.meta.env.WXT_SERVER_URL || DEFAULT_SERVER_URL;
  void browser.tabs.create({ url: demoAppUrl(serverUrl) }).then(() => window.close());
}

// The toolbar popup, shown only on pages outside the allowlist: the background clears it on
// Demo App tabs, where the action opens the Composer instead.
const root = document.getElementById("root");
if (root) ReactDOM.createRoot(root).render(<OtherSitePopup onOpenApp={openApp} />);
