#!/usr/bin/env node
/**
 * DISABLED. Partner outreach must use:
 *   npm run growth:outreach:preview
 *   npm run growth:outreach:validate
 *   npm run growth:outreach:send -- --approval-id <id> --send
 *
 * This file never sends mail.
 */
console.error(
  JSON.stringify({
    ok: false,
    sent: false,
    error: 'partner_outreach_send_disabled',
    message: 'Automatic partner outreach is stopped. Use gated outreach.mjs with --send and PARTNER_OUTREACH_SEND_ENABLED=true.'
  })
);
process.exit(2);
