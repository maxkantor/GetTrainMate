import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import styles from './AdminNoAccess.module.css';

export const AdminNoAccessPage: React.FC = () => (
  <div className={styles.root}>
    <div className={styles.card}>
      <div className={styles.icon}>🔒</div>
      <h1 className={styles.title}>Access Denied</h1>
      <p className={styles.desc}>
        You don&apos;t have permission to view the admin portal.
      </p>
      <div className={styles.actions}>
        <Button as="link" to="/" variant="primary">
          Go to Home
        </Button>
        <Button as="link" to="/app" variant="outline">
          Open App
        </Button>
      </div>
    </div>
  </div>
);
