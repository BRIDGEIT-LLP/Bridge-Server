'use strict';

const { normalizeEmail } = require('../../utils/Helper');

describe('Helper.normalizeEmail', () => {
    test('trims and lower-cases', () => {
        expect(normalizeEmail('  Founder@Acme.IO ')).toBe('founder@acme.io');
    });

    test('collapses gmail dots, +suffix and googlemail.com', () => {
        expect(normalizeEmail('A.b.C+promo@Gmail.com')).toBe('abc@gmail.com');
        expect(normalizeEmail('abc@googlemail.com')).toBe('abc@gmail.com');
    });

    test('leaves dots and +suffix alone for non-gmail domains', () => {
        expect(normalizeEmail('a.b+x@corp.io')).toBe('a.b+x@corp.io');
    });

    test('returns an empty string for non-strings and passes through malformed input', () => {
        expect(normalizeEmail(undefined)).toBe('');
        expect(normalizeEmail(null)).toBe('');
        expect(normalizeEmail('not-an-email')).toBe('not-an-email');
    });
});
