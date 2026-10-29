import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@nemu/ui/components/card";
import { createFileRoute, redirect } from "@tanstack/react-router";

import { ensureSession } from "@/features/auth/api/session";
import DemoAccountButtons from "@/features/auth/components/demo-account-buttons";
import SignInForm from "@/features/auth/components/sign-in-form";

export const Route = createFileRoute("/login")({
  component: RouteComponent,
  beforeLoad: async ({ context }) => {
    if (await ensureSession(context.queryClient)) {
      throw redirect({ to: "/" });
    }
  },
});

function RouteComponent() {
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Masuk</CardTitle>
          <CardDescription>Alur Kerja Demo</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <SignInForm />
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs">Akun demo</p>
            <DemoAccountButtons />
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
