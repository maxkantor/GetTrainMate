import React, { ReactNode } from 'react';
import { Box, Container, Typography, Button } from '@mui/material';
import styles from '@/styles/ErrorBoundary.module.css';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Container className={styles.errorContainer}>
          <Box className={styles.errorBox}>
            <Typography variant="h4" component="h1" gutterBottom>
              Oops! Something went wrong.
            </Typography>
            <Typography variant="body1" color="textSecondary" paragraph>
              {this.state.error?.message}
            </Typography>
            <Button
              variant="contained"
              onClick={() => window.location.href = '/'}
            >
              Go Home
            </Button>
          </Box>
        </Container>
      );
    }

    return this.props.children;
  }
}
