'use strict';

const { updateTrialConfigSchema } = require('../../validations/trialConfigValidation');

const validate = (value) => updateTrialConfigSchema.validate({ trialConfig: { kyc_max_rejections: value } });

describe('updateTrialConfigSchema — kyc_max_rejections', () => {
    test.each([1, 3, 10])('accepts %p', (v) => {
        expect(validate(v).error).toBeUndefined();
    });

    test.each([0, -1, 11, 2.5, 'abc'])('rejects %p', (v) => {
        expect(validate(v).error).toBeDefined();
    });
});
