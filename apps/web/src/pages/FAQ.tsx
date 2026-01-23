import React, { useState } from 'react';
import { Container, Typography, Box, Accordion, AccordionSummary, AccordionDetails, Chip } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useI18n } from '@/hooks/useI18n';

export const FAQPage: React.FC = () => {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState<string | false>('panel1');

  const handleChange = (panel: string) => (_event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false);
  };

  const faqs = [
    {
      category: 'Getting Started',
      questions: [
        {
          q: 'How does GetTrainMate work?',
          a: 'GetTrainMate uses AI-powered matching to connect you with training partners based on your goals, location, schedule, and skill level. Simply create a profile, set your preferences, and start browsing matches. You can chat with potential partners and arrange training sessions together.',
        },
        {
          q: 'Is GetTrainMate free to use?',
          a: 'Yes! GetTrainMate offers a free tier that includes basic matching and messaging features. Premium plans unlock advanced filters, unlimited matches, event creation, and priority support. Check our pricing page for details.',
        },
        {
          q: 'What sports and activities are supported?',
          a: 'We support a wide range of activities including running, cycling, swimming, gym workouts, CrossFit, yoga, martial arts, tennis, basketball, and many more. If you don\'t see your sport, you can add it as a custom tag!',
        },
      ],
    },
    {
      category: 'Safety & Privacy',
      questions: [
        {
          q: 'How does GetTrainMate keep me safe?',
          a: 'Safety is our top priority. All users must verify their email addresses and phone numbers. We offer optional photo verification badges. You can report suspicious behavior, and our moderation team reviews all reports within 24 hours. Always meet new training partners in public places for the first few sessions.',
        },
        {
          q: 'Can I block or report users?',
          a: 'Absolutely. You can block any user from your profile or chat interface. If you encounter inappropriate behavior, use the report button to notify our moderation team immediately. We have zero tolerance for harassment or fake profiles.',
        },
        {
          q: 'What information is visible on my profile?',
          a: 'Your public profile shows your name, photos, bio, sports/activities, skill level, goals, and general location (city). Your exact address, contact information, and personal details remain private unless you choose to share them in chat.',
        },
      ],
    },
    {
      category: 'Matching & Compatibility',
      questions: [
        {
          q: 'How does the matching algorithm work?',
          a: 'Our AI analyzes multiple factors: your fitness goals, preferred sports, skill level, availability schedule, location proximity, and training preferences. The compatibility score (shown as a percentage) indicates how well you match with another user. Higher scores mean better compatibility!',
        },
        {
          q: 'What are the different modes (TRAIN, VIBE, DATE)?',
          a: 'TRAIN mode is for serious fitness partners focused on training goals. VIBE mode is for casual workout buddies and making friends through fitness. DATE mode indicates you\'re open to romantic connections through shared fitness interests. You can set your preferred mode in profile settings.',
        },
        {
          q: 'Can I filter matches by specific criteria?',
          a: 'Yes! Free users can filter by sport, skill level, and distance. Premium users get advanced filters including age range, gender, specific schedule slots, goals alignment, and more. You can also save custom filter presets.',
        },
      ],
    },
    {
      category: 'Events & Group Training',
      questions: [
        {
          q: 'How do events work?',
          a: 'Events are group training sessions organized by community members. Browse upcoming events by sport, location, and date. You can join events with available spots or create your own. Events are great for meeting multiple training partners at once!',
        },
        {
          q: 'Can I organize my own events?',
          a: 'Premium members can create unlimited events. Specify the sport, skill level, date/time, location, and max participants. Free users can join any event and create up to 2 events per month.',
        },
        {
          q: 'What happens if an event is cancelled?',
          a: 'Event organizers can cancel events up to 24 hours before the scheduled time. All participants receive instant notifications. We encourage communication through event chat if plans change.',
        },
      ],
    },
    {
      category: 'Messaging & Communication',
      questions: [
        {
          q: 'How does the chat system work?',
          a: 'Once you match with someone, you can send messages through our in-app chat. Messages are encrypted and support text, photos, and location sharing. You\'ll receive notifications for new messages.',
        },
        {
          q: 'Can I share my contact information?',
          a: 'Yes, but we recommend getting to know matches through our secure chat first. Once you feel comfortable, you can exchange phone numbers, social media, or email. Never share financial information or passwords.',
        },
        {
          q: 'What if someone isn\'t responding?',
          a: 'Users have different activity levels. If someone hasn\'t responded in a few days, feel free to move on to other matches. Premium users can see when someone was last active.',
        },
      ],
    },
    {
      category: 'Subscription & Billing',
      questions: [
        {
          q: 'What payment methods do you accept?',
          a: 'We accept all major credit cards (Visa, Mastercard, American Express, Discover) through our secure payment processor Stripe. We do not store your payment information on our servers.',
        },
        {
          q: 'Can I cancel my subscription anytime?',
          a: 'Yes! You can cancel your subscription at any time from the Settings page. Your premium features will remain active until the end of your billing period. No refunds for partial months.',
        },
        {
          q: 'Do you offer refunds?',
          a: 'We offer a 7-day money-back guarantee for new premium subscriptions. Contact our support team within 7 days of your purchase for a full refund. After 7 days, no refunds are provided for subscription fees.',
        },
      ],
    },
    {
      category: 'Technical Support',
      questions: [
        {
          q: 'Which devices and browsers are supported?',
          a: 'GetTrainMate works on all modern web browsers (Chrome, Firefox, Safari, Edge). We also have mobile-optimized versions. For the best experience, keep your browser updated to the latest version.',
        },
        {
          q: 'I forgot my password. How do I reset it?',
          a: 'Click "Forgot Password" on the login page. Enter your email address and we\'ll send you a reset link. Check your spam folder if you don\'t see the email within a few minutes. Links expire after 1 hour.',
        },
        {
          q: 'How do I delete my account?',
          a: 'You can permanently delete your account from Settings > Account > Delete Account. This action cannot be undone. All your data, messages, and profile information will be permanently removed within 30 days.',
        },
      ],
    },
  ];

  return (
    <Box sx={{ py: 8 }}>
      <Container maxWidth="md">
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Typography variant="h2" component="h1" gutterBottom>
            Frequently Asked Questions
          </Typography>
          <Typography variant="h6" color="textSecondary" sx={{ mt: 2 }}>
            Everything you need to know about GetTrainMate
          </Typography>
        </Box>

        {faqs.map((category, catIndex) => (
          <Box key={catIndex} sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Chip label={category.category} color="primary" />
            </Box>
            {category.questions.map((faq, qIndex) => {
              const panelId = `panel${catIndex}-${qIndex}`;
              return (
                <Accordion
                  key={qIndex}
                  expanded={expanded === panelId}
                  onChange={handleChange(panelId)}
                  elevation={1}
                  sx={{ mb: 1 }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {faq.q}
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography variant="body2" color="textSecondary" sx={{ lineHeight: 1.7 }}>
                      {faq.a}
                    </Typography>
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </Box>
        ))}

        <Box sx={{ mt: 8, p: 4, bgcolor: 'background.paper', borderRadius: 2, textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom>
            Still have questions?
          </Typography>
          <Typography variant="body2" color="textSecondary" paragraph>
            Can't find the answer you're looking for? Our support team is here to help.
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 3 }}>
            <a href="/contact" style={{ textDecoration: 'none' }}>
              <Typography
                variant="button"
                sx={{
                  color: 'primary.main',
                  fontWeight: 600,
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                Contact Support →
              </Typography>
            </a>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};
