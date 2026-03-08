import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Container, Typography, Box, Accordion, AccordionSummary, AccordionDetails, Chip } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useI18n } from '@/hooks/useI18n';
import { PageShell } from '@/components/layout/PageShell';

export const FAQPage: React.FC = () => {
  const { t: _t } = useI18n();
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
          a: 'You create a profile with sports, level, goals, and schedule. AI helps recommend compatible training partners nearby. Browse profiles, use AI match insights and icebreakers, and unlock chats with credits.',
        },
        {
          q: 'Is GetTrainMate free to use?',
          a: 'You can explore and browse matches for free. Unlocking chats, AI insights, icebreakers, and boosts use credits. Credits are one-time packs — no subscription.',
        },
        {
          q: 'What AI features does GetTrainMate offer?',
          a: 'AI powers compatibility insights for each match, smart first-message suggestions (icebreakers), an AI coach chat for profile and training help, and optional workout or meetup plans. AI is used to make matching and messaging more helpful, not replace human connection.',
        },
        {
          q: 'What sports and activities are supported?',
          a: 'The platform supports activities like running, gym workouts, CrossFit, cycling, tennis, swimming, hiking, and more. New activities will continue to be added.',
        },
      ],
    },
    {
      category: 'Safety & Privacy',
      questions: [
        {
          q: 'How does GetTrainMate keep me safe?',
          a: 'We use profile moderation, report and block tools, and community guidelines. We recommend meeting in public places for first sessions.',
        },
        {
          q: 'Can I block or report users?',
          a: 'Yes. You can block or report profiles directly from the profile or chat. Reports are reviewed by the moderation team.',
        },
        {
          q: 'What information is visible on my profile?',
          a: 'Profiles typically include sports, experience level, training goals, and general location. Users control what they share.',
        },
      ],
    },
    {
      category: 'Matching & Compatibility',
      questions: [
        {
          q: 'How does the matching algorithm work?',
          a: 'AI compares sport, skill level, goals, schedule, and distance to suggest compatible partners. You can view an AI match insight per profile to see why you’re a good fit.',
        },
        {
          q: 'What are the different modes (TRAIN, VIBE, DATE)?',
          a: 'TRAIN is for workout partners. VIBE is for casual social activity. DATE is for sports-based dating. Users choose the experience they want.',
        },
        {
          q: 'Can I filter matches by specific criteria?',
          a: 'Yes. You can filter by sport, distance, experience level, goals, and training schedule. Advanced filters may use credits.',
        },
      ],
    },
    {
      category: 'Messaging',
      questions: [
        {
          q: 'How does the chat system work?',
          a: 'Chats are unlocked with credits. Once unlocked, you message freely. AI icebreakers can suggest first messages; an in-chat Ask AI helper can assist with conversation and plans.',
        },
        {
          q: 'Can I share my contact information?',
          a: 'Users may share contact details when comfortable. We encourage using in-app chat first.',
        },
        {
          q: 'What if someone isn\'t responding?',
          a: 'You can continue browsing other matches. Compatibility increases chances of engagement.',
        },
      ],
    },
    {
      category: 'Credits & Payments',
      questions: [
        {
          q: 'What payment methods do you accept?',
          a: 'Secure payments are processed through Stripe. We support major credit and debit cards.',
        },
        {
          q: 'Do credits expire?',
          a: 'Purchased credits do not expire and remain in your account until used.',
        },
        {
          q: 'Do you offer refunds?',
          a: 'Refund requests are handled per our policy. Contact support for assistance.',
        },
      ],
    },
    {
      category: 'Technical Support',
      questions: [
        {
          q: 'Which devices and browsers are supported?',
          a: 'GetTrainMate works on modern browsers on desktop, tablet, and mobile. We support Chrome, Safari, and Edge.',
        },
        {
          q: 'I forgot my password. How do I reset it?',
          a: 'Use "Forgot Password" on the login page. Enter your email to receive a reset link.',
        },
        {
          q: 'How do I delete my account?',
          a: 'You can delete your account from your account settings or contact support.',
        },
      ],
    },
  ];

  return (
    <PageShell variant="content" showBackLink>
      <Container maxWidth="md" disableGutters sx={{ maxWidth: '100%' }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography variant="h2" component="h1" gutterBottom sx={{ fontSize: '1.75rem' }}>
            Frequently Asked Questions
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
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
            <Link to="/contact" style={{ textDecoration: 'none' }}>
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
            </Link>
          </Box>
        </Box>
      </Container>
    </PageShell>
  );
};
