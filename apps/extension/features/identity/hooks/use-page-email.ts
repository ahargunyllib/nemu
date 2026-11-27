import { useEffect, useState } from "react";

import type { PageEmail } from "../../../shared/lib/messages";
import { readPageEmail, samePageEmail } from "../lib/page-email-readers";

/** Lets a page settle after a render before its account area is read again. */
const SETTLE_MS = 200;

/**
 * The page's signed-in email, read again whenever the page changes, so signing in, out, or as
 * someone else switches who Nemu helps (ID-04).
 */
export function usePageEmail(): PageEmail {
  const [pageEmail, setPageEmail] = useState(() => readPageEmail(location.href, document));

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reread = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const next = readPageEmail(location.href, document);
        setPageEmail((current) => (samePageEmail(current, next) ? current : next));
      }, SETTLE_MS);
    };
    const observer = new MutationObserver(reread);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class", "hidden"],
    });
    window.addEventListener("hashchange", reread);
    window.addEventListener("popstate", reread);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener("hashchange", reread);
      window.removeEventListener("popstate", reread);
    };
  }, []);

  return pageEmail;
}
