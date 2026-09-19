import type { Metadata } from "next";
import CookieBanner from '@/components/CookieBanner'
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Finveria",
  description: "Plateforme d'analyse et de suivi de portefeuille",
};

const themeScript = `(function(){
  try {
    var t = localStorage.getItem('finveria_theme');
    var html = document.documentElement;
    if (t === 'dark') {
      html.classList.add('dark');
    } else if (t === 'light') {
      html.classList.remove('dark');
    } else {
      // système — suit la préférence OS
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      html.classList.toggle('dark', mq.matches);
      mq.addEventListener('change', function(e) {
        var stored = localStorage.getItem('finveria_theme');
        if (!stored || stored === 'system') {
          document.documentElement.classList.toggle('dark', e.matches);
        }
      });
    }
  } catch(e) {}
})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">{children}<CookieBanner /></body>
    </html>
  );
}
