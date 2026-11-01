import type { Metadata } from "next";
import "./globals.css";
import "katex/dist/katex.min.css";
import "@fontsource/geist/400.css";
import "@fontsource/geist/500.css";
import "@fontsource/geist/600.css";
import "@fontsource/geist/700.css";
import "@fontsource/geist/800.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
export const metadata:Metadata={title:{default:'Coderise — Deliberate practice',template:'%s — Coderise'},description:'Find your next Codeforces problem. Understand your practice. Keep moving.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><a className="skip-link" href="#main">Skip to content</a>{children}</body></html>;}
