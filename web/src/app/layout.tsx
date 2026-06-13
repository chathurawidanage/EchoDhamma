import type { Metadata } from "next";
import AudioPlayerProvider from "@/components/AudioPlayerProvider";
import LayoutClientWrapper from "@/components/LayoutClientWrapper";
import UmamiTracker from "@/components/UmamiTracker";
import { getTheros } from "@/utils/theros.server";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL('https://damsak.org'),
  title: "DamSak.org - නිර්මල ශ්‍රී සද්ධර්ම ප්‍රතිධ්වනිය",
  description: "DamSak.org - නිර්මල ශ්‍රී සද්ධර්ම ප්‍රතිධ්වනිය. කාර්යබහුල ජීවිතයට ගැලපෙන පරිදි උසස් ප්‍රමිතියේ ධර්ම දේශනා Audio Podcasts ලෙස ශ්‍රවණය කරන්න සහ කියවීමට පහසු EPUB ඊ-පොත් (Ebooks) ක්‍රමවත්ව පරිශීලනය කරන්න.",
  keywords: ["DamSak.org", "DamSak", "Buddhism", "Dhamma", "Sutta", "Theravada", "Podcast", "Ebook", "Sinhala Dhamma Deshana", "බුදු දහම", "ධර්ම දේශනා"],
  icons: {
    icon: "/logo-icon.png",
    apple: "/logo-icon.png",
  },
  openGraph: {
    title: "DamSak.org",
    description: "DamSak.org - නිර්මල ශ්‍රී සද්ධර්ම ප්‍රතිධ්වනිය. කාර්යබහුල ජීවිතයට ගැලපෙන පරිදි උසස් ප්‍රමිතියේ ධර්ම දේශනා Audio Podcasts ලෙස ශ්‍රවණය කරන්න සහ කියවීමට පහසු EPUB ඊ-පොත් (Ebooks) ක්‍රමවත්ව පරිශීලනය කරන්න.",
    url: "https://damsak.org",
    siteName: "DamSak.org",
    images: [
      {
        url: "/logo-full.png",
        width: 1200,
        height: 630,
        alt: "DamSak.org Logo",
      },
    ],
    locale: "si_LK",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const theros = getTheros();

  return (
    <html lang="si" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var savedTheme = localStorage.getItem('theme');
                  if (savedTheme === 'light' || (!savedTheme && window.matchMedia('(prefers-color-scheme: light)').matches)) {
                    document.documentElement.classList.add('light-theme');
                  }
                } catch (e) {}
              })();
            `
          }}
        />
      </head>
      <body>
        <UmamiTracker />
        <AudioPlayerProvider>
          <LayoutClientWrapper theros={theros}>
            {children}
          </LayoutClientWrapper>
        </AudioPlayerProvider>
      </body>
    </html>
  );
}

