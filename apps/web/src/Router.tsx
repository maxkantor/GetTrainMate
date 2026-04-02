import React from 'react';
import { BrowserRouter, Routes, Route, Link as RouterLink, useParams } from 'react-router-dom';
import { Container, Typography, Button } from '@mui/material';
import { Layout } from '@/components/Layout';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AdminRoute } from '@/components/AdminRoute';
import { LandingPage } from '@/pages/Landing';
import { PricingPage } from '@/pages/Pricing';
import { BillingSuccessPage } from '@/pages/BillingSuccess';
import { BillingCancelPage } from '@/pages/BillingCancel';
import { AboutPage } from '@/pages/About';
import { FAQPage } from '@/pages/FAQ';
import { ContactPage } from '@/pages/Contact';
import { PrivacyPage } from '@/pages/Privacy';
import { TermsPage } from '@/pages/Terms';
import { GearPage } from '@/pages/Gear';
import { PlatformPage } from '@/pages/Platform';
import { LoginPage } from '@/pages/Login';
import { SignupPage } from '@/pages/Signup';
import { VerifyEmailPage } from '@/pages/VerifyEmail';
import { DashboardPage as AppDashboardPage } from '@/pages/app/Dashboard';
import { AppHomePage } from '@/pages/app/AppHome';
import { ProfilePage } from '@/pages/app/Profile';
import { PublicProfilePage } from '@/pages/app/PublicProfile';
import { DiscoverPage } from '@/pages/app/Discover';
import { MatchesPage } from '@/pages/app/Matches';
import { SentRequestsPage } from '@/pages/app/SentRequestsPage';
import { SkippedProfilesPage } from '@/pages/app/SkippedProfilesPage';
import { ChatPage } from '@/pages/app/Chat';
import { AICoachPage } from '@/pages/app/AICoachPage';
import { EventsPage } from '@/pages/app/Events';
import { SubscriptionPage } from '@/pages/app/Subscription';
import { ProfileOnboardingPage } from '@/pages/onboarding/ProfileOnboarding';
import { DashboardPage as AdminDashboardPage } from '@/pages/admin/DashboardPage';
import { UsersPage } from '@/pages/admin/UsersPage';
import { DevicesPage } from '@/pages/admin/DevicesPage';
import { ContactsPage } from '@/pages/admin/ContactsPage';
import { AdminLoginPage } from '@/pages/admin/AdminLoginPage';
import { AdminLayout } from '@/pages/admin/AdminLayout';
import { CreditPacksPage as AdminCreditPacksPage } from '@/pages/admin/CreditPacksPage';
import { TestUsersPage } from '@/pages/admin/TestUsersPage';
import { AdminChatsPage } from '@/pages/admin/AdminChatsPage';
import { AdminStripePage } from '@/pages/admin/AdminStripePage';
import { AdminEventsPage } from '@/pages/admin/AdminEventsPage';
import { AdminTicketsPage } from '@/pages/admin/AdminTicketsPage';
import { AdminAuditPage } from '@/pages/admin/AdminAuditPage';
import { AdminMatchesPage } from '@/pages/admin/AdminMatchesPage';
import { ScrollToTop } from '@/components/ScrollToTop';
import { LandingConversionProvider } from '@/contexts/LandingConversionContext';

function PublicProfileRoute() {
  const { userId } = useParams<{ userId: string }>();
  return <PublicProfilePage key={userId} userIdFromRoute={userId ?? ''} />;
}

export const Router: React.FC = () => {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ScrollToTop />
        <LandingConversionProvider>
        <Layout>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/billing/success" element={<BillingSuccessPage />} />
            <Route path="/billing/cancel" element={<BillingCancelPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/faq" element={<FAQPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/gear" element={<GearPage />} />
            <Route path="/platform" element={<PlatformPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />

            {/* Auth routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/admin/login" element={<AdminLoginPage />} />

            {/* Onboarding route - requires auth but not profile completion */}
            <Route path="/onboarding/profile" element={<ProtectedRoute requireProfileComplete={false} />}>
              <Route index element={<ProfileOnboardingPage />} />
            </Route>

            {/* Protected app routes - require profile completion */}
            <Route path="/app" element={<ProtectedRoute requireProfileComplete={true} />}>
              <Route index element={<AppHomePage />} />
              <Route path="dashboard" element={<AppHomePage />} />
              <Route path="discover" element={<DiscoverPage />} />
              <Route path="matches" element={<MatchesPage />} />
              <Route path="sent-requests" element={<SentRequestsPage />} />
              <Route path="skipped" element={<SkippedProfilesPage />} />
              <Route path="chat" element={<ChatPage />} />
              <Route path="ai-coach" element={<AICoachPage />} />
              <Route path="events" element={<EventsPage />} />
              <Route path="subscription" element={<SubscriptionPage />} />
              <Route path="profile/:userId" element={<PublicProfileRoute />} />
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
                  <Route path="/admin/chats" element={<AdminChatsPage />} />
                  <Route path="/admin/events" element={<AdminEventsPage />} />
                  <Route path="/admin/tickets" element={<AdminTicketsPage />} />
                  <Route path="/admin/stripe" element={<AdminStripePage />} />
                  <Route path="/admin/matches" element={<AdminMatchesPage />} />
                  <Route path="/admin/contacts" element={<ContactsPage />} />
                  <Route path="/admin/audit" element={<AdminAuditPage />} />
                  <Route path="/admin/credit-packs" element={<AdminCreditPacksPage />} />
                  <Route path="/admin/test-users" element={<TestUsersPage />} />
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
        </LandingConversionProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
};
