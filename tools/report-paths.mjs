// Shared path, Cucumber URI, and CLI resolution helpers for parity and report tooling (Risk #3).
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

const MARKER = 'features-shared/';
const KEYWORD = { Context: 'Given', Action: 'When', Outcome: 'Then' };

/**
 * Given/When/Then from the pickle step types, with "And" for repeats.
 */
export function withKeywords(steps) {
    let previous;
    return steps.map((step) => {
        const keyword = KEYWORD[step.type] ?? '*';
        const shown = keyword === previous ? 'And' : keyword;
        previous = keyword;
        return `${shown} ${step.text}`;
    });
}

/**
 * Normalises a Cucumber pickle URI (Windows backslashes or POSIX forward slashes,
 * relative or absolute) to its canonical slash-separated relative key beneath
 * `features-shared/`, e.g. `domain-rules/age-eligibility.feature`.
 *
 * Preserves filename case and spaces. Does not perform filesystem resolution.
 * Rejects missing, empty, or malformed URIs with a descriptive Error.
 */
export function featureRelativePath(uri) {
    if (typeof uri !== 'string' || !uri.trim()) {
        throw new Error(`Invalid feature URI: expected non-empty string, received ${JSON.stringify(uri)}`);
    }
    const normalised = uri.replace(/\\/g, '/').replace(/\/+/g, '/');
    const boundaryMatch = /(?:^|\/)features-shared\/(.+)$/.exec(normalised);
    if (!boundaryMatch) {
        throw new Error(`Invalid feature URI "${uri}": missing "${MARKER}" path segment`);
    }
    const rel = boundaryMatch[1];
    const parts = rel.split('/');
    if (parts.length !== 2 || !parts[0] || !parts[1] || parts.includes('.') || parts.includes('..') || !parts[1].endsWith('.feature') || parts[1] === '.feature') {
        throw new Error(`Invalid feature URI "${uri}": expected "<folder>/<name>.feature" beneath "${MARKER}", got "${rel}"`);
    }
    return rel;
}

/**
 * Decomposes a Cucumber pickle URI into its canonical relative path, first folder,
 * filename, and feature slug (filename without `.feature`).
 */
export function featureFolderAndFile(uri) {
    const path = featureRelativePath(uri);
    const [folder, file] = path.split('/');
    const feature = file.slice(0, -'.feature'.length);
    return { path, folder, file, feature };
}

/**
 * Exact match on the first folder beneath `features-shared/`.
 */
export function isFeatureInFolder(uri, targetFolder) {
    return featureFolderAndFile(uri).folder === targetFolder;
}

/**
 * Plants a `(tampered)` suffix on the final step of the first pickle in `ndjsonText`
 * whose feature resides in `targetFolder` (default `domain-rules`).
 *
 * Extracted as a pure function so unit tests can verify negative-check selection
 * on Windows backslash and POSIX slash NDJSON streams without invoking Java.
 */
export function tamperFirstFolderPickleInNdjson(ndjsonText, targetFolder = 'domain-rules') {
    const lines = ndjsonText.split('\n');
    let planted = null;
    for (let i = 0; i < lines.length && !planted; i++) {
        const trimmed = lines[i].trim();
        if (!trimmed.startsWith('{"pickle"')) continue;
        const m = JSON.parse(trimmed);
        if (!m.pickle || !isFeatureInFolder(m.pickle.uri, targetFolder)) continue;
        const shown = withKeywords(m.pickle.steps);
        const index = m.pickle.steps.length - 1;
        const before = shown[index];
        m.pickle.steps[index].text = `${m.pickle.steps[index].text} (tampered)`;
        planted = {
            scenario: m.pickle.name,
            uri: m.pickle.uri,
            featurePath: featureRelativePath(m.pickle.uri),
            before,
            after: `${before} (tampered)`,
        };
        lines[i] = JSON.stringify(m);
    }
    return { content: lines.join('\n'), planted };
}

/**
 * Resolves the local `@serenity-js/serenity-bdd` CLI script path without `npx` or a shell.
 */
export function resolveSerenityBddCliPath(fromUrl = import.meta.url) {
    const require = createRequire(fromUrl);
    let pkgJsonPath;
    try {
        pkgJsonPath = require.resolve('@serenity-js/serenity-bdd/package.json');
    } catch {
        const entryPath = require.resolve('@serenity-js/serenity-bdd');
        pkgJsonPath = resolve(dirname(entryPath), '..', 'package.json');
    }
    const pkgDir = dirname(pkgJsonPath);
    const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
    const binRel = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.['serenity-bdd'];
    if (!binRel) {
        throw new Error(`@serenity-js/serenity-bdd at ${pkgJsonPath} does not declare a "serenity-bdd" bin entry`);
    }
    const cliPath = resolve(pkgDir, binRel);
    if (!existsSync(cliPath)) {
        throw new Error(`Resolved @serenity-js/serenity-bdd CLI does not exist at ${cliPath}`);
    }
    return cliPath;
}

/**
 * Guards recursive directory deletion so computed paths cannot escape the intended parent root.
 */
export function assertSafeSubpath(parentDir, targetDir) {
    const resolvedParent = resolve(parentDir);
    const resolvedTarget = resolve(targetDir);
    const rel = relative(resolvedParent, resolvedTarget);
    if (!rel || rel.startsWith('..') || isAbsolute(rel)) {
        throw new Error(`Refusing to delete "${resolvedTarget}": not a child directory of "${resolvedParent}"`);
    }
    return resolvedTarget;
}
