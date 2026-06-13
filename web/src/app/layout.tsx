import type { Metadata } from "next";
import AudioPlayerProvider from "@/components/AudioPlayerProvider";
import LayoutClientWrapper from "@/components/LayoutClientWrapper";
import UmamiTracker from "@/components/UmamiTracker";
import { getTheros } from "@/utils/theros.server";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL('https://damsak.org'),
  title: "DamSak.org - නිර්මල ශ්‍රී සද්ධර්ම ප්‍රතිධ්වනිය",
  description: "වර්තමාන ඩිජිටල් ලෝකය තුළ බුදු දහම සම්බන්ධ යූටියුබ් වීඩියෝ සහ පී.ඩී.එෆ් පොත්පත් බහුලව පැවතිය ද, කාර්යබහුල ධර්මකාමී ඔබට ඒවා ශ්‍රවණය කිරීමට පහසු Audio Podcasts සහ කියවීමට පහසු Ebooks ලෙස DamSak.org මඟින් ලබාදේ.",
  keywords: ["DamSak.org", "DamSak", "Buddhism", "Dhamma", "Sutta", "Theravada", "Podcast", "Ebook", "Sinhala Dhamma Deshana", "බුදු දහම", "ධර්ම දේශනා"],
  icons: {
    icon: "/logo-icon.png",
    apple: "/logo-icon.png",
  },
  openGraph: {
    title: "DamSak.org",
    description: "වර්තමාන ඩිජිටල් ලෝකය තුළ බුදු දහම සම්බන්ධ යූටියුබ් වීඩියෝ සහ පී.ඩී.එෆ් පොත්පත් බහුලව පැවතිය ද, කාර්යබහුල ධර්මකාමී ඔබට ඒවා ශ්‍රවණය කිරීමට පහසු Audio Podcasts සහ කියවීමට පහසු Ebooks ලෙස DamSak.org මඟින් ලබාදේ.",
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
    <html lang="si">
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

