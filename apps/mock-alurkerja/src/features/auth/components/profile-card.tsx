import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@nemu/ui/components/card";

import { ROLE_LABELS } from "@/features/auth/lib/demo-accounts";

type Profile = {
  name: string;
  golongan?: string | null;
  role?: string | null;
  unit?: string | null;
  workspaceId?: string | null;
};

export default function ProfileCard({ user }: { user: Profile }) {
  const role = ROLE_LABELS[user.role ?? ""] ?? "Pegawai";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Selamat datang, {user.name}</CardTitle>
        <CardDescription>
          {role}
          {user.golongan ? ` · Golongan ${user.golongan}` : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-muted-foreground">
        {user.workspaceId === "W-TELKO"
          ? `Kelola klaim SLA dan data pendukung${user.unit ? ` untuk ${user.unit}` : ""}.`
          : "Pilih menu di samping untuk mengajukan Perjalanan Dinas atau melanjutkan tugas Anda."}
      </CardContent>
    </Card>
  );
}
