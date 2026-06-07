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
  description: "වර්තමාන ඩිජිටල් ලෝකය තුළ බුදු දහම සම්බන්ධ යූටියුබ් වීඩියෝ සහ පී.ඩී.එෆ් පොත්පත් බහුලව පැවතිය ද, කාර්යබහුල ධර්මකාමී ඔබට ඒවා ශ්‍රවණය කිරීමට පහසු Audio Podcasts සහ කියවීමට පහසු Ebooks ලෙස EchoDhamma මඟින් ලබාදේ.",
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

