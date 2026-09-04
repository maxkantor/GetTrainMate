import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  adminEmailSentKey,
  claimAdminEmailDay,
  finalizeAdminEmailDay,
  readAdminEmailDayMarker
} from '../lib/admin-email-day-guard.mjs';

describe('admin email day guard', () => {
  it('builds dated s3 key', () => {
    assert.equal(adminEmailSentKey('2026-09-04'), 'growth/admin-email-sent/2026-09-04.json');
  });

  it('claims once then rejects second claim', () => {
    const store = new Map();
    const aws = (args) => {
      const cmd = args[0];
      if (cmd === 's3api' && args[1] === 'put-object') {
        const bucket = args[args.indexOf('--bucket') + 1];
        const key = args[args.indexOf('--key') + 1];
        const bodyPath = args[args.indexOf('--body') + 1];
        const ifNone = args.includes('--if-none-match');
        const storeKey = `${bucket}/${key}`;
        if (ifNone && store.has(storeKey)) {
          return { status: 1, stderr: 'An error occurred (PreconditionFailed)', stdout: '' };
        }
        store.set(storeKey, fs.readFileSync(bodyPath, 'utf8'));
        return { status: 0, stderr: '', stdout: '' };
      }
      if (cmd === 's3api' && args[1] === 'get-object') {
        const bucket = args[args.indexOf('--bucket') + 1];
        const key = args[args.indexOf('--key') + 1];
        const outFile = args[args.length - 1];
        const storeKey = `${bucket}/${key}`;
        if (!store.has(storeKey)) {
          return { status: 1, stderr: 'NoSuchKey', stdout: '' };
        }
        fs.writeFileSync(outFile, store.get(storeKey));
        return { status: 0, stderr: '', stdout: '' };
      }
      return { status: 1, stderr: `unexpected ${args.join(' ')}`, stdout: '' };
    };

    const isoDate = '2099-01-02';
    const bucket = 'test-media-bucket';
    const a = claimAdminEmailDay({ isoDate, bucket, aws, claimId: 'a1' });
    assert.equal(a.ok, true);
    assert.equal(a.claimed, true);

    const b = claimAdminEmailDay({ isoDate, bucket, aws, claimId: 'b2' });
    assert.equal(b.ok, true);
    assert.equal(b.claimed, false);
    assert.equal(b.marker?.claimId, 'a1');

    const fin = finalizeAdminEmailDay({
      isoDate,
      bucket,
      aws,
      claimId: 'a1',
      messageId: 'mid-1',
      subject: 'GetTrainMate Growth — test'
    });
    assert.equal(fin.ok, true);
    assert.equal(fin.marker.messageId, 'mid-1');

    const read = readAdminEmailDayMarker({ isoDate, bucket, aws });
    assert.equal(read.marker?.status, 'sent');
    assert.equal(read.marker?.messageId, 'mid-1');
  });
});
