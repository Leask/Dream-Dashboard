import assert from 'node:assert/strict';
import test from 'node:test';
import { gzipSync } from 'node:zlib';

process.argv.push('--api-key=test-key', '--gateway=127.0.0.1');

const {
    decodeResponseBody,
    listPayload,
    parseJsonBody,
} = await import('../lib/dashboard.mjs');

test('decodeResponseBody inflates gzip bodies without encoding headers', () => {
    const body = '{ "data": [{ "subsystem": "wan" }] }';

    assert.equal(decodeResponseBody(gzipSync(body)), body);
});

test('parseJsonBody parses JSON even without a content type', () => {
    const body = '{ "data": [{ "subsystem": "wan" }] }';

    assert.deepEqual(parseJsonBody(body), {
        data: [{ subsystem: 'wan' }],
    });
});

test('parseJsonBody ignores non-JSON bodies without a content type', () => {
    assert.deepEqual(parseJsonBody('<html>ok</html>'), {});
});

test('listPayload returns top-level arrays', () => {
    assert.deepEqual(listPayload([{ subsystem: 'wan' }], 'data'), [
        { subsystem: 'wan' },
    ]);
});

test('listPayload unwraps known array fields', () => {
    assert.deepEqual(listPayload({ data: [{ subsystem: 'www' }] }, 'data'), [
        { subsystem: 'www' },
    ]);
});

test('listPayload returns an empty list for non-list payloads', () => {
    assert.deepEqual(listPayload({ data: { subsystem: 'wan' } }, 'data'), []);
});
