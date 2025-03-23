// src/types/User.ts
import type { Quiz } from "./Quiz";

export interface User {
    id: string;
    name?: string;
    email?: string;
    image?: string;
    quizzes?: Quiz[];
}
