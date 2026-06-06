'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TheroConfig } from '@/types';
import { HomeIcon, PodcastIcon, BookIcon } from './Icons';
import styles from './Navigation.module.css';

interface NavigationProps {
  theros: TheroConfig[];
}

export default function Navigation({ theros }: NavigationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const toggleMenu = () => setIsOpen(!isOpen);
  const closeMenu = () => setIsOpen(false);

  const isActive = (path: string) => pathname === path;
  const isPodcastActive = (theroId: string) => pathname === `/podcast/${theroId}` || pathname?.startsWith(`/podcast/${theroId}/`);

  const navContent = (
    <div className={styles.navContainer}>
      <div className={styles.brandContainer}>
        <Link href="/" className={`${styles.logo} title-gradient`} onClick={closeMenu}>
          EchoDhamma
        </Link>
      </div>

      <nav className={styles.navSections}>
        <div className={styles.sectionGroup}>
          <div className={styles.sectionTitle}>ප්‍රධාන (Home)</div>
          <Link
            href="/"
            onClick={closeMenu}
            className={`${styles.navLink} ${isActive('/') ? styles.active : ''}`}
          >
            <span className={styles.linkIcon}><HomeIcon size={18} /></span> මුල් පිටුව (Home)
          </Link>
        </div>

        <div className={styles.sectionGroup}>
          <div className={styles.sectionTitle}>ධර්ම දේශනා (Podcasts)</div>
          <div className={styles.theroList}>
            {theros.map((thero) => (
              <Link
                key={thero.id}
                href={`/podcast/${thero.id}`}
                onClick={closeMenu}
                className={`${styles.navLink} ${isPodcastActive(thero.id) ? styles.active : ''}`}
              >
                <span className={styles.linkIcon}><PodcastIcon size={18} /></span> {thero.name.replace('Ven. ', '')}
              </Link>
            ))}
          </div>
        </div>

        <div className={styles.sectionGroup}>
          <div className={styles.sectionTitle}>දහම් පොත්පත් (Ebooks)</div>
          <Link
            href="/ebooks"
            onClick={closeMenu}
            className={`${styles.navLink} ${isActive('/ebooks') || pathname?.startsWith('/ebooks/') ? styles.active : ''}`}
          >
            <span className={styles.linkIcon}><BookIcon size={18} /></span> පොත් එකතුව (Ebooks)
          </Link>
        </div>
      </nav>

      <div className={styles.navFooter}>
        <span className={styles.metaInfo}>May all beings be happy</span>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar Layout */}
      <aside className={`${styles.sidebar} glass`}>
        {navContent}
      </aside>

      {/* Mobile Header Layout */}
      <header className={`${styles.mobileHeader} glass`}>
        <Link href="/" className={`${styles.logo} title-gradient`}>
          EchoDhamma
        </Link>
        <button className={styles.hamburger} onClick={toggleMenu} aria-label="Toggle menu">
          <span className={`${styles.bar} ${isOpen ? styles.barOpen1 : ''}`}></span>
          <span className={`${styles.bar} ${isOpen ? styles.barOpen2 : ''}`}></span>
          <span className={`${styles.bar} ${isOpen ? styles.barOpen3 : ''}`}></span>
        </button>
      </header>

      {/* Mobile Navigation Drawer */}
      <div className={`${styles.mobileDrawer} glass ${isOpen ? styles.drawerOpen : ''}`}>
        {navContent}
      </div>

      {/* Overlay backdrop */}
      {isOpen && <div className={styles.overlay} onClick={closeMenu}></div>}
    </>
  );
}
