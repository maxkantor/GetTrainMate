#!/usr/bin/env node
/**
 * One-shot production verification: send a Max-only test with config set + gtm_mid,
 * then wait for SES DELIVERY → SNS → ApplySesEvent to mark the CRM queue row delivered.
 * Does not raise campaign send limits or email real prospects.
 */
import {
  SESClient,
  SendRawEmailCommand
} from '@aws-sdk/client-ses';
import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  DeleteItemCommand
} from '@aws-sdk/client-dynamodb';
import { randomBytes } from 'node:crypto';

const REGION = 'us-east-1';
const CONFIG_SET = 'gettrainmate-partner-outreach';
const FROM = 'partners@gettrainmate.com';
const TO = process.env.SES_ADMIN_EMAIL || 'mykantor@bellsouth.net';
const mid = 'po_e2e' + randomBytes(6).toString('hex');
const queueId = 'e2e-delivery-' + mid;
const boundary = 'gtm' + randomBytes(8).toString('hex');

const ses = new SESClient({ region: REGION });
const ddb = new DynamoDBClient({ region: REGION });

const raw = [
  `From: Max from GetTrainMate <${FROM}>`,
  `To: ${TO}`,
  `Subject: [TEST] GetTrainMate SES delivery tracking ${mid}`,
  'MIME-Version: 1.0',
  `Content-Type: multipart/alternative; boundary="${boundary}"`,
  `X-SES-CONFIGURATION-SET: ${CONFIG_SET}`,
  `X-GetTrainMate-MessageId: ${mid}`,
  `X-SES-MESSAGE-TAGS: gtm_mid=${mid}`,
  '',
  `--${boundary}`,
  'Content-Type: text/plain; charset=UTF-8',
  '',
  `Delivery tracking verification for ${mid}. Safe to ignore.`,
  `--${boundary}--`,
  ''
].join('\r\n');

await ddb.send(
  new PutItemCommand({
    TableName: 'gettrainmate-partner-queue',
    Item: {
      QueueId: { S: queueId },
      ProspectId: { S: 'e2e-delivery-prospect' },
      CampaignId: { S: 'e2e_delivery_tracking' },
      Recipient: { S: TO },
      OrganizationName: { S: 'SES Delivery E2E' },
      Subject: { S: `[TEST] GetTrainMate SES delivery tracking ${mid}` },
      BodyText: { S: 'e2e' },
      BodyHtml: { S: '<p>e2e</p>' },
      Status: { S: 'sent' },
      InternalMessageId: { S: mid },
      SentAt: { S: new Date().toISOString() },
      CreatedAt: { S: new Date().toISOString() },
      FollowUpNumber: { N: '0' },
      MessageVersion: { N: '1' },
      IdempotencyKey: { S: `e2e:${mid}` }
    }
  })
);

const send = await ses.send(
  new SendRawEmailCommand({
    Source: FROM,
    Destinations: [TO],
    ConfigurationSetName: CONFIG_SET,
    Tags: [{ Name: 'gtm_mid', Value: mid }],
    RawMessage: { Data: Buffer.from(raw, 'utf8') }
  })
);

const sesMessageId = send.MessageId;
await ddb.send(
  new PutItemCommand({
    TableName: 'gettrainmate-partner-queue',
    Item: {
      QueueId: { S: queueId },
      ProspectId: { S: 'e2e-delivery-prospect' },
      CampaignId: { S: 'e2e_delivery_tracking' },
      Recipient: { S: TO },
      OrganizationName: { S: 'SES Delivery E2E' },
      Subject: { S: `[TEST] GetTrainMate SES delivery tracking ${mid}` },
      BodyText: { S: 'e2e' },
      BodyHtml: { S: '<p>e2e</p>' },
      Status: { S: 'sent' },
      InternalMessageId: { S: mid },
      SesMessageId: { S: sesMessageId },
      SentAt: { S: new Date().toISOString() },
      CreatedAt: { S: new Date().toISOString() },
      FollowUpNumber: { N: '0' },
      MessageVersion: { N: '1' },
      IdempotencyKey: { S: `e2e:${mid}` }
    }
  })
);

console.log(
  JSON.stringify(
    {
      phase: 'accepted',
      queueId,
      internalMessageId: mid,
      sesMessageId,
      to: TO,
      configurationSet: CONFIG_SET
    },
    null,
    2
  )
);

const deadline = Date.now() + 120_000;
let status = 'sent';
while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 4000));
  const got = await ddb.send(
    new GetItemCommand({
      TableName: 'gettrainmate-partner-queue',
      Key: { QueueId: { S: queueId } },
      ConsistentRead: true
    })
  );
  status = got.Item?.Status?.S || 'missing';
  console.log(JSON.stringify({ phase: 'poll', status, at: new Date().toISOString() }));
  if (status === 'delivered') break;
}

const cleanup = process.env.KEEP_E2E_ROW === '1' ? false : status === 'delivered';
if (cleanup) {
  await ddb.send(
    new DeleteItemCommand({
      TableName: 'gettrainmate-partner-queue',
      Key: { QueueId: { S: queueId } }
    })
  );
}

const result = {
  ok: status === 'delivered',
  queueId,
  internalMessageId: mid,
  sesMessageId,
  finalStatus: status,
  cleanedUp: cleanup,
  evidence:
    status === 'delivered'
      ? 'CRM queue Status transitioned sent→delivered after SES DELIVERY event (not acceptance alone)'
      : 'Timed out waiting for delivered — check Lambda logs / SNS / SES event destination'
};
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 2);
