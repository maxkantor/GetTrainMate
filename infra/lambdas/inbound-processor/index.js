/**
 * GetTrainMate SES inbound processor (Lambda).
 *
 * Invoked by the SES receipt rule for partners@gettrainmate.com. For each
 * delivered message, fetches the raw MIME from the inbound S3 bucket
 * (SES stores it under key = SES messageId) and POSTs it to the API's
 * internal inbound endpoint, where IngestInboundAsync records it in the
 * CRM (thread match, reply status, admin notification).
 *
 * Env:
 *   INBOUND_BUCKET           S3 bucket holding SES-stored messages
 *   API_BASE_URL             API Gateway base URL, e.g. https://xxx.execute-api.us-east-1.amazonaws.com
 *   INBOUND_TOKEN_SSM_PARAM  SSM parameter holding the X-Partner-Email-Token
 *                            (default /gettrainmate/partner/internal-token)
 *
 * The token is read from SSM at runtime (never baked into env or code).
 * A failed POST is reported as a failed record: SES does not retry a
 * failed Lambda action, but the message stays in S3 under its messageId,
 * so a failed record can be re-driven by invoking this function again
 * with the same SES event.
 */

const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');

const TOKEN_PARAM =
  process.env.INBOUND_TOKEN_SSM_PARAM || '/gettrainmate/partner/internal-token';
const AWS_REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';

let cachedToken = null;

function messageIdsFromEvent(event) {
  const records = (event && event.Records) || [];
  return records
    .map((r) => r && r.ses && r.ses.mail && r.ses.mail.messageId)
    .filter((id) => typeof id === 'string' && id.length > 0);
}

async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf-8');
}

async function getToken(ssm) {
  if (cachedToken) return cachedToken;
  const resp = await ssm.send(
    new GetParameterCommand({ Name: TOKEN_PARAM, WithDecryption: true }),
  );
  cachedToken = (resp.Parameter && resp.Parameter.Value || '').trim();
  if (!cachedToken) throw new Error(`SSM parameter ${TOKEN_PARAM} is empty`);
  return cachedToken;
}

function createHandler({ s3, ssm, fetchImpl, bucket, apiBaseUrl }) {
  const inboundBucket = bucket || process.env.INBOUND_BUCKET || '';
  const resolvedApiBaseUrl = (apiBaseUrl || process.env.API_BASE_URL || '').replace(/\/$/, '');
  return async (event) => {
    const ids = messageIdsFromEvent(event);
    const results = [];
    for (const messageId of ids) {
      try {
        if (!inboundBucket) throw new Error('INBOUND_BUCKET is not set');
        if (!apiBaseUrl) throw new Error('API_BASE_URL is not set');
        const obj = await s3.send(new GetObjectCommand({ Bucket: inboundBucket, Key: messageId }));
        const rawMime = await streamToString(obj.Body);
        if (!rawMime) throw new Error(`empty S3 object for message ${messageId}`);
        const token = await getToken(ssm);
        const res = await fetchImpl(`${resolvedApiBaseUrl}/api/internal/partner-outreach/inbound`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Partner-Email-Token': token,
          },
          body: JSON.stringify({ rawMime, dedupeKey: `ses:${messageId}` }),
        });
        if (!res.ok) throw new Error(`inbound endpoint returned ${res.status} for ${messageId}`);
        results.push({ messageId, ok: true });
      } catch (err) {
        console.error(`inbound processor failed for ${messageId}:`, err && err.message);
        results.push({ messageId, ok: false, error: err && err.message });
      }
    }
    const failed = results.filter((r) => !r.ok);
    if (failed.length > 0) {
      throw new Error(`inbound processor failed for ${failed.length}/${results.length} message(s): ${failed.map((f) => f.messageId).join(', ')}`);
    }
    return { ok: true, processed: results.length, results };
  };
}

const handler = createHandler({
  s3: new S3Client({ region: AWS_REGION }),
  ssm: new SSMClient({ region: AWS_REGION }),
  fetchImpl: fetch,
});

module.exports = { handler, createHandler, messageIdsFromEvent, _resetTokenCache: () => { cachedToken = null; } };
