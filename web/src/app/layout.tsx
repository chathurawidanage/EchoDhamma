import type { Metadata } from "next";
import Navigation from "@/components/Navigation";
import AudioPlayerProvider from "@/components/AudioPlayerProvider";
import AudioPlayer from "@/components/AudioPlayer";
import UmamiTracker from "@/components/UmamiTracker";
import { getTheros } from "@/utils/theros.server";
import { getTheroS3BaseUrl } from "@/utils/theros";
import styles from "./layout.module.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "EchoDhamma",
  description: "ථෙරවාදී බුදු දහමේ නිර්මල ඉගැන්වීම් ශ්‍රවණය කිරීමට සහ කියවීමට ඇති දහම් පෝඩ්කාස්ට් සහ පොත්පත් එකතුව.",
  keywords: ["EchoDhamma", "Buddhism", "Dhamma", "Sutta", "Theravada", "Podcast", "Ebook", "Sinhala Dhamma Deshana", "බුදු දහම", "ධර්ම දේශනා"],
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
          <div className={styles.layoutShell}>
            <Navigation theros={theros} />
            <main className={styles.contentWrapper}>
              {children}
            </main>
          </div>
          <AudioPlayer />
        </AudioPlayerProvider>
      </body>
    </html>
  );
}

