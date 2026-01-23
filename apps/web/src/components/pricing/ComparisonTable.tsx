import React from 'react';
import { Container } from '@/components/layout/Container';
import { Button } from '@/components/ui/Button';
import { comparisonFeatures } from '@/data/pricingData';
import styles from './ComparisonTable.module.css';

export const ComparisonTable: React.FC = () => {
  const renderValue = (value: string | boolean) => {
    if (typeof value === 'boolean') {
      return value ? (
        <span className={styles.checkmark}>✓</span>
      ) : (
        <span className={styles.cross}>×</span>
      );
    }
    return <span className={styles.textValue}>{value}</span>;
  };

  const handleUpgrade = (planId: string) => {
    console.log('Upgrade to:', planId);
    alert(`Upgrading to ${planId} plan. Stripe integration coming soon!`);
  };

  return (
    <section className={styles.comparisonSection}>
      <Container size="xl">
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Compare all features</h2>
          <p className={styles.sectionSubtitle}>
            Choose the plan that's right for your training goals
          </p>
        </div>

        <div className={styles.tableContainer}>
          <table className={styles.comparisonTable}>
            <thead>
              <tr>
                <th className={styles.featureHead}>Feature</th>
                <th className={styles.planHead}>
                  <div className={styles.planHeader}>
                    <span className={styles.planName}>Free</span>
                  </div>
                </th>
                <th className={styles.planHead}>
                  <div className={styles.planHeader}>
                    <span className={styles.planName}>Pro</span>
                  </div>
                </th>
                <th className={`${styles.planHead} ${styles.eliteCol}`}>
                  <div className={styles.planHeader}>
                    <span className={styles.planName}>Elite</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {comparisonFeatures.map((feature, idx) => (
                <tr key={idx}>
                  <td className={styles.featureCell}>{feature.name}</td>
                  <td className={styles.planCell}>{renderValue(feature.free)}</td>
                  <td className={styles.planCell}>{renderValue(feature.pro)}</td>
                  <td className={`${styles.planCell} ${styles.eliteCol}`}>
                    {renderValue(feature.elite)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className={styles.featureCell}></td>
                <td className={styles.planCell}>
                  <Button
                    variant="ghost"
                    size="md"
                    as="a"
                    href="/signup"
                    className={styles.upgradeButton}
                  >
                    Get Started
                  </Button>
                </td>
                <td className={styles.planCell}>
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => handleUpgrade('pro')}
                    className={styles.upgradeButton}
                  >
                    Upgrade
                  </Button>
                </td>
                <td className={`${styles.planCell} ${styles.eliteCol}`}>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => handleUpgrade('elite')}
                    className={styles.upgradeButton}
                  >
                    Upgrade
                  </Button>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Container>
    </section>
  );
};
