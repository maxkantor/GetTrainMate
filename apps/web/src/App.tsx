import React from 'react';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { I18nProvider } from '@/contexts/I18nContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { MeProvider } from '@/contexts/MeContext';
import { Router } from '@/Router';
import { authService } from '@/services/authService';

// Initialize AWS Amplify before React renders
authService.configure();

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#fafafa',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <I18nProvider>
        <AuthProvider>
          <MeProvider>
            <Router />
          </MeProvider>
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}

export default App;
