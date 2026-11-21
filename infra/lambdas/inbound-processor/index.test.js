const test = require('node:test');
const assert = require('node:assert/strict');

const { createHandler, messageIdsFromEvent } = require('./index.js');

const RAW_MIME =
  'From: partner@example.com\r\nTo: partners@gettrainmate.com\r\nSubject: Re: pilot\r\n\r\nSounds good.';

function fakeS3(bodyByKey) {
  return {
    sent: [],
    async send(cmd) {
      this.sent.push(cmd);
      const key = cmd.input.Key;
      if (!(key in bodyByKey)) {
        const err = new Error(`NoSuchKey ${key}`);
        err.name = 'NoSuchKey';
        throw err;
      }
      const { Readable } = require('node:stream');
      return { Body: Readable.from([Buffer.from(bodyByKey[key], 'utf-8')]) };
    },
  };
}

function fakeSsm(token) {
  return {
    async send() {
      return { Parameter: { Value: token } };
    },
  };
}

test('messageIdsFromEvent extracts SES message ids', () => {
  const event = {
    Records: [
      { ses: { mail: { messageId: 'abc-1' } } },
      { ses: { mail: { messageId: 'abc-2' } } },
      { ses: { mail: {} } },
      {},
    ],
  };
  assert.deepEqual(messageIdsFromEvent(event), ['abc-1', 'abc-2']);
  assert.deepEqual(messageIdsFromEvent({}), []);
});

test('handler fetches from S3 by messageId and POSTs raw MIME with dedupe key', async () => {
  const posts = [];
  const handler = createHandler({
    bucket: 'gettrainmate-partner-inbound',
    apiBaseUrl: 'https://api.example.invalid',

    s3: fakeS3({ 'abc-1': RAW_MIME }),
    ssm: fakeSsm('tok-123'),
    fetchImpl: async (url, opts) => {
      posts.push({ url, opts });
      return { ok: true, status: 200 };
    },
  });
  const result = await handler({ Records: [{ ses: { mail: { messageId: 'abc-1' } } }] });
  assert.equal(result.ok, true);
  assert.equal(result.processed, 1);
  assert.equal(posts.length, 1);
  assert.match(posts[0].url, /\/api\/internal\/partner-outreach\/inbound$/);
  assert.equal(posts[0].opts.headers['X-Partner-Email-Token'], 'tok-123');
  const body = JSON.parse(posts[0].opts.body);
  assert.equal(body.rawMime, RAW_MIME);
  assert.equal(body.dedupeKey, 'ses:abc-1');
});

test('handler throws when the API rejects the POST (message stays in S3 for re-drive)', async () => {
  const handler = createHandler({
    bucket: 'gettrainmate-partner-inbound',
    apiBaseUrl: 'https://api.example.invalid',

    s3: fakeS3({ 'abc-1': RAW_MIME }),
    ssm: fakeSsm('tok-123'),
    fetchImpl: async () => ({ ok: false, status: 401 }),
  });
  await assert.rejects(
    handler({ Records: [{ ses: { mail: { messageId: 'abc-1' } } }] }),
    /failed for 1\/1/,
  );
});

test('handler throws when the S3 object is missing', async () => {
  const handler = createHandler({
    bucket: 'gettrainmate-partner-inbound',
    apiBaseUrl: 'https://api.example.invalid',

    s3: fakeS3({}),
    ssm: fakeSsm('tok-123'),
    fetchImpl: async () => ({ ok: true, status: 200 }),
  });
  await assert.rejects(
    handler({ Records: [{ ses: { mail: { messageId: 'gone' } } }] }),
    /failed for 1\/1/,
  );
});

test('handler uses API_BASE_URL from the environment when no apiBaseUrl is injected (production path)', async () => {
  // Regression test for the Nov 21 E2E failure: production never passes
  // apiBaseUrl, so the guard must read the resolved value (env fallback),
  // not the injected param. Without that, every real invocation threw
  // "API_BASE_URL is not set" while these tests passed.
  const posts = [];
  const prev = process.env.API_BASE_URL;
  process.env.API_BASE_URL = 'https://api.example.invalid';
  try {
    const handler = createHandler({
      bucket: 'gettrainmate-partner-inbound',
      s3: fakeS3({ 'abc-1': RAW_MIME }),
      ssm: fakeSsm('tok-123'),
      fetchImpl: async (url, opts) => {
        posts.push({ url, opts });
        return { ok: true, status: 200 };
      },
    });
    const result = await handler({ Records: [{ ses: { mail: { messageId: 'abc-1' } } }] });
    assert.equal(result.ok, true);
    assert.equal(result.processed, 1);
    assert.equal(posts.length, 1);
    assert.match(posts[0].url, /^https:\/\/api\.example\.invalid\/api\/internal\/partner-outreach\/inbound$/);
  } finally {
    if (prev === undefined) delete process.env.API_BASE_URL;
    else process.env.API_BASE_URL = prev;
  }
});
