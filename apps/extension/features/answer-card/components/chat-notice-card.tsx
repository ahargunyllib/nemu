import { asSentence } from "../lib/sentence";
import { AnswerCardFrame } from "./answer-card-frame";
import { TextLink } from "./text-link";

type ChatNoticeCardProps = {
  header: React.ReactNode;
  /** What happened, as plain text. */
  message: React.ReactNode;
  /** The way forward as a text link, such as "Coba lagi". */
  children?: React.ReactNode;
};

/** A card the Answer Card shows instead of an answer: not logged in, or the request failed. */
export function ChatNoticeCard({ header, message, children }: ChatNoticeCardProps) {
  return (
    <AnswerCardFrame role="alert" header={header} lead={<p>{message}</p>}>
      {children && <p>{children}</p>}
    </AnswerCardFrame>
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
      message="Kamu belum masuk ke Demo App. Nemu memakai akun Demo App-mu, jadi masuk dulu, lalu buka Nemu lagi."
    >
      <TextLink render={<a href={loginUrl} />} nativeButton={false}>
        Masuk ke Demo App
      </TextLink>
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
    <ChatNoticeCard header={header} message={`Pertanyaan belum terjawab. ${asSentence(message)}`}>
      <TextLink onClick={onRetry}>Coba lagi</TextLink>
    </ChatNoticeCard>
  );
}
