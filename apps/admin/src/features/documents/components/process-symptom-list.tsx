import { Badge } from "@nemu/ui/components/badge";
import { Button } from "@nemu/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nemu/ui/components/select";
import { useState } from "react";

import ProcessElementForm from "@/features/documents/components/process-element-form";
import type { ProcessElement } from "@/features/documents/types/process";

/**
 * "Gejala yang dikenali Nemu · bisa dikoreksi" (F3-11, F2-08): what a teacher or parent sees at
 * each BPMN element, the element Nemu traces it to, and who at school can help. "ubah" corrects
 * one in place; an element without symptoms gets them through "Tambah gejala".
 */
export default function ProcessSymptomList({
  documentId,
  elements,
}: {
  documentId: string;
  elements: ProcessElement[];
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const withSymptoms = elements.filter((element) => element.symptoms.length);
  const without = elements.filter((element) => !element.symptoms.length);
  const adding = without.find((element) => element.elementId === editing);
  const done = () => setEditing(null);

  return (
    <div className="grid gap-3">
      {!withSymptoms.length && (
        <p className="text-muted-foreground">
          Belum ada gejala. Tanpa gejala, Nemu tidak bisa menelusuri alur ini saat guru bertanya.
        </p>
      )}
      <ul className="grid gap-3">
        {withSymptoms.map((element) => (
          <li key={element.elementId}>
            {editing === element.elementId ? (
              <ProcessElementForm documentId={documentId} element={element} onDone={done} />
            ) : (
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  {element.symptoms.map((symptom) => (
                    <div key={symptom} className="font-medium">
                      "{sentenceCase(symptom)}"
                    </div>
                  ))}
                  <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                    {kindLabel(element)}: {element.name}
                    {element.role && <Badge variant="outline">{element.role}</Badge>}
                  </div>
                </div>
                <Button
                  variant="link"
                  size="sm"
                  aria-label={`Ubah gejala ${element.name}`}
                  onClick={() => setEditing(element.elementId)}
                >
                  ubah
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {adding ? (
        <ProcessElementForm documentId={documentId} element={adding} onDone={done} />
      ) : (
        without.length > 0 && (
          <Select
            items={without.map((element) => ({
              value: element.elementId,
              label: `${kindLabel(element)}: ${element.name}`,
            }))}
            value={null}
            onValueChange={(value) => setEditing(value)}
          >
            <SelectTrigger aria-label="Tambah gejala" className="w-fit">
              <SelectValue placeholder="Tambah gejala ke…" />
            </SelectTrigger>
            <SelectContent>
              {without.map((element) => (
                <SelectItem key={element.elementId} value={element.elementId}>
                  {kindLabel(element)}: {element.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      )}
    </div>
  );
}

function kindLabel(element: Pick<ProcessElement, "kind">): string {
  if (element.kind === "task") return "Task";
  if (element.kind === "end") return "Akhir";
  return "Peristiwa";
}

function sentenceCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
