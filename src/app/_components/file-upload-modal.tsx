// _components/file-upload-modal.tsx
"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "~/lib/utils";

interface FileUploadModalProps {
    open: boolean;
    onClose: () => void;
    children: ReactNode;
    className?: string;
}

export function FileUploadModal({ open, onClose, children, className }: FileUploadModalProps) {
    const modalRef = useRef<HTMLDivElement>(null);

    // Close on escape key press
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && open) {
                onClose();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [open, onClose]);

    // Close when clicking outside the modal
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(e.target as Node) && open) {
                onClose();
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
            <div
                ref={modalRef}
                className={cn(
                    "bg-background rounded-lg shadow-lg w-full max-w-[600px] max-h-[90%] overflow-auto border animate-in fade-in-0 zoom-in-95",
                    className
                )}
            >
                <div className="flex justify-end p-2">
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="h-4 w-4" />
                        <span className="sr-only">Close</span>
                    </Button>
                </div>
                <div className="p-6 pt-0">{children}</div>
            </div>
        </div>
    );
}
