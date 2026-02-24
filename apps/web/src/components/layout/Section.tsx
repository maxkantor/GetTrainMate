import React from 'react';
import styles from './Section.module.css';

interface SectionProps {
  children: React.ReactNode;
  id?: string;
  className?: string;
  background?: 'white' | 'subtle' | 'dark';
  paddingSize?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Section: React.FC<SectionProps> = ({ 
  children, 
  id,
  className = '',
  background = 'white',
  paddingSize = 'lg'
}) => {
  return (
    <section
      id={id}
      className={`${styles.section} ${styles[background]} ${styles[paddingSize]} ${className || ''}`.trim()}
    >
      {children}
    </section>
  );
};
