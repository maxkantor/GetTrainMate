/**
 * Single source of truth for marketing / legal footer links (landing, app compact footer, modals).
 * Labels use i18n keys via `t('key')` in components.
 */
export type FooterLinkDef = { labelKey: string; to: string };

/** Inline row: About, FAQ, Platform, Contact, Privacy, Terms, Pricing */
export const FOOTER_LINKS_COMPACT: FooterLinkDef[] = [
  { labelKey: 'header.about', to: '/about' },
  { labelKey: 'header.faq', to: '/faq' },
  { labelKey: 'footer.platform', to: '/platform' },
  { labelKey: 'header.contact', to: '/contact' },
  { labelKey: 'footer.privacy', to: '/privacy' },
  { labelKey: 'footer.terms', to: '/terms' },
  { labelKey: 'header.pricing', to: '/pricing' },
];

export const FOOTER_SECTIONS: {
  product: FooterLinkDef[];
  company: FooterLinkDef[];
  legal: FooterLinkDef[];
} = {
  product: [
    { labelKey: 'header.faq', to: '/faq' },
    { labelKey: 'header.pricing', to: '/pricing' },
  ],
  company: [
    { labelKey: 'header.about', to: '/about' },
    { labelKey: 'footer.platform', to: '/platform' },
    { labelKey: 'header.contact', to: '/contact' },
  ],
  legal: [
    { labelKey: 'footer.privacy', to: '/privacy' },
    { labelKey: 'footer.terms', to: '/terms' },
  ],
};
