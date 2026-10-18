import { Card, CardContent, CardFooter } from "@nemu/ui/components/card";
import { NemuButton } from "@nemu/ui/nemu/nemu-button";

import { AnswerCardKickerContext } from "../contexts/answer-card-kicker";
import { CARD_BODY, CARD_TITLE } from "../lib/typography";

type ChatNoticeCardProps = {
  header: React.ReactNode;
  /** Berhasil: green mascot and a muted meta line. Peringatan: red mascot and a way forward. */
  tone: "success" | "warning";
  /** The kicker row's label, such as "Berhasil" or "Tidak ditemukan". */
  kicker: string;
  title: string;
  description: string;
  /** Adds a "Tutup" link to the footer. */
  onClose?: () => void;
  /** The way forward, such as "Coba lagi". */
  children?: React.ReactNode;
};

/** A card the Answer Card shows instead of an answer: done, not logged in, or the request failed. */
export function ChatNoticeCard({
  header,
  tone,
  kicker,
  title,
  description,
  onClose,
  children,
}: ChatNoticeCardProps) {
  const success = tone === "success";

  return (
    <Card size="sm" role={success ? "status" : "alert"} className={`shadow-lg ${CARD_BODY}`}>
      <AnswerCardKickerContext
        value={
          success
            ? { label: kicker, tone: "success", mascot: "success" }
            : { label: kicker, tone: "danger", mascot: "warning" }
        }
      >
        {header}
        <CardContent className="flex flex-col gap-1">
          <p className={CARD_TITLE}>{title}</p>
          <p className={success ? "text-muted-foreground" : undefined}>{description}</p>
        </CardContent>
        {(children || onClose) && (
          <CardFooter className="gap-3">
            {children}
            {onClose && (
              <NemuButton tone="link" size="sm" className="text-[13px]/[16px]" onClick={onClose}>
                Tutup
              </NemuButton>
            )}
          </CardFooter>
        )}
      </AnswerCardKickerContext>
    </Card>
  );
}

export function LoginRequiredCard({
  header,
  loginUrl,
  onClose,
}: {
  header: React.ReactNode;
  loginUrl: string;
  onClose: () => void;
}) {
  return (
    <ChatNoticeCard
      header={header}
      tone="warning"
      kicker="Belum masuk"
      title="Kamu belum masuk ke Demo App"
      description="Nemu memakai akun Demo App-mu. Masuk dulu, lalu buka Nemu lagi."
      onClose={onClose}
    >
      <NemuButton tone="outline" size="sm" render={<a href={loginUrl} />} nativeButton={false}>
        Masuk ke Demo App
      </NemuButton>
    </ChatNoticeCard>
  );
}

export function ChatErrorCard({
  header,
  message,
  onRetry,
  onClose,
}: {
  header: React.ReactNode;
  message: string;
  onRetry: () => void;
  onClose: () => void;
}) {
  return (
    <ChatNoticeCard
      header={header}
      tone="warning"
      kicker="Gagal"
      title="Pertanyaan belum terjawab"
      description={message}
      onClose={onClose}
    >
      <NemuButton tone="outline" size="sm" onClick={onRetry}>
        Coba lagi
      </NemuButton>
    </ChatNoticeCard>
  );
}
