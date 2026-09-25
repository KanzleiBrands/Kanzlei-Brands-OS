import { ClockIcon, PhoneIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OFFICE_PHONE, OFFICE_PHONE_LABEL } from "./contact-card";

export function OfficeHoursCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Erreichbarkeit</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">Telefonisch erreichst du uns zu folgenden Zeiten:</p>
        <div className="flex items-center gap-3">
          <ClockIcon className="size-5 flex-shrink-0 text-muted-foreground" />
          <div>
            <p className="font-medium">Montag - Freitag</p>
            <p className="text-sm text-muted-foreground">08:30 - 16:30 Uhr</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="w-fit" nativeButton={false} render={<a href={`tel:${OFFICE_PHONE}`} />}>
          <PhoneIcon className="size-3.5" />
          Zentrale: {OFFICE_PHONE_LABEL}
        </Button>
      </CardContent>
    </Card>
  );
}
