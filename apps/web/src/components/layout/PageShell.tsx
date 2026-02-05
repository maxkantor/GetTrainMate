/**
 * PageShell – reusable layout for form/info pages (login, signup, pricing, onboarding, faq, terms, privacy, contact).
 * Re-exports SecondaryPageLayout so one component name is used everywhere.
 */
import { SecondaryPageLayout, type SecondaryPageVariant } from './SecondaryPageLayout';

export type { SecondaryPageVariant };

export interface PageShellProps {
  variant: SecondaryPageVariant;
  title?: string;
  subtitle?: string;
  showBackLink?: boolean;
  children: React.ReactNode;
}

export const PageShell: React.FC<PageShellProps> = (props) => {
  return <SecondaryPageLayout {...props} />;
};
