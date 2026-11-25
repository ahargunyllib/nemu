import { z } from "zod";

import { schoolProcedure } from "../../index";

const MAX_AUDIO_BASE64 = 4 * 1024 * 1024;

export const speechRouter = {
  /** F0-04: 16 kHz mono audio (≤ 15 s) → the text Nemu heard, shown in the bubble. */
  speechTranscribe: schoolProcedure
    .input(
      z.object({
        audioBase64: z.string().min(1).max(MAX_AUDIO_BASE64),
        format: z.enum(["wav", "webm", "ogg", "mp3", "m4a", "flac"]),
      }),
    )
    .handler(({ context, input }) =>
      context.school.ai.transcribe({ base64: input.audioBase64, format: input.format }),
    ),

  /**
   * F0-05: the bubble sentence as audio with word timings. `audioBase64` is "" when no TTS model is
   * configured: speak `text` with the local OS voice and use `words` for the highlight.
   */
  speechSynthesize: schoolProcedure
    .input(z.object({ text: z.string().trim().min(1).max(300) }))
    .handler(({ context, input }) => context.school.ai.synthesize(input.text)),
};
