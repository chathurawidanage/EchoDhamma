import Link from 'next/link';
import { getTheros } from '@/utils/theros.server';
import { getTheroS3BaseUrl } from '@/utils/theros';
import { BookIcon } from '@/components/Icons';
import styles from './page.module.css';

export default function HomePage() {
  const theros = getTheros();

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <section className={styles.heroSection}>
          <div className={styles.heroGlow}></div>
          <div className={styles.heroContent}>
            <h1>
              <span className="title-gradient">DamSak</span>
              <span className={styles.heroTitleOrg}>.org</span>
              <span className={styles.heroTitleSeparator}> — </span>
              <span className={styles.heroTitleTagline}>නිර්මල ශ්‍රී සද්ධර්ම ප්‍රතිධ්වනිය</span>
            </h1>
            <p className={styles.heroLead}>
              DamSak.org තුළින් අප සිදු කරන්නේ පවතින ධර්ම මූලාශ්‍ර, පහසුවෙන් ශ්‍රවණය කළ හැකි Audio Podcasts ලෙස සහ ජංගම දුරකථන හෝ ඊ-රීඩර්ස් (E-readers) මඟින් පහසුවෙන් කියවිය හැකි EPUB / Ebooks ආකෘති වෙත උසස් ප්‍රමිතියෙන් යුතුව පරිවර්තනය (Re-encode) කර ක්‍රමවත්ව පෙළගැස්වීමයි.
            </p>
          </div>
          <div className={styles.heroLogoContainer}>
            <img src="/logo-icon.png" alt="DamSak.org Dharmachakra Logo" className={styles.heroLogo} />
          </div>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>ධර්ම දේශනා පෝඩ්කාස්ට් (Podcasts)</h3>
          <div className={styles.theroGrid}>
            {theros.map((thero) => (
              <Link
                key={thero.id}
                href={`/podcast/${thero.id}`}
                className={`${styles.theroCard} glass glow-hover`}
                id={`thero-card-${thero.id}`}
              >
                <div className={styles.avatarPlaceholder}>
                  {thero.podcast.image_url ? (
                    <img
                      src={thero.podcast.image_url.startsWith('http') ? thero.podcast.image_url : `${getTheroS3BaseUrl(thero)}/${thero.podcast.image_url}`}
                      alt={thero.name_sinhala || thero.name}
                      className={styles.avatarImg}
                    />
                  ) : (
                    thero.name.split(' ').filter(n => !n.startsWith('Ven.') && !n.startsWith('Thero') && !n.startsWith('අති') && !n.startsWith('පූජ්‍ය')).map(n => n[0]).join('') || 'Ven'
                  )}
                </div>
                <div className={styles.theroCardContent}>
                  <h4 className={styles.theroName}>
                    {thero.name_sinhala || thero.name}
                    {thero.name_sinhala && (
                      <span className={styles.englishNameSub}>{thero.name}</span>
                    )}
                  </h4>
                  <p className={styles.podcastDesc}>{thero.podcast.description}</p>
                  <div className={styles.theroCardFooter}>
                    <span>දේශනා ශ්‍රවණය කරන්න →</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>දහම් පොත්පත් (Ebooks)</h3>
          <div className={styles.ebookContainer}>
            <Link
              href="/ebooks"
              className={`${styles.ebookCard} glass glow-hover`}
              id="ebooks-library-card"
            >
              <div className={styles.ebookCardContent}>
                <div className={styles.ebookIcon}>
                  <BookIcon size={32} />
                </div>
                <div>
                  <h4>දහම් පොත් එකතුව (Ebook Library)</h4>
                  <p>අති පූජ්‍ය රේරුකානේ චන්දවිමල මහා නාහිමියන්ගේ ධර්ම ග්‍රන්ථ ඇතුළු අනෙකුත් දහම් පොත් කියවීමට සහ භාගත (Download) කර ගැනීමට පිවිසෙන්න.</p>
                </div>
              </div>
              <div className={styles.ebookCardAction}>
                <span>ග්‍රන්ථ එකතුවට පිවිසෙන්න →</span>
              </div>
            </Link>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <p>© {new Date().getFullYear()} DamSak.org. සියලු සත්වයෝ සුවපත් වෙත්වා.</p>
      </footer>
    </div>
  );
}
