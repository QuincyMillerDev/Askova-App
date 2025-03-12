// _components/file-upload-modal.tsx
"use client";

import { useEffect, useRef } from "react";
import { X, Sparkles, Upload, FileText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Button } from "./ui/button";
import { cn } from "~/lib/utils";
import {Textarea} from "~/app/_components/ui/textarea";

interface FileUploadModalProps {
    open: boolean;
    onClose: () => void;
    className?: string;
}

export function FileUploadModal({ open, onClose, className }: FileUploadModalProps) {
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
                <div className="p-6 pt-0">
                    <div className="flex items-center mb-4">
                        <Sparkles className="h-5 w-5 mr-2 text-primary" />
                        <h2 className="text-xl font-bold">Start Your Study Session</h2>
                    </div>
                    <p className="text-muted-foreground mb-6">
                        Upload your notes or paste text to begin. The AI will create study
                        questions based on your content.
                    </p>

                    <Tabs defaultValue="paste">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="paste">Paste Text</TabsTrigger>
                            <TabsTrigger value="upload">Upload File</TabsTrigger>
                        </TabsList>

                        <TabsContent value="paste" className="space-y-4">
                            <Textarea
                                placeholder="Paste your study notes here..."
                                className="min-h-[200px]"
                                value={studyContent}
                                onChange={(e) => setStudyContent(e.target.value)}
                            />
                        </TabsContent>

                        <TabsContent value="upload" className="space-y-4">
                            <div className="border-2 border-dashed rounded-lg p-8 text-center">
                                <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
                                <p className="mb-2">Drag and drop your files here</p>
                                <p className="text-sm text-muted-foreground mb-4">
                                    Supports PDF, DOCX, and TXT files
                                </p>
                                <Button variant="outline">
                                    <FileText className="mr-2 h-4 w-4" />
                                    Browse Files
                                </Button>
                            </div>
                        </TabsContent>
                    </Tabs>

                    <div className="flex justify-end mt-6">
                        <Button onClick={handleStartStudy} disabled={!studyContent.trim()}>
                            Start Studying
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
