import "~/styles/globals.css";

import { GeistSans } from "geist/font/sans";
import { type Metadata } from "next";

import { TRPCReactProvider } from "~/trpc/react";
import {SessionProvider} from "next-auth/react";
import {DexieClearer} from "~/app/_components/dexie-clearer";

export const metadata: Metadata = {
  title: "Askova",
  description: "Learn more effectively with AI-generated study questions",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable}`}>
      <body>
        <SessionProvider>
            <TRPCReactProvider>
                <DexieClearer />
                {children}
            </TRPCReactProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
