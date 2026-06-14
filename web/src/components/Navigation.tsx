'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TheroConfig } from '@/types';
import { getTheroS3BaseUrl } from '@/utils/theros';
import { HomeIcon, PodcastIcon, BookIcon, SunIcon, MoonIcon } from './Icons';
import styles from './Navigation.module.css';

interface NavigationProps {
  theros: TheroConfig[];
}

export default function Navigation({ theros }: NavigationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isLight = document.documentElement.classList.contains('light-theme');
      setTheme(isLight ? 'light' : 'dark');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    if (newTheme === 'light') {
      document.documentElement.classList.add('light-theme');
      localStorage.setItem('theme', 'light');
    } else {
      document.documentElement.classList.remove('light-theme');
      localStorage.setItem('theme', 'dark');
    }
  };

  const toggleMenu = () => setIsOpen(!isOpen);
  const closeMenu = () => setIsOpen(false);

  const isActive = (path: string) => pathname === path;
  const isPodcastActive = (theroId: string) => pathname === `/podcast/${theroId}` || pathname?.startsWith(`/podcast/${theroId}/`);

  return (
    <header className={`${styles.header} glass`}>
      <div className={styles.headerContent}>
        <Link href="/" className={styles.logoLink}>
          <img src="/logo-icon.png" alt="DamSak.org Logo" className={styles.logoIcon} />
          <span className={styles.logoText}>
            <span className="title-gradient">DamSak</span>
            <span className={styles.logoOrg}>.org</span>
          </span>
        </Link>

        <div className={styles.navAndActions}>
          {/* Desktop Navigation Links */}
          <nav className={styles.desktopNav}>
            <Link
              href="/"
              className={`${styles.navLink} ${isActive('/') ? styles.active : ''}`}
            >
              <span className={styles.linkIcon}><HomeIcon size={18} /></span> මුල් පිටුව
            </Link>

            <div className={styles.dropdown}>
              <button
                className={`${styles.navLink} ${styles.dropdownTrigger} ${pathname?.startsWith('/podcast') ? styles.active : ''}`}
              >
                <span className={styles.linkIcon}><PodcastIcon size={18} /></span> ධර්ම දේශනා <span className={styles.arrow}>▼</span>
              </button>
              <div className={`${styles.dropdownContent} glass`}>
                {theros.map((thero) => (
                  <Link
                    key={thero.id}
                    href={`/podcast/${thero.id}`}
                    className={`${styles.dropdownLink} ${isPodcastActive(thero.id) ? styles.activeDropdown : ''}`}
                  >
                    {thero.podcast.image_url && (
                      <img
                        src={thero.podcast.image_url.startsWith('http') ? thero.podcast.image_url : `${getTheroS3BaseUrl(thero)}/${thero.podcast.image_url}`}
                        alt={thero.name_sinhala || thero.name}
                        className={styles.dropdownTheroImage}
                      />
                    )}
                    <span>{thero.name_sinhala || thero.name.replace('Ven. ', '')}</span>
                  </Link>
                ))}
              </div>
            </div>

            <Link
              href="/ebooks"
              className={`${styles.navLink} ${isActive('/ebooks') || pathname?.startsWith('/ebooks/') ? styles.active : ''}`}
            >
              <span className={styles.linkIcon}><BookIcon size={18} /></span> පොත් එකතුව
            </Link>
          </nav>

          {/* Theme Toggle Button */}
          <button
            className={styles.themeToggle}
            onClick={toggleTheme}
            aria-label="Toggle dark/light mode"
            title={theme === 'dark' ? 'ආලෝක තේමාව (Light Mode)' : 'අඳුරු තේමාව (Dark Mode)'}
          >
            {theme === 'dark' ? <SunIcon size={18} /> : <MoonIcon size={18} />}
          </button>

          {/* Mobile Hamburger Button */}
          <button className={styles.hamburger} onClick={toggleMenu} aria-label="Toggle menu">
            <span className={`${styles.bar} ${isOpen ? styles.barOpen1 : ''}`}></span>
            <span className={`${styles.bar} ${isOpen ? styles.barOpen2 : ''}`}></span>
            <span className={`${styles.bar} ${isOpen ? styles.barOpen3 : ''}`}></span>
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      <div className={`${styles.mobileDrawer} glass ${isOpen ? styles.drawerOpen : ''}`}>
        <nav className={styles.mobileNav}>
          <div className={styles.mobileSectionGroup}>
            <div className={styles.mobileSectionTitle}>
              ප්‍රධාන <span className="english-sub">Home</span>
            </div>
            <Link
              href="/"
              onClick={closeMenu}
              className={`${styles.mobileLink} ${isActive('/') ? styles.active : ''}`}
            >
              <span className={styles.linkIcon}><HomeIcon size={18} /></span> මුල් පිටුව
            </Link>
          </div>

          <div className={styles.mobileSectionGroup}>
            <div className={styles.mobileSectionTitle}>ධර්ම දේශනා</div>
            <div className={styles.mobileTheroList}>
              {theros.map((thero) => (
                <Link
                  key={thero.id}
                  href={`/podcast/${thero.id}`}
                  onClick={closeMenu}
                  className={`${styles.mobileLink} ${isPodcastActive(thero.id) ? styles.active : ''}`}
                >
                  {thero.podcast.image_url ? (
                    <img
                      src={thero.podcast.image_url.startsWith('http') ? thero.podcast.image_url : `${getTheroS3BaseUrl(thero)}/${thero.podcast.image_url}`}
                      alt={thero.name_sinhala || thero.name}
                      className={styles.mobileTheroImage}
                    />
                  ) : (
                    <span className={styles.linkIcon}><PodcastIcon size={18} /></span>
                  )}
                  <span>{thero.name_sinhala || thero.name.replace('Ven. ', '')}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className={styles.mobileSectionGroup}>
            <div className={styles.mobileSectionTitle}>
              දහම් පොත්පත් <span className="english-sub">Ebooks</span>
            </div>
            <Link
              href="/ebooks"
              onClick={closeMenu}
              className={`${styles.mobileLink} ${isActive('/ebooks') || pathname?.startsWith('/ebooks/') ? styles.active : ''}`}
            >
              <span className={styles.linkIcon}><BookIcon size={18} /></span> පොත් එකතුව
            </Link>
          </div>
        </nav>
        <div className={styles.mobileFooter}>
          <span className={styles.metaInfo}>සියලු සත්වයෝ සුවපත් වෙත්වා.</span>
        </div>
      </div>

      {/* Overlay backdrop */}
      {isOpen && <div className={styles.overlay} onClick={closeMenu}></div>}
    </header>
  );
}
