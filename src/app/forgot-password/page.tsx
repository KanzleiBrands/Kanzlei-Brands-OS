import Image from "next/image";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background p-4">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/3 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[24rem] w-[24rem] translate-x-1/3 translate-y-1/3 rounded-full bg-primary/10 blur-3xl" />

      <Card className="relative w-full max-w-sm shadow-2xl shadow-black/40">
        <CardHeader className="flex flex-col items-center gap-3 pt-8 text-center">
          <Image src="/brand/logo-on-dark.svg" alt="Kanzlei Brands" width={180} height={72} priority />
          <CardDescription className="text-base">
            Gib deine E-Mail-Adresse ein, wir schicken dir einen Link zum Zurücksetzen deines Passworts.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pb-8 pt-2">
          <ForgotPasswordForm />
          <Link href="/login" className="text-center text-sm text-muted-foreground underline">
            Zurück zum Login
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
