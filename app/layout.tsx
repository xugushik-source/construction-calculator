import type {Metadata} from "next";import "./globals.css";
export const metadata:Metadata={title:"BuildEstimate | Contractor estimating",description:"Estimate costs, protect profit, and send professional proposals.",other:{"codex-preview":"development"}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
