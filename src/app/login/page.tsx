import Image from "next/image";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ activated?: string; email_changed?: string; reset?: string }>;
}) {
  const { activated, email_changed, reset } = await searchParams;

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background p-4">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/3 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[24rem] w-[24rem] translate-x-1/3 translate-y-1/3 rounded-full bg-primary/10 blur-3xl" />

      <Card className="relative w-full max-w-sm shadow-2xl shadow-black/40">
        <CardHeader className="flex flex-col items-center gap-3 pt-8 text-center">
          <Image
            src="/brand/logo-on-dark.svg"
            alt="Kanzlei Brands"
            width={180}
            height={72}
            priority
          />
          <CardDescription className="text-base">Melde dich mit deinem Zugang an.</CardDescription>
        </CardHeader>
        <CardContent className="pb-8 pt-2">
          {activated && (
            <p className="mb-4 rounded-md bg-emerald-500/10 px-3 py-2 text-center text-sm text-emerald-500">
              Konto aktiviert. Du kannst dich jetzt anmelden.
            </p>
          )}
          {email_changed && (
            <p className="mb-4 rounded-md bg-emerald-500/10 px-3 py-2 text-center text-sm text-emerald-500">
              E-Mail-Adresse geändert. Bitte melde dich mit deiner neuen E-Mail-Adresse an.
            </p>
          )}
          {reset && (
            <p className="mb-4 rounded-md bg-emerald-500/10 px-3 py-2 text-center text-sm text-emerald-500">
              Passwort erfolgreich zurückgesetzt. Du kannst dich jetzt anmelden.
            </p>
          )}
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  );
}
