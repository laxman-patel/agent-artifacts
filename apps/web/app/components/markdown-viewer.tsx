"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";

const markdownSanitizeSchema = {
  ...defaultSchema,
  clobberPrefix: "user-content-"
};

export function MarkdownViewer({ content }: { content: string }) {
  return (
    <div className="prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, markdownSanitizeSchema]]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
