import Image from "next/image";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <Image
            src="/brand/logo-on-dark.svg"
            alt="Kanzlei Brands"
            width={160}
            height={64}
            className="mb-2"
            priority
          />
          <CardDescription>Melde dich mit deinem Zugang an.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  );
}
