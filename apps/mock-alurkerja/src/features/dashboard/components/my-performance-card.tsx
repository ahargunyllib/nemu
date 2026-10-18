import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@nemu/ui/components/card";

import { MY_PERFORMANCE } from "@/features/dashboard/lib/my-performance";

export default function MyPerformanceCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>My Performance</CardTitle>
        <CardAction className="text-sm text-muted-foreground">{MY_PERFORMANCE.range}</CardAction>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-4">
          {MY_PERFORMANCE.stats.map((stat) => (
            <div key={stat.label} className="grid min-w-0 gap-1 rounded-2xl bg-muted/60 p-3">
              <dt className="text-xs text-muted-foreground">{stat.label}</dt>
              <dd className="grid">
                <span className="font-medium wrap-break-word">{stat.value}</span>
                <span className="text-xs text-muted-foreground">{stat.detail}</span>
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
