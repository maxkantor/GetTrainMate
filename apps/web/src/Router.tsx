import React from 'react';
import { BrowserRouter, Routes, Route, Link as RouterLink } from 'react-router-dom';
import { Container, Typography, Button } from '@mui/material';
import { Layout } from '@/components/Layout';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AdminRoute } from '@/components/AdminRoute';
import { LandingPage } from '@/pages/Landing';
import { PricingPage } from '@/pages/Pricing';
import { AboutPage } from '@/pages/About';
import { FAQPage } from '@/pages/FAQ';
import { ContactPage } from '@/pages/Contact';
import { PrivacyPage } from '@/pages/Privacy';
import { TermsPage } from '@/pages/Terms';
import { GearPage } from '@/pages/Gear';
import { LoginPage } from '@/pages/Login';
import { SignupPage } from '@/pages/Signup';
import { DashboardPage as AppDashboardPage } from '@/pages/app/Dashboard';
import { ProfilePage } from '@/pages/app/Profile';
import { DiscoverPage } from '@/pages/app/Discover';
import { ChatPage } from '@/pages/app/Chat';
import { EventsPage } from '@/pages/app/Events';
import { SubscriptionPage } from '@/pages/app/Subscription';
import { AdminDashboard } from '@/pages/admin/Dashboard';
import { DashboardPage as AdminDashboardPage } from '@/pages/admin/DashboardPage';
import { UsersPage } from '@/pages/admin/UsersPage';
import { DevicesPage } from '@/pages/admin/DevicesPage';
import { ContactsPage } from '@/pages/admin/ContactsPage';
import { AdminLoginPage } from '@/pages/admin/AdminLoginPage';
import { CMSPage } from '@/pages/admin/CMS';
import { AdminLayout } from '@/pages/admin/AdminLayout';

export const Router: React.FC = () => {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Layout>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/faq" element={<FAQPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/gear" element={<GearPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />

            {/* Auth routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/admin/login" element={<AdminLoginPage />} />

            {/* Protected app routes */}
            <Route path="/app" element={<ProtectedRoute />}>
              <Route index element={<DiscoverPage />} />
              <Route path="dashboard" element={<DiscoverPage />} />
              <Route path="discover" element={<DiscoverPage />} />
              <Route path="matches" element={<AppDashboardPage />} />
              <Route path="chat" element={<ChatPage />} />
              <Route path="events" element={<EventsPage />} />
              <Route path="subscription" element={<SubscriptionPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="settings" element={<AppDashboardPage />} />
            </Route>

            {/* Protected admin routes */}
            <Route element={<AdminRoute />}>
                <Route element={<AdminLayout />}>
                  <Route path="/admin" element={<AdminDashboardPage />} />
                  <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
                  <Route path="/admin/users" element={<UsersPage />} />
                  <Route path="/admin/devices" element={<DevicesPage />} />
                  <Route path="/admin/chats" element={<AdminDashboard />} />
                  <Route path="/admin/events" element={<AdminDashboard />} />
                  <Route path="/admin/tickets" element={<AdminDashboard />} />
                  <Route path="/admin/stripe" element={<AdminDashboard />} />
                  <Route path="/admin/contacts" element={<ContactsPage />} />
                  <Route path="/admin/audit" element={<AdminDashboard />} />
                  <Route path="/admin/content" element={<CMSPage />} />
                  <Route path="/admin/translations" element={<AdminDashboard />} />
                  <Route path="/admin/media" element={<AdminDashboard />} />
                  <Route path="/admin/leads" element={<AdminDashboard />} />
                </Route>
            </Route>

            {/* Catch-all - show 404 page */}
            <Route path="*" element={
              <Container maxWidth="lg" sx={{ py: 8, textAlign: 'center' }}>
                <Typography variant="h3" component="h1" gutterBottom>
                  Page not found
                </Typography>
                <Typography variant="body1" color="textSecondary" sx={{ mb: 4 }}>
                  The page you're looking for doesn't exist.
                </Typography>
                <Button variant="contained" component={RouterLink} to="/">
                  Go Home
                </Button>
              </Container>
            } />
          </Routes>
        </Layout>
      </BrowserRouter>
    </ErrorBoundary>
  );
};
