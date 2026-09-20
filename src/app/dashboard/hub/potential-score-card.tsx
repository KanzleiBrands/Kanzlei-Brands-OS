import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { GrowthLever } from "@/lib/growth-levers";

export function PotentialScoreCard({
  title,
  percent,
  unmetLevers,
  genericTips,
}: {
  title: string;
  percent: number;
  unmetLevers: GrowthLever[];
  genericTips: string[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="text-lg font-semibold tabular-nums">{percent}%</span>
        </div>

        {percent >= 100 ? (
          <p className="text-sm text-muted-foreground">
            Ihr nutzt aktuell alle uns bekannten Hebel für diese Kampagne voll aus. 🎉
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">So könnt ihr euer Potenzial weiter steigern:</p>
            <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
              {unmetLevers.map((lever) => (
                <li key={lever.id} className="flex gap-2">
                  <span aria-hidden>•</span>
                  <span>{lever.suggestion}</span>
                </li>
              ))}
              {genericTips.map((tip) => (
                <li key={tip} className="flex gap-2">
                  <span aria-hidden>•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground">
              Am besten besprichst du das mit deinem Account Manager.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
