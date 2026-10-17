import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@nemu/ui/components/card";
import { FieldGroup } from "@nemu/ui/components/field";
import type { ReactNode } from "react";

export default function PerdinFormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <FieldGroup>{children}</FieldGroup>
      </CardContent>
    </Card>
  );
}
