'use strict';

const { calculateGeoScore } = require('../../matching/geoFilterService');

describe('GeoFilterService — calculateGeoScore()', () => {

    // --- Same country ---
    describe('Same country', () => {
        test('returns 1.0 when both profiles are in the same country', () => {
            const src  = { country: 'India', continent: 'Asia' };
            const cand = { country: 'India', continent: 'Asia' };
            expect(calculateGeoScore(src, cand)).toBe(1.0);
        });

        test('is case-insensitive for country comparison', () => {
            const src  = { country: 'india', continent: 'Asia' };
            const cand = { country: 'INDIA', continent: 'Asia' };
            expect(calculateGeoScore(src, cand)).toBe(1.0);
        });

        test('same country with leading/trailing spaces', () => {
            const src  = { country: '  India  ', continent: 'Asia' };
            const cand = { country: 'India', continent: 'Asia' };
            expect(calculateGeoScore(src, cand)).toBe(1.0);
        });
    });

    // --- Same continent ---
    describe('Same continent', () => {
        test('returns 0.6 when countries differ but continents match', () => {
            const src  = { country: 'India', continent: 'Asia' };
            const cand = { country: 'China', continent: 'Asia' };
            expect(calculateGeoScore(src, cand)).toBe(0.6);
        });

        test('is case-insensitive for continent comparison', () => {
            const src  = { country: 'India', continent: 'asia' };
            const cand = { country: 'China', continent: 'ASIA' };
            expect(calculateGeoScore(src, cand)).toBe(0.6);
        });
    });

    // --- International ---
    describe('International', () => {
        test('returns 0.3 when country and continent both differ', () => {
            const src  = { country: 'India', continent: 'Asia' };
            const cand = { country: 'USA',   continent: 'North America' };
            expect(calculateGeoScore(src, cand)).toBe(0.3);
        });

        test('returns 0.3 when both are fully international without export readiness', () => {
            const src  = { country: 'Germany', continent: 'Europe' };
            const cand = { country: 'Brazil',  continent: 'South America' };
            expect(calculateGeoScore(src, cand)).toBe(0.3);
        });
    });

    // --- Export-ready international bonus ---
    describe('Export-readiness bonus (international)', () => {
        test('returns 0.5 when candidate is export-ready and international', () => {
            const src  = { country: 'India',     continent: 'Asia',   export_rediness: null };
            const cand = { country: 'Germany',   continent: 'Europe', export_rediness: 'yes' };
            expect(calculateGeoScore(src, cand)).toBe(0.5);
        });

        test('returns 0.5 when source is export-ready and international', () => {
            const src  = { country: 'India',   continent: 'Asia',   export_rediness: 'yes' };
            const cand = { country: 'Germany', continent: 'Europe', export_rediness: 'no' };
            expect(calculateGeoScore(src, cand)).toBe(0.5);
        });

        test('export-ready bonus does NOT override same-country score', () => {
            const src  = { country: 'India', continent: 'Asia', export_rediness: 'yes' };
            const cand = { country: 'India', continent: 'Asia', export_rediness: 'yes' };
            expect(calculateGeoScore(src, cand)).toBe(1.0);
        });

        test('export-ready bonus does NOT override same-continent score', () => {
            const src  = { country: 'India', continent: 'Asia', export_rediness: 'yes' };
            const cand = { country: 'Japan', continent: 'Asia', export_rediness: 'yes' };
            expect(calculateGeoScore(src, cand)).toBe(0.6);
        });
    });

    // --- Missing geo data ---
    describe('Missing geo data', () => {
        test('returns 0.5 (neutral) when source has no geo data', () => {
            const src  = { country: '', continent: '' };
            const cand = { country: 'India', continent: 'Asia' };
            expect(calculateGeoScore(src, cand)).toBe(0.5);
        });

        test('returns 0.5 (neutral) when candidate has no geo data', () => {
            const src  = { country: 'India', continent: 'Asia' };
            const cand = { country: '',      continent: '' };
            expect(calculateGeoScore(src, cand)).toBe(0.5);
        });

        test('returns 0.5 (neutral) when both have no geo data', () => {
            const src  = { country: null, continent: null };
            const cand = { country: null, continent: null };
            expect(calculateGeoScore(src, cand)).toBe(0.5);
        });
    });
});
