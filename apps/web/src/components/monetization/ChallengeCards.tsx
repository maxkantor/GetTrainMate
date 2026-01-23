import React from 'react';
import { Container } from '@/components/layout/Container';
import { Button } from '@/components/ui/Button';
import { sponsoredChallenges } from '@/data/monetizationData';
import styles from './ChallengeCards.module.css';

export const ChallengeCards: React.FC = () => {
  const joinChallenge = (challengeId: string) => {
    // TODO: Connect to backend challenge enrollment
    console.log('Join challenge:', challengeId);
    alert(`Joining challenge: ${challengeId}. Backend integration coming soon!`);
  };

  const challengeEmojis = ['🏃‍♂️', '💪', '🎯'];

  return (
    <section className={styles.challengesSection}>
      <Container size="xl">
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Join Sponsored Challenges</h2>
          <p className={styles.sectionSubtitle}>
            Compete with partners, hit milestones, and win prizes from top fitness brands
          </p>
        </div>

        <div className={styles.challengesGrid}>
          {sponsoredChallenges.map((challenge, idx) => (
            <div key={challenge.id} className={styles.challengeCard}>
              <div className={styles.challengeImage}>
                {challengeEmojis[idx]}
                {challenge.sponsor && (
                  <div className={styles.sponsorBadge}>
                    <span>⭐</span>
                    <span>Sponsored by {challenge.sponsor}</span>
                  </div>
                )}
              </div>

              <div className={styles.challengeContent}>
                <h3 className={styles.challengeTitle}>{challenge.title}</h3>
                <p className={styles.challengeDescription}>{challenge.description}</p>

                <div className={styles.challengeMeta}>
                  <div className={styles.metaItem}>
                    <span className={styles.metaIcon}>⏱️</span>
                    <span>{challenge.duration}</span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaIcon}>👥</span>
                    <span>{challenge.participants.toLocaleString()} joined</span>
                  </div>
                </div>

                <div className={styles.challengeFooter}>
                  <div className={styles.priceTag}>
                    <span className={styles.priceLabel}>Entry</span>
                    <span className={`${styles.priceValue} ${challenge.price === 0 ? styles.free : ''}`}>
                      {challenge.price === 0 ? 'FREE' : `$${challenge.price}`}
                    </span>
                  </div>
                  <Button
                    variant={challenge.price === 0 ? 'primary' : 'secondary'}
                    size="md"
                    onClick={() => joinChallenge(challenge.id)}
                    className={styles.joinButton}
                  >
                    Join Challenge
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
};
