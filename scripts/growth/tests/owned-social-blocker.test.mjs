import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyOwnedSocialBlocker } from '../lib/growth-report.mjs';

describe('classifyOwnedSocialBlocker', () => {
  it('labels Bedrock IAM denial as MEDIA_GENERATION_DENIED', () => {
    const blocker =
      "photo_required:\naws: [ERROR]: An error occurred (AccessDeniedException) when calling the InvokeModel operation: User: arn:aws:iam::718522948657:user/cursor-gettrainmate-growth is not authorized to perform: bedrock:InvokeModel";
    assert.equal(classifyOwnedSocialBlocker(blocker), 'MEDIA_GENERATION_DENIED');
  });

  it('labels creative hard rejects as MEDIA_GENERATION_FAILED', () => {
    assert.equal(
      classifyOwnedSocialBlocker('photo_required:hard_reject:/\\bnightlife\\b/i'),
      'MEDIA_GENERATION_FAILED'
    );
  });

  it('labels Meta token expiry as META_AUTHENTICATION_FAILED', () => {
    assert.equal(
      classifyOwnedSocialBlocker('META_TOKEN_EXPIRED · Session has expired · code 190'),
      'META_AUTHENTICATION_FAILED'
    );
  });
});
