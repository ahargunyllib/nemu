# Nemu demo data

Imported on 17 October 2026 from the team Drive package linked in the PRD (package version 1.0,
16 October 2026).

- `01_knowledge_rag`: active official/synthetic Markdown plus the deliberately inactive PMK 54/2026
- `02_tabel`: SBM 2026 and the 2026 national-holiday/shared-leave calendar
- `04_evaluasi`: the official 20 questions, 6 calculation cases, 5 injection cases, and 5 out-of-domain cases

Never index `01_knowledge_rag/tidak-aktif` or anything under `04_evaluasi`. The registry is the
authority for document status. `packages/ai/scripts/generate-demo-data.mjs` turns the active source
package and structured tables into the small Worker-bundled demo dataset.

The original PMK PDFs and `03_app_demo` were not copied here: formal citations link back to the
official sources in `document_registry.json`, and the application fixtures remain in the software
engineer's lane.
