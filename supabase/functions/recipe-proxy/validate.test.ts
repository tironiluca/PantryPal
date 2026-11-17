import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BlockedUrlError, isAcceptableContentType, isPrivateAddress, parseRecipeUrl } from './validate.ts';

test('accepts public http(s) recipe URLs', () => {
  assert.equal(parseRecipeUrl('https://www.example.com/recipes/soup?x=1').hostname, 'www.example.com');
  assert.equal(parseRecipeUrl('http://example.com:80/a').hostname, 'example.com');
});

test('rejects missing, malformed and non-web URLs', () => {
  for (const raw of [undefined, '', 'not a url', 'ftp://example.com/a', 'file:///etc/passwd', 'javascript:alert(1)', 'x'.repeat(3000)]) {
    assert.throws(() => parseRecipeUrl(raw), BlockedUrlError, String(raw).slice(0, 40));
  }
});

test('rejects credentials and non-default ports', () => {
  assert.throws(() => parseRecipeUrl('https://user:pw@example.com/'), BlockedUrlError);
  assert.throws(() => parseRecipeUrl('https://example.com:8443/'), BlockedUrlError);
});

test('rejects local and private hosts given literally', () => {
  for (const raw of [
    'http://localhost/', 'http://api.localhost/', 'http://printer.local/', 'http://metadata.internal/',
    'http://127.0.0.1/', 'http://10.1.2.3/', 'http://172.16.0.1/', 'http://192.168.1.10/', 'http://169.254.169.254/latest/meta-data',
    'http://100.64.0.1/', 'http://0.0.0.0/', 'http://[::1]/', 'http://[fd00::1]/', 'http://[::ffff:127.0.0.1]/',
  ]) {
    assert.throws(() => parseRecipeUrl(raw), BlockedUrlError, raw);
  }
});

test('classifies resolved addresses', () => {
  assert.equal(isPrivateAddress('93.184.216.34'), false);
  assert.equal(isPrivateAddress('2606:2800:220:1:248:1893:25c8:1946'), false);
  assert.equal(isPrivateAddress('172.32.0.1'), false);
  assert.equal(isPrivateAddress('172.31.255.255'), true);
  assert.equal(isPrivateAddress('fe80::1'), true);
  assert.equal(isPrivateAddress('224.0.0.1'), true);
  assert.equal(isPrivateAddress('garbage'), true);
});

test('accepts only HTML-like content types', () => {
  assert.equal(isAcceptableContentType('text/html; charset=utf-8'), true);
  assert.equal(isAcceptableContentType(null), true);
  assert.equal(isAcceptableContentType('image/png'), false);
  assert.equal(isAcceptableContentType('application/octet-stream'), false);
});
