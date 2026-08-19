import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GROWTH_SSM_MAP } from '../load-ssm-secrets-into-env.mjs';

describe('growth SSM paths', () => {
  it('reads Meta and other growth secrets only from /gettrainmate, never /prod', () => {
    assert.ok(GROWTH_SSM_MAP.length > 0);
    for (const [envName, names] of GROWTH_SSM_MAP) {
      assert.ok(envName);
      for (const name of names) {
        assert.match(name, /^\/gettrainmate\//);
        assert.doesNotMatch(name, /^\/prod\//);
      }
    }
    const meta = GROWTH_SSM_MAP.filter(([env]) =>
      /META_PAGE|FACEBOOK_PAGE|INSTAGRAM_/.test(env)
    );
    assert.ok(meta.length >= 3);
    for (const [, names] of meta) {
      for (const name of names) {
        assert.match(name, /^\/gettrainmate\/growth\//);
      }
    }
  });
});
