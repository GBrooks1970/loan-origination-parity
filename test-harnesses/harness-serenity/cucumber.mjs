const common = {
    import: ['src/support/**/*.ts', 'src/step-definitions/**/*.ts'],
    format: ['@serenity-js/cucumber', 'summary'],
    strict: true,
};

/** Folder decides reach (DR-006): core runs domain-rules; api adds workflows. */
export const core = {
    ...common,
    paths: ['../../features-shared/domain-rules/**/*.feature'],
    format: [...common.format, 'message:reports/core.ndjson'],
};

export const api = {
    ...common,
    paths: ['../../features-shared/domain-rules/**/*.feature', '../../features-shared/workflows/**/*.feature'],
    format: [...common.format, 'message:reports/api.ndjson'],
};

export default core;
