import { failureMessage } from "../../../shared/api/nemu-service";
import type { PageEmail } from "../../../shared/lib/messages";
import { teacherClient } from "../../identity/api/teacher-client";
import type { QuizImportRequest, QuizImportResponse } from "../lib/requests";

/** Background: F4-03's call to the Nemu Service (#210), which reads the script (#219). */
export async function handleQuizImport(
  request: QuizImportRequest,
  pageEmail: PageEmail,
): Promise<QuizImportResponse<QuizImportRequest["op"]>> {
  try {
    const teacher = await teacherClient(pageEmail);
    if ("notice" in teacher) return { ok: false, message: teacher.notice };
    return { ok: true, value: await teacher.client.quizScriptRead(request.input) };
  } catch (error) {
    return { ok: false, message: failureMessage(error) };
  }
}
