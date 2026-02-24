import React, { useRef, useState } from 'react';
import styles from './TestimonialCarousel.module.css';

export interface TestimonialItem {
  name: string;
  role: string;
  location?: string;
  avatar: string;
  text: string;
  rating: number;
}

interface TestimonialCarouselProps {
  items: TestimonialItem[];
  renderCard: (item: TestimonialItem, index: number) => React.ReactNode;
}

/**
 * Horizontal carousel: drag on desktop, swipe on mobile.
 * Uses scroll-snap for smooth scrolling.
 */
export const TestimonialCarousel: React.FC<TestimonialCarouselProps> = ({
  items,
  renderCard,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };

  const handleMouseLeave = () => setIsDragging(false);
  const handleMouseUp = () => setIsDragging(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 1.2;
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  return (
    <div
      ref={scrollRef}
      className={`${styles.carousel} ${isDragging ? styles.dragging : ''}`}
      onMouseDown={handleMouseDown}
      onMouseLeave={handleMouseLeave}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
    >
      <div className={styles.track}>
        {items.map((item, index) => (
          <div key={index} className={styles.slide}>
            {renderCard(item, index)}
          </div>
        ))}
      </div>
    </div>
  );
};
