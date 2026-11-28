import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@nemu/ui/components/card";
import type { ReactNode } from "react";

/** The knowledge panel before a row is chosen. */
export default function KnowledgePanelEmpty({ children }: { children?: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Pilih satu pengetahuan</CardTitle>
        <CardDescription>
          Pilih baris di daftar untuk melihat task dan halamannya, gejala yang dikenali Nemu, atau
          langkah rekamannya.
        </CardDescription>
      </CardHeader>
      {children && <CardContent className="grid gap-6">{children}</CardContent>}
    </Card>
  );
}
