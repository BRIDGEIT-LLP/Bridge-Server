'use strict';

const { createMeetingSchema, updateMeetingSchema } = require('../../validations/meetingValidation');

const futureIso = () => new Date(Date.now() + 60 * 60 * 1000).toISOString();

const baseCreate = () => ({
    dealRoomId: '11111111-1111-1111-1111-111111111111',
    recipientUserId: '550e8400-e29b-41d4-a716-446655440000',
    title: 'Q4 Strategy Review',
    duration: '30m',
    scheduledAt: futureIso()
});

describe('meetingValidation meetingLink', () => {
    test('accepts a URL with a "." and a character after it', () => {
        const { error } = createMeetingSchema.validate({
            ...baseCreate(),
            meetingLink: 'https://meet.google.com/abc-defg-hij'
        });
        expect(error).toBeUndefined();
    });

    test('rejects a URL with no "."', () => {
        const { error } = createMeetingSchema.validate({
            ...baseCreate(),
            meetingLink: 'https://localhost/meeting'
        });
        expect(error).toBeTruthy();
        expect(error.details[0].message).toMatch(/at least one dot/);
    });

    test('accepts a URL with at least one "." + character pair, even with a trailing "."', () => {
        const { error } = createMeetingSchema.validate({
            ...baseCreate(),
            meetingLink: 'https://meet.google.com.'
        });
        expect(error).toBeUndefined();
    });

    test('rejects a URL whose only "." has no character after it', () => {
        const { error } = createMeetingSchema.validate({
            ...baseCreate(),
            meetingLink: 'https://meet.'
        });
        expect(error).toBeTruthy();
        expect(error.details[0].message).toMatch(/at least one dot/);
    });

    test('applies the same rule on update when meetingLink is sent', () => {
        const { error } = updateMeetingSchema.validate({ meetingLink: 'https://example' });
        expect(error).toBeTruthy();
        expect(error.details[0].message).toMatch(/at least one dot/);
    });
});
