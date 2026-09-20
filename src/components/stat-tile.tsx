import { Card, CardContent } from "@/components/ui/card";

export function StatTile({ label, value, subtext }: { label: string; value: number | string; subtext: string }) {
  return (
    <Card>
      <CardContent>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-3xl font-semibold">{value}</p>
        <p className="mt-1 text-sm text-muted-foreground">{subtext}</p>
      </CardContent>
    </Card>
  );
}
