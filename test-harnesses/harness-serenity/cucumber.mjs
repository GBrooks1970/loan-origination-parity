const common = {
    import: ['src/support/**/*.ts', 'src/step-definitions/**/*.ts'],
    // Cucumber allows one stdout formatter: it must be Serenity's, or no scene events fire and
    // actors (with their per-scenario abilities) are never dismissed. Serenity's ConsoleReporter prints results.
    format: ['@serenity-js/cucumber'],
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

const allFolders = [
    '../../features-shared/domain-rules/**/*.feature',
    '../../features-shared/workflows/**/*.feature',
    '../../features-shared/ui-only/**/*.feature',
];

/** Browser surfaces run every folder (spec §10.1). */
export const angular = {
    ...common,
    paths: allFolders,
    format: [...common.format, 'message:reports/angular.ndjson'],
};

export const nextjs = {
    ...common,
    paths: allFolders,
    format: [...common.format, 'message:reports/nextjs.ndjson'],
};

export default core;
