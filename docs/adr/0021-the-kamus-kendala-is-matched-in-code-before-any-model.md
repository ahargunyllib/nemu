# The Kamus Kendala is matched in code before any model

"Nemu, ini kenapa?" (F2-02, F2-03, F2-06, F2-07) explains the error on the teacher's page from the school's Kamus Kendala (WS-05): a table whose rows give the message as the app shows it, what it means, whether it's the teacher's fault, who fixes it and how. The Nemu Extension sends a page snapshot (alerts, status texts and labels; never input values, and nothing while a password field is on screen, #216).

Code matches the snapshot's lines against each row's message in order, with "…", "*", "{…}" and "[…]" standing for the parts that vary (`matchKamus`). An exact match answers with no model call. Only when no row matches exactly does one model call see the three closest rows and pick one row id or none. Whichever row is chosen, everything the teacher reads comes from that row and the workspace contacts (`answerFromRow`): whose fault, who fixes it, why, the button and the WhatsApp text. The model never writes any of it. When no row fits, Nemu says the error isn't in the school's guide and invents nothing (F2-06).

We chose a table lookup because error messages are exact strings: matching them is fast, free and testable against the official Kamus, and the school owns both the wording and the fix. A model only helps where the page words a message slightly differently from the row.

We accept that a message the app rewords beyond the near-miss threshold is answered as not in the guide until the operator updates the row in WS-05. Offline (`NEMU_RESPONDER=fixture`) there is no model fallback, so a near miss is also not in the guide there.
