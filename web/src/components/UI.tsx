import React from 'react';
import styles from './UI.module.css';

// --- Card Component ---
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  glowOnHover?: boolean;
}

export function Card({ children, className = '', glowOnHover = true, ...props }: CardProps) {
  const cardClassName = `${styles.card} glass ${glowOnHover ? styles.glow : ''} ${className}`;
  return (
    <div className={cardClassName} {...props}>
      {children}
    </div>
  );
}

// --- Button Component ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  ...props 
}: ButtonProps) {
  const btnClassName = `${styles.button} ${styles[variant]} ${styles[size]} ${className}`;
  return (
    <button className={btnClassName} {...props}>
      {children}
    </button>
  );
}

// --- Badge Component ---
interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  variant?: 'gold' | 'secondary' | 'outline';
}

export function Badge({ children, variant = 'gold', className = '', ...props }: BadgeProps) {
  const badgeClassName = `${styles.badge} ${styles[variant]} ${className}`;
  return (
    <span className={badgeClassName} {...props}>
      {children}
    </span>
  );
}
