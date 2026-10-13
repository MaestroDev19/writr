import ReactMarkdown, {
  defaultUrlTransform,
  type Components,
} from "react-markdown"
import remarkBreaks from "remark-breaks"
import remarkGfm from "remark-gfm"

import { cn } from "@/lib/utils"

/** Drop a single outer fence so a whole answer is not shown as one code block. */
function unwrapOuterFence(source: string): string {
  const trimmed = source.trim()
  const match = trimmed.match(
    /^```[a-zA-Z0-9_-]*[ \t]*\r?\n([\s\S]*?)\r?\n?```[ \t]*$/
  )
  return match?.[1]?.trim() ? match[1].trim() : trimmed
}

function safeUrl(url: string): string {
  const safe = defaultUrlTransform(url)
  if (/^(https?:|mailto:)/i.test(safe)) return safe
  return ""
}

const components: Components = {
  h1: ({ children }) => (
    <h2 className="text-[1.15em] font-bold tracking-tight">{children}</h2>
  ),
  h2: ({ children }) => (
    <h3 className="text-[1.05em] font-bold tracking-tight">{children}</h3>
  ),
  h3: ({ children }) => <h4 className="font-semibold">{children}</h4>,
  h4: ({ children }) => <h4 className="font-semibold">{children}</h4>,
  h5: ({ children }) => <h5 className="font-semibold">{children}</h5>,
  h6: ({ children }) => <h6 className="font-semibold">{children}</h6>,
  p: ({ children }) => <p>{children}</p>,
  ul: ({ children }) => (
    <ul className="list-disc space-y-1 pl-5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal space-y-1 pl-5">{children}</ol>
  ),
  li: ({ children }) => <li>{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  a: ({ href, children }) =>
    href ? (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-2"
      >
        {children}
      </a>
    ) : (
      <span>{children}</span>
    ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-current/20 pl-3">
      {children}
    </blockquote>
  ),
  pre: ({ children }) => (
    <pre className="overflow-x-auto rounded-[var(--radius)] bg-muted/70 p-3 font-mono text-[0.85em] leading-relaxed">
      {children}
    </pre>
  ),
  code: ({ children }) => (
    <code className="font-mono text-[0.9em]">{children}</code>
  ),
  hr: () => <hr className="border-border" />,
  table: ({ children }) => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-border px-2 py-1 font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-border/60 px-2 py-1 align-top">
      {children}
    </td>
  ),
  img: ({ alt }) => (alt ? <span>{alt}</span> : null),
}

export function MarkdownText({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  const source = unwrapOuterFence(text)
  if (!source) return null

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-2 leading-relaxed [&_:not(pre)>code]:rounded-[var(--radius-sm)] [&_:not(pre)>code]:bg-muted [&_:not(pre)>code]:px-1 [&_:not(pre)>code]:py-0.5 [&_li>p]:inline",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        skipHtml
        urlTransform={safeUrl}
        components={components}
      >
        {source}
      </ReactMarkdown>
    </div>
  )
}
