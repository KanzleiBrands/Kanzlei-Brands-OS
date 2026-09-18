import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardDescription, CardTitle } from "@/components/ui/card";
import { ActivateForm } from "./activate-form";

export default async function ActivatePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const user = await prisma.user.findUnique({ where: { activationToken: token } });
  const isValid = !!user && !!user.activationTokenExpiresAt && user.activationTokenExpiresAt > new Date();

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/3 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[24rem] w-[24rem] translate-x-1/3 translate-y-1/3 rounded-full bg-primary/10 blur-3xl" />

      <Card className="relative w-full max-w-sm shadow-2xl shadow-black/40">
        <CardHeader className="flex flex-col items-center gap-3 pt-8 text-center">
          <Image src="/brand/logo-on-dark.svg" alt="Kanzlei Brands" width={180} height={72} priority />
          {isValid ? (
            <>
              <CardTitle className="text-lg">Willkommen, {user!.name}</CardTitle>
              <CardDescription className="text-base">Lege dein Passwort fest, um deinen Zugang zu aktivieren.</CardDescription>
            </>
          ) : (
            <CardDescription className="text-base">
              Dieser Aktivierungslink ist ungültig oder abgelaufen.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="pb-8 pt-2">
          {isValid ? (
            <ActivateForm token={token} />
          ) : (
            <p className="text-center text-sm text-muted-foreground">
              Bitte einen neuen Aktivierungslink von deinem Admin anfordern, oder{" "}
              <Link href="/login" className="underline">
                zum Login
              </Link>
              .
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
