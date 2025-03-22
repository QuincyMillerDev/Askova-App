"use client";

import React, { useState } from "react";
import type { ChangeEvent } from "react";
import { QuizInput } from "./quiz-input";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle
} from "~/app/_components/ui/card";

export function QuizWelcome() {
    // Create a state variable to hold the quiz input
    const [inputValue, setInputValue] = useState("");

    // Update state on input change
    const handleInputChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
        setInputValue(event.target.value);
    };

    // Handle form submission
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        console.log("Submitted input:", inputValue);
        // Your submission logic here
    };

    return (
        <div className="flex items-center justify-center min-h-[80vh] w-full px-4">
            <Card className="w-full max-w-2xl shadow-lg">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-bold">
                        Welcome to Your Study Session
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <p className="text-center text-muted-foreground">
                        Get started by entering your study topic or uploading your notes
                        below.
                    </p>

                    <QuizInput
                        input={inputValue}
                        onInputChange={handleInputChange}
                        onSubmit={handleSubmit}
                        isTyping={false}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
