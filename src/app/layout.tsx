import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/lib/auth-context";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Workia",
  description: "Tu asistente académico inteligente",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Workia",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#09090b",
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="min-h-screen bg-background">
        <AuthProvider>
          <main className="mx-auto max-w-lg min-h-screen">
            {children}
          </main>
          <Toaster
            position="top-center"
            toastOptions={{
              style: {
                background: "hsl(0 0% 10%)",
                border: "1px solid hsl(0 0% 18%)",
                color: "hsl(0 0% 98%)",
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
