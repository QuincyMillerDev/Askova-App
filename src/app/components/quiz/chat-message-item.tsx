"use client"
import { cn } from "~/lib/utils"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import type { ChatMessage } from "~/db/dexie"
import { format } from "date-fns"
import { Copy, Check } from "lucide-react"
import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "../ui/button"

interface ChatMessageItemProps {
    message: ChatMessage
}

export function ChatMessageItem({ message }: ChatMessageItemProps) {
    const formattedTime = format(message.createdAt, "h:mm a")
    const [isHovering, setIsHovering] = useState(false)
    const [isCopied, setIsCopied] = useState(false)

    // Make the function async to use await
    const copyToClipboard = async () => {
        try {
            // Await the promise and handle potential errors
            await navigator.clipboard.writeText(message.content || "")
            setIsCopied(true)
            setTimeout(() => setIsCopied(false), 2000)
        } catch (err) {
            console.error("Failed to copy text: ", err)
            // Optionally, provide user feedback about the copy failure
        }
    }

    return (
        <div className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
            <div
                className="flex flex-col max-w-[85%] relative group"
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
            >
                <div
                    className={cn(
                        "rounded-lg p-3 md:p-4",
                        message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-transparent border border-border/30 text-foreground",
                        "shadow-sm",
                        message.status === "waiting" && "opacity-70 italic",
                        message.status === "streaming" && "opacity-90",
                        message.status === "error" && "bg-destructive/20 text-destructive border border-destructive",
                    )}
                    style={{ overflowWrap: "break-word" }}
                >
                    <MessageContent content={message.content || ""} status={message.status} role={message.role} />

                    {(isHovering || isCopied) &&
                        message.content &&
                        message.status !== "waiting" &&
                        message.status !== "streaming" && (
                            <Button
                                size="icon"
                                variant="ghost"
                                className={cn(
                                    "absolute -top-2 -right-2 h-8 w-8 rounded-full bg-background/80 shadow-sm",
                                    message.role === "user" ? "text-primary-foreground" : "text-foreground",
                                )}
                                onClick={copyToClipboard}
                                aria-label="Copy message"
                            >
                                {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            </Button>
                        )}
                </div>
                <span className="text-xs text-muted-foreground mt-1 px-1">{formattedTime}</span>
            </div>
        </div>
    )
}

interface MessageContentProps {
    content: string
    status: ChatMessage["status"]
    role: ChatMessage["role"]
}

function MessageContent({ content, status, role }: MessageContentProps) {
    return (
        <>
            <div className="text-base leading-relaxed">
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                        p: ({ node: _node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                        ul: ({ node: _node, ...props }) => <ul className="list-disc pl-6 mb-2" {...props} />,
                        ol: ({ node: _node, ...props }) => <ol className="list-decimal pl-6 mb-2" {...props} />,
                        li: ({ node: _node, ...props }) => <li className="mb-1" {...props} />,
                        h1: ({ node: _node, ...props }) => <h1 className="text-xl font-bold mb-2" {...props} />,
                        h2: ({ node: _node, ...props }) => <h2 className="text-lg font-bold mb-2" {...props} />,
                        h3: ({ node: _node, ...props }) => <h3 className="text-base font-bold mb-2" {...props} />,
                        code: ({ node: _node, ...props }) => {
                            const codeProps = props as React.HTMLProps<HTMLElement> & { inline?: boolean }

                            return codeProps.inline ? (
                                <code className="px-1 py-0.5 rounded bg-muted/50 text-sm font-mono" {...props} />
                            ) : (
                                <code className="block p-2 rounded bg-muted/50 text-sm font-mono my-2 overflow-x-auto" {...props} />
                            )
                        },
                        pre: ({ node: _node, ...props }) => <pre className="my-2 overflow-x-auto" {...props} />,
                        a: ({ node: _node, ...props }) => <a className="text-primary underline" {...props} />,
                        blockquote: ({ node: _node, ...props }) => (
                            <blockquote className="border-l-4 border-muted pl-4 italic my-2" {...props} />
                        ),
                    }}
                >
                    {content}
                </ReactMarkdown>
            </div>
            {status === "error" && role === "model" && (
                <p className="text-xs mt-1 text-destructive/80">
                    Error:{" "}
                    {content.startsWith("LLM Error:") ||
                    content.startsWith("Failed to initiate") ||
                    content.startsWith("Unknown streaming error") ||
                    content.startsWith("Stream cancelled by user.")
                        ? content
                        : "An error occurred."}
                </p>
            )}
        </>
    )
}
