import React from 'react';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { I18nProvider } from '@/contexts/I18nContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { MeProvider } from '@/contexts/MeContext';
import { ReactQueryProvider } from '@/providers/ReactQueryProvider';
import { Router } from '@/Router';
import { authService } from '@/services/authService';

// Initialize AWS Amplify before React renders
authService.configure();

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#6366f1',
    },
    secondary: {
      main: '#a78bfa',
    },
    background: {
      default: '#070b1a',
      paper: 'rgba(15, 18, 30, 0.9)',
    },
    text: {
      primary: 'rgba(255, 255, 255, 0.95)',
      secondary: 'rgba(255, 255, 255, 0.75)',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  },
  components: {
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiInputLabel-root': {
            color: 'rgba(255, 255, 255, 0.7)',
          },
          '& .MuiInputLabel-root.Mui-focused': {
            color: 'rgba(255, 255, 255, 0.9)',
          },
          '& .MuiOutlinedInput-root': {
            color: 'rgba(255, 255, 255, 0.95)',
            '& fieldset': {
              borderColor: 'rgba(255, 255, 255, 0.2)',
            },
            '&:hover fieldset': {
              borderColor: 'rgba(255, 255, 255, 0.35)',
            },
            '&.Mui-focused fieldset': {
              borderColor: 'rgba(99, 102, 241, 0.8)',
            },
            '& .MuiSelect-select': {
              color: 'rgba(255, 255, 255, 0.95)',
            },
          },
          '& .MuiInputBase-input::placeholder': {
            color: 'rgba(255, 255, 255, 0.5)',
            opacity: 1,
          },
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        input: {
          color: 'rgba(255, 255, 255, 0.95)',
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          color: 'rgba(255, 255, 255, 0.9)',
        },
      },
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <I18nProvider>
        <AuthProvider>
          <ReactQueryProvider>
            <MeProvider>
              <Router />
            </MeProvider>
          </ReactQueryProvider>
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}

export default App;
