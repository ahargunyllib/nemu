import { Button } from "@nemu/ui/components/button";
import { Card, CardContent, CardFooter } from "@nemu/ui/components/card";

type ChatNoticeCardProps = {
  header: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
};

/** A failure the Answer Card shows instead of an answer: not logged in, or the request failed. */
export function ChatNoticeCard({ header, title, description, children }: ChatNoticeCardProps) {
  return (
    <Card size="sm" role="alert" className="shadow-lg">
      {header}
      <CardContent className="flex flex-col gap-1">
        <p className="font-medium text-destructive">{title}</p>
        <p>{description}</p>
      </CardContent>
      <CardFooter className="gap-2">{children}</CardFooter>
    </Card>
  );
}

export function LoginRequiredCard({
  header,
  loginUrl,
}: {
  header: React.ReactNode;
  loginUrl: string;
}) {
  return (
    <ChatNoticeCard
      header={header}
      title="Kamu belum masuk ke Demo App"
      description="Nemu memakai akun Demo App-mu. Masuk dulu, lalu tekan Ctrl+Shift+Space lagi."
    >
      <Button size="sm" render={<a href={loginUrl} />} nativeButton={false}>
        Masuk ke Demo App
      </Button>
    </ChatNoticeCard>
  );
}

export function ChatErrorCard({
  header,
  message,
  onRetry,
}: {
  header: React.ReactNode;
  message: string;
  onRetry: () => void;
}) {
  return (
    <ChatNoticeCard header={header} title="Pertanyaan belum terjawab" description={message}>
      <Button size="sm" variant="outline" onClick={onRetry}>
        Coba lagi
      </Button>
    </ChatNoticeCard>
  );
}
