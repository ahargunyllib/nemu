import { NEMU_IDS } from "@nemu/contracts/nemu-ids";
import { Button } from "@nemu/ui/components/button";
import { Input } from "@nemu/ui/components/input";
import { Label } from "@nemu/ui/components/label";
import { useForm } from "@tanstack/react-form";
import z from "zod";

import { useSignIn } from "@/features/auth/hooks/use-sign-in";

export default function SignInForm() {
  const signIn = useSignIn();

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      await signIn(value.email, value.password);
    },
    validators: {
      onSubmit: z.object({
        email: z.email("Email tidak valid"),
        password: z.string().min(8, "Kata sandi minimal 8 karakter"),
      }),
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="space-y-4"
    >
      <form.Field name="email">
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor={field.name}>Email</Label>
            <Input
              id={field.name}
              name={field.name}
              type="email"
              data-nemu-id={NEMU_IDS.login.email}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
            />
            {field.state.meta.errors.map((error) => (
              <p key={error?.message} className="text-destructive text-xs">
                {error?.message}
              </p>
            ))}
          </div>
        )}
      </form.Field>

      <form.Field name="password">
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor={field.name}>Kata sandi</Label>
            <Input
              id={field.name}
              name={field.name}
              type="password"
              data-nemu-id={NEMU_IDS.login.password}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
            />
            {field.state.meta.errors.map((error) => (
              <p key={error?.message} className="text-destructive text-xs">
                {error?.message}
              </p>
            ))}
          </div>
        )}
      </form.Field>

      <form.Subscribe
        selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
      >
        {({ canSubmit, isSubmitting }) => (
          <Button
            type="submit"
            className="w-full"
            data-nemu-id={NEMU_IDS.login.submit}
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? "Memproses..." : "Masuk"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
