"use client";

import { AlertCircle } from "lucide-react";
import { memo, useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import type { Citation } from "@/backend/chat/prompt";
import { CitationChip } from "@/frontend/components/chat/citation-chip";
import { citationNumberFromHref, linkCitations } from "@/frontend/lib/citations";
import { cn } from "@/frontend/lib/utils";

export type UiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  status: "streaming" | "done" | "error";
  error?: string;
};

const MARKDOWN_STYLES =
  "text-sm leading-relaxed [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_h1]:mt-3 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mt-3 [&_h2]:font-semibold [&_h3]:mt-2 [&_h3]:font-semibold [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_td]:border [&_td]:px-2 [&_td]:py-1 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground";

export const ChatMessage = memo(function ChatMessage({
  message,
  onOpenCitation,
}: {
  message: UiMessage;
  onOpenCitation?: (citation: Citation) => void;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm whitespace-pre-wrap text-primary-foreground">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2" data-testid="assistant-message">
      {message.content ? (
        <AssistantMarkdown content={message.content} citations={message.citations} onOpenCitation={onOpenCitation} />
      ) : message.status === "streaming" ? (
        <p className="animate-pulse text-sm text-muted-foreground">Durchsucht die Quellen …</p>
      ) : null}
      {message.status === "error" ? (
        <p role="alert" className="flex items-center gap-1.5 text-sm text-destructive">
          <AlertCircle className="size-4" />
          {message.error}
        </p>
      ) : null}
    </div>
  );
});

function AssistantMarkdown({
  content,
  citations,
  onOpenCitation,
}: {
  content: string;
  citations: Citation[];
  onOpenCitation?: (citation: Citation) => void;
}) {
  const byNumber = useMemo(() => new Map(citations.map((c) => [c.n, c])), [citations]);
  const markdown = useMemo(() => linkCitations(content, new Set(byNumber.keys())), [content, byNumber]);

  const components = useMemo<Components>(
    () => ({
      a({ href, children }) {
        const n = citationNumberFromHref(href);
        const citation = n == null ? undefined : byNumber.get(n);
        if (citation) return <CitationChip citation={citation} onOpen={onOpenCitation} />;
        if (!href || !/^https?:\/\//.test(href)) return <span>{children}</span>;
        return (
          <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
            {children}
          </a>
        );
      },
    }),
    [byNumber, onOpenCitation],
  );

  return (
    <div className={cn(MARKDOWN_STYLES)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
