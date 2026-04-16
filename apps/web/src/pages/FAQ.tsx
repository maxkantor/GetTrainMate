import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Container, Typography, Box, Accordion, AccordionSummary, AccordionDetails, Chip, TextField, Button, CircularProgress, Alert } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useI18n } from '@/hooks/useI18n';
import { useAuthContext } from '@/hooks/useAuthContext';
import { authService } from '@/services/authService';
import { askHelp } from '@/services/aiService';
import { PageShell } from '@/components/layout/PageShell';
import { FaqJsonLd } from '@/components/seo/FaqJsonLd';
import { getFaqJsonLdItems, getFaqPage } from '@/i18n/content/faqLocales';

export const FAQPage: React.FC = () => {
  const { locale } = useI18n();
  const { sections: FAQ_SECTIONS, ui: faqUi } = useMemo(() => getFaqPage(locale), [locale]);
  const faqJsonLdItems = useMemo(() => getFaqJsonLdItems(locale), [locale]);
  const { isAuthenticated } = useAuthContext();
  const [expanded, setExpanded] = useState<string | false>('panel1');
  const [helpQuestion, setHelpQuestion] = useState('');
  const [helpAnswer, setHelpAnswer] = useState('');
  const [helpLoading, setHelpLoading] = useState(false);
  const [helpError, setHelpError] = useState('');

  const handleChange = (panel: string) => (_event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false);
  };

  const handleAskHelp = async () => {
    const q = helpQuestion.trim();
    if (!q) return;
    const token = await authService.getJWT();
    if (!token) {
      setHelpError(faqUi.help_sign_in);
      return;
    }
    setHelpError('');
    setHelpAnswer('');
    setHelpLoading(true);
    try {
      const res = await askHelp(token, q);
      setHelpAnswer(res.answer);
    } catch (err) {
      setHelpError(err instanceof Error ? err.message : faqUi.help_generic_error);
    } finally {
      setHelpLoading(false);
    }
  };

  return (
    <PageShell variant="content" showBackLink>
      <FaqJsonLd items={faqJsonLdItems} />
      <Container maxWidth="md" disableGutters sx={{ maxWidth: '100%' }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography variant="h2" component="h1" gutterBottom sx={{ fontSize: '1.75rem' }}>
            {faqUi.title}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
            {faqUi.subtitle}
          </Typography>
        </Box>

        {FAQ_SECTIONS.map((category, catIndex) => (
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

        {isAuthenticated && (
          <Box sx={{ mt: 6, p: 3, bgcolor: 'action.hover', borderRadius: 2 }}>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              {faqUi.ai_help_title}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mt: 2 }}>
              <TextField
                size="small"
                fullWidth
                placeholder={faqUi.ai_placeholder}
                value={helpQuestion}
                onChange={(e) => setHelpQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAskHelp())}
              />
              <Button variant="contained" onClick={handleAskHelp} disabled={helpLoading || !helpQuestion.trim()}>
                {helpLoading ? <CircularProgress size={24} /> : faqUi.ask}
              </Button>
            </Box>
            {helpError && <Alert severity="error" onClose={() => setHelpError('')} sx={{ mt: 2 }}>{helpError}</Alert>}
            {helpAnswer && (
              <Typography variant="body2" sx={{ mt: 2, whiteSpace: 'pre-wrap' }}>{helpAnswer}</Typography>
            )}
          </Box>
        )}

        <Box sx={{ mt: 8, p: 4, bgcolor: 'background.paper', borderRadius: 2, textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom>
            {faqUi.still_title}
          </Typography>
          <Typography variant="body2" color="textSecondary" paragraph>
            {faqUi.still_body}
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
                {faqUi.contact_link}
              </Typography>
            </Link>
          </Box>
        </Box>
      </Container>
    </PageShell>
  );
};
