import { Metadata } from 'next';
import Link from 'next/link';
import ebooksData from '@/data/ebooks.json';
import { Ebook } from '@/types';
import EbooksClient from '@/components/EbooksClient';
import { HelpCircleIcon } from '@/components/Icons';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'දහම් පොත් එකතුව (Dhamma Ebook Library) | DamSak.org',
  description: 'අති පූජ්‍ය රේරුකානේ චන්දවිමල මහා නාහිමියන් විසින් රචිත වටිනා ධර්ම ග්‍රන්ථ ඇතුළු දහම් පොත්පත් කියවීමට (Online Reader) සහ EPUB / PDF ලෙස නොමිලේ භාගත කරගන්න.',
  alternates: {
    canonical: '/ebooks',
  },
  openGraph: {
    title: 'දහම් පොත් එකතුව (Dhamma Ebook Library) | DamSak.org',
    description: 'අති පූජ්‍ය රේරුකානේ චන්දවිමල මහා නාහිමියන් විසින් රචිත වටිනා ධර්ම ග්‍රන්ථ ඇතුළු දහම් පොත්පත් කියවීමට (Online Reader) සහ EPUB / PDF ලෙස නොමිලේ භාගත කරගන්න.',
    url: '/ebooks',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'දහම් පොත් එකතුව (Dhamma Ebook Library) | DamSak.org',
    description: 'අති පූජ්‍ය රේරුකානේ චන්දවිමල මහා නාහිමියන් විසින් රචිත වටිනා ධර්ම ග්‍රන්ථ ඇතුළු දහම් පොත්පත් කියවීමට (Online Reader) සහ EPUB / PDF ලෙස නොමිලේ භාගත කරගන්න.',
  },
};

export default function EbooksPage() {
  const ebooks = ebooksData as Ebook[];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': 'https://damsak.org/ebooks#collection',
        url: 'https://damsak.org/ebooks',
        name: 'දහම් පොත් එකතුව (Dhamma Ebook Library)',
        description: 'අති පූජ්‍ය රේරුකානේ චන්දවිමල මහා නාහිමියන් විසින් රචිත වටිනා ධර්ම ග්‍රන්ථ ඇතුළු දහම් පොත්පත් කියවීමට සහ භාගත කර ගැනීමට පිවිසෙන්න.',
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'මුල් පිටුව',
            item: 'https://damsak.org',
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'දහම් පොත් එකතුව',
            item: 'https://damsak.org/ebooks',
          },
        ],
      },
      {
        '@type': 'ItemList',
        name: 'දහම් පොත් නාමාවලිය',
        numberOfItems: ebooks.length,
        itemListElement: ebooks.map((book, idx) => ({
          '@type': 'ListItem',
          position: idx + 1,
          name: book.title,
          url: `https://damsak.org/ebooks/${book.id}/read/titlepage`,
          item: {
            '@type': 'Book',
            name: book.title,
            author: {
              '@type': 'Person',
              name: book.author,
            },
            description: book.description,
            image: `https://damsak.org${book.cover_url}`,
            inLanguage: 'si',
          },
        })),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className={styles.container}>
        <header className={styles.header}>
          <Link href="/" className={styles.backLink}>
            ← මුල් පිටුවට <span className="english-sub">Back to Home</span>
          </Link>
          <h1 className={styles.pageTitle}>
            දහම් පොත් එකතුව <span className="english-sub">Dhamma Ebook Library</span>
          </h1>
          <p className={styles.pageSubtitle}>
            අති පූජ්‍ය රේරුකානේ චන්දවිමල මහා නාහිමියන් විසින් රචිත වටිනා ධර්ම ග්‍රන්ථ ඇතුළු දහම් පොත්පත් මෙහිදී ඔබට කියවීමට සහ භාගත (Download) කර ගැනීමට හැකිය.
          </p>
        </header>

        {/* EPUB versions explanation */}
        <div className={`${styles.infoCard} glass`}>
          <span className={styles.infoTitle}>
            <HelpCircleIcon size={16} className={styles.infoIcon} />
            EPUB සංස්කරණ බාගත කිරීම් පිළිබඳ උපදෙස්
          </span>
          <div className={styles.infoContent}>
            <p>
              මෙම වෙබ් අඩවියේ ඇති ඊ-පොත් (Ebooks) කියවීම සඳහා සංස්කරණ 2කින් ලබාගත හැකිය:
            </p>
            <ul>
              <li>
                <strong>EPUB (Standard)</strong>: Apple Books, Google Play Books, Kobo හෝ වෙනත් සාමාන්‍ය ඊ-පොත් කියවන මෘදුකාංග සඳහා සුදුසු වේ. මෙහි පටුන සිංහල අකුරෙන්ම පවතී.
              </li>
              <li>
                <strong>EPUB (Kindle)</strong>: Amazon Kindle උපාංග සඳහා විශේෂයෙන් සකසා ඇත. Kindle උපාංගවල සිංහල අකුරු සහිත පටුන (Table of Contents) නිවැරදිව පෙන්වීමට නොහැකි බැවින්, මෙම සංස්කරණයේ පටුන ඉංග්‍රීසි අකුරෙන් (Transliterated) සකසා ඇත.
              </li>
            </ul>
          </div>
        </div>

        {/* Interactive Search and Book Grid */}
        <EbooksClient ebooks={ebooks} />

        {/* Credits and Punyanimodana Footer Card */}
        <footer className={`${styles.creditsCard} glass`}>
          <div className={styles.creditsContent}>
            <h3>පුණ්‍යානුමෝදනාව සහ මූලාශ්‍ර කෘතඥතාව</h3>
            <p className={styles.creditsTextSinhala}>
              මෙම පොත් එකතුවේ ඇති ඊ-පොත් (EPUB) සැකසීමට සහ අපගේ මාර්ගගත කියවනය (Online Reader) සඳහා <a href="https://pitaka.lk/books/" target="_blank" rel="noopener noreferrer" className={styles.creditLink}>pitaka.lk</a> වෙබ් අඩවියේ ඇති ඩිජිටල්කරණය කරන ලද මුල් HTML ලිපිගොනු මූලාශ්‍ර කරගන්නා ලදී. එම දහම් පොත් ඩිජිටල්කරණය කර පොදු පරිහරණය සඳහා විවෘතව ලබාදීම පිළිබඳව pitaka.lk කණ්ඩායමට අපගේ ගෞරවනීය ස්තූතිය සහ පුණ්‍යානුමෝදනාව මෙයින් පළ කර සිටිමු.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
