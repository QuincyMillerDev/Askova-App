"use client";

import React, { useState } from "react";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetClose,
  SheetDescription,
} from "./ui/sheet";
import { Button } from "./ui/button";
import { Menu } from "lucide-react";
import { cn } from "~/lib/utils";
import { DialogTitle } from "@radix-ui/react-dialog";
import { FileUploadModal } from "~/app/_components/file-upload-modal";
import {useSidebar} from "~/app/contexts/sidebar-context";

interface SidebarProps {
  isCollapsed?: boolean;
}

interface ContentProps {
  isCollapsed?: boolean;
  toggleSidebar?: () => void;
}

interface QuizLayoutProps {
  sidebar: React.ReactElement<SidebarProps>;
  content: React.ReactElement<ContentProps>;
}

export function QuizLayout({ sidebar, content }: QuizLayoutProps) {
  const { isCollapsed, toggleSidebar } = useSidebar();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isFileUploadModalOpen, setIsFileUploadModalOpen] = useState(false);

  const handleCloseFileUploadModal = () => {
    setIsFileUploadModalOpen(false);
  };

  return (
      <div className="flex h-screen w-full overflow-hidden">
        {/* Desktop Sidebar */}
        <div
            className={cn(
                "hidden md:flex h-full border-r flex-shrink-0 transition-all duration-300 bg-sidebar relative",
                isCollapsed ? "w-0" : "w-64"
            )}
        >
          <div className="h-full flex flex-col w-full overflow-hidden">
            {React.cloneElement(sidebar, { isCollapsed })}
          </div>
        </div>

        {/* Mobile Sidebar */}
        <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
          <SheetTrigger asChild className="md:hidden absolute top-3 left-3 z-30">
            <Button variant="ghost" size="icon">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>

          <SheetContent side="left" className="p-0 transition-transform duration-300">
            <div className="h-full overflow-y-auto">
              <DialogTitle className="sr-only">Sidebar</DialogTitle>
              <SheetDescription className="sr-only">
                This is the sidebar containing navigation options.
              </SheetDescription>
              <SheetClose asChild />
              {React.cloneElement(sidebar, { isCollapsed: false })}
            </div>
          </SheetContent>
        </Sheet>

        {/* Main Content */}
        <div className="flex-1 flex flex-col relative">
          {React.cloneElement(content, { isCollapsed, toggleSidebar })}
          <FileUploadModal
              open={isFileUploadModalOpen}
              onClose={handleCloseFileUploadModal}
          />
        </div>
      </div>
  );
}
