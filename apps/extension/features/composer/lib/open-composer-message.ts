/** Tells the content script on a tab to open the Composer at the last cursor position. */
export type OpenComposerMessage = { type: "nemu:open-composer" };

export const OPEN_COMPOSER_MESSAGE: OpenComposerMessage = { type: "nemu:open-composer" };

export function isOpenComposerMessage(message: unknown): message is OpenComposerMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === "nemu:open-composer"
  );
}
