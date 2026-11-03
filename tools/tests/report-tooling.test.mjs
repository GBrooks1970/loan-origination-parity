// Unit and integration tests for portable parity and report tooling (Risk #3).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
    assertSafeSubpath,
    featureFolderAndFile,
    featureRelativePath,
    isFeatureInFolder,
    resolveSerenityBddCliPath,
    tamperFirstFolderPickleInNdjson,
    withKeywords,
} from '../report-paths.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const realReportsDir = join(root, 'test-harnesses/harness-serenity/reports');

describe('report-paths.mjs — URL conversion & safe subpath guards', () => {
    it('fileURLToPath decodes spaces and avoids Windows doubled-drive paths unlike URL.pathname', () => {
        const tempParent = mkdtempSync(join(tmpdir(), 'lop space root '));
        try {
            const subDir = join(tempParent, 'child folder');
            mkdirSync(subDir);
            const url = pathToFileURL(subDir);
            const converted = fileURLToPath(url);
            assert.equal(converted, subDir);
            assert.equal(existsSync(converted), true);
            assert.equal(converted.includes('%20'), false);
        } finally {
            assertSafeSubpath(tmpdir(), tempParent);
            rmSync(tempParent, { recursive: true, force: true });
        }
    });

    it('assertSafeSubpath allows child paths and rejects parent/root escapes', () => {
        const base = join(tmpdir(), 'lop-safe-root');
        const validChild = join(base, 'nested', 'report');
        assert.equal(assertSafeSubpath(base, validChild), validChild);
        assert.throws(() => assertSafeSubpath(base, base), /Refusing to delete/);
        assert.throws(() => assertSafeSubpath(base, join(base, '..')), /Refusing to delete/);
        assert.throws(() => assertSafeSubpath(base, join(base, '..', 'other')), /Refusing to delete/);
    });
});

describe('report-paths.mjs — portable Cucumber feature URI contract', () => {
    it('produces identical keys, folders, and feature slugs for Windows backslash and POSIX slash URIs', () => {
        const cases = [
            {
                winRel: '..\\..\\features-shared\\domain-rules\\age-eligibility.feature',
                winAbs: 'D:\\repo with spaces\\loan-origination-parity\\features-shared\\domain-rules\\age-eligibility.feature',
                posixRel: '../../features-shared/domain-rules/age-eligibility.feature',
                posixDirect: 'features-shared/domain-rules/age-eligibility.feature',
                posixAbs: '/workspace/loan origination/features-shared/domain-rules/age-eligibility.feature',
                expected: {
                    path: 'domain-rules/age-eligibility.feature',
                    folder: 'domain-rules',
                    file: 'age-eligibility.feature',
                    feature: 'age-eligibility',
                },
            },
            {
                winRel: '..\\..\\features-shared\\workflows\\Decision Audit Trail.feature',
                winAbs: 'C:\\Users\\Dev User\\Work\\features-shared\\workflows\\Decision Audit Trail.feature',
                posixRel: '../../features-shared/workflows/Decision Audit Trail.feature',
                posixDirect: 'features-shared/workflows/Decision Audit Trail.feature',
                posixAbs: '/home/dev user/features-shared/workflows/Decision Audit Trail.feature',
                expected: {
                    path: 'workflows/Decision Audit Trail.feature',
                    folder: 'workflows',
                    file: 'Decision Audit Trail.feature',
                    feature: 'Decision Audit Trail',
                },
            },
            {
                winRel: '..\\..\\features-shared\\ui-only\\Applicant_Form.feature',
                winAbs: 'E:\\ci\\features-shared\\ui-only\\Applicant_Form.feature',
                posixRel: '../../features-shared/ui-only/Applicant_Form.feature',
                posixDirect: 'features-shared/ui-only/Applicant_Form.feature',
                posixAbs: '/var/ci/features-shared/ui-only/Applicant_Form.feature',
                expected: {
                    path: 'ui-only/Applicant_Form.feature',
                    folder: 'ui-only',
                    file: 'Applicant_Form.feature',
                    feature: 'Applicant_Form',
                },
            },
        ];

        for (const c of cases) {
            for (const variant of [c.winRel, c.winAbs, c.posixRel, c.posixDirect, c.posixAbs]) {
                assert.equal(featureRelativePath(variant), c.expected.path);
                assert.deepEqual(featureFolderAndFile(variant), c.expected);
                assert.equal(isFeatureInFolder(variant, c.expected.folder), true);
                assert.equal(isFeatureInFolder(variant, 'other-folder'), false);
            }
        }
    });

    it('rejects missing, empty, or malformed feature-URI markers and non-boundary substring matches', () => {
        const invalidUris = [
            '',
            '   ',
            null,
            undefined,
            'domain-rules/age-eligibility.feature',
            'not-features-shared/domain-rules/age-eligibility.feature',
            'features-shared/age-eligibility.feature',
            'features-shared/domain-rules/nested/age-eligibility.feature',
            'features-shared/domain-rules/age-eligibility.txt',
            'features-shared/domain-rules/.feature',
            'features-shared/../domain-rules/age-eligibility.feature',
        ];
        for (const bad of invalidUris) {
            assert.throws(() => featureRelativePath(bad), /Invalid feature URI/);
        }
        // Ensure exact first-folder matching: a file in workflows named domain-rules.feature is NOT in domain-rules folder
        assert.equal(
            isFeatureInFolder('..\\..\\features-shared\\workflows\\domain-rules.feature', 'domain-rules'),
            false,
        );
        assert.equal(
            isFeatureInFolder('..\\..\\features-shared\\workflows\\domain-rules.feature', 'workflows'),
            true,
        );
    });

    it('must-fail regression proof: legacy raw string split/includes fails on Windows backslash URIs while shared helper succeeds', () => {
        const windowsUri = '..\\..\\features-shared\\domain-rules\\age-eligibility.feature';
        const legacySplit = windowsUri.split('features-shared/')[1];
        const legacyIncludes = windowsUri.includes('features-shared/domain-rules/');

        assert.equal(legacySplit, undefined, 'legacy split on forward slash must be undefined for Windows backslash URI');
        assert.equal(legacyIncludes, false, 'legacy includes on forward slash must be false for Windows backslash URI');

        assert.equal(featureRelativePath(windowsUri), 'domain-rules/age-eligibility.feature');
        assert.equal(isFeatureInFolder(windowsUri, 'domain-rules'), true);
    });
});

describe('report-paths.mjs — negative-check tamper selection on NDJSON streams', () => {
    it('selects and tampers the first domain-rules pickle regardless of backslash or forward-slash URI separator', () => {
        const samplePickles = [
            {
                pickle: {
                    id: '1',
                    uri: '..\\..\\features-shared\\ui-only\\keyboard-submission.feature',
                    name: 'UI scenario first',
                    steps: [{ type: 'Context', text: 'a signed-in officer' }],
                },
            },
            {
                pickle: {
                    id: '2',
                    uri: '..\\..\\features-shared\\domain-rules\\age-eligibility.feature',
                    name: 'Applicant is 18 today',
                    steps: [
                        { type: 'Context', text: 'an applicant aged 18' },
                        { type: 'Action', text: 'the application is evaluated' },
                        { type: 'Outcome', text: 'the recommendation is "ACCEPT"' },
                    ],
                },
            },
        ];
        const ndjsonBackslash = samplePickles.map((p) => JSON.stringify(p)).join('\n');
        const ndjsonSlash = samplePickles
            .map((p) => JSON.stringify({ pickle: { ...p.pickle, uri: p.pickle.uri.replace(/\\/g, '/') } }))
            .join('\n');

        const resWin = tamperFirstFolderPickleInNdjson(ndjsonBackslash, 'domain-rules');
        const resPosix = tamperFirstFolderPickleInNdjson(ndjsonSlash, 'domain-rules');

        assert.ok(resWin.planted);
        assert.ok(resPosix.planted);
        assert.equal(resWin.planted.scenario, 'Applicant is 18 today');
        assert.equal(resWin.planted.featurePath, 'domain-rules/age-eligibility.feature');
        assert.equal(resWin.planted.before, 'Then the recommendation is "ACCEPT"');
        assert.equal(resWin.planted.after, 'Then the recommendation is "ACCEPT" (tampered)');
        assert.equal(resPosix.planted.scenario, resWin.planted.scenario);
        assert.equal(resPosix.planted.featurePath, resWin.planted.featurePath);
        assert.equal(resPosix.planted.after, resWin.planted.after);
    });

    it('formats Given/When/Then keywords with And for consecutive step types', () => {
        const formatted = withKeywords([
            { type: 'Context', text: 'first context' },
            { type: 'Context', text: 'second context' },
            { type: 'Action', text: 'an action' },
            { type: 'Outcome', text: 'first outcome' },
            { type: 'Outcome', text: 'second outcome' },
        ]);
        assert.deepEqual(formatted, [
            'Given first context',
            'And second context',
            'When an action',
            'Then first outcome',
            'And second outcome',
        ]);
    });
});

describe('Consumer integration — check-parity.mjs with clean, tampered, and missing reports', () => {
    const surfaces = ['core', 'api', 'angular', 'nextjs'];
    const hasRealReports = surfaces.every((s) => existsSync(join(realReportsDir, `${s}.ndjson`)));

    it('passes on clean four-surface reports and fails with DIFFERS when one domain-rules step is tampered', { skip: !hasRealReports }, () => {
        const tempDir = mkdtempSync(join(tmpdir(), 'lop parity check '));
        try {
            for (const s of surfaces) {
                copyFileSync(join(realReportsDir, `${s}.ndjson`), join(tempDir, `${s}.ndjson`));
            }

            // 1. Clean copy must exit 0 with PARITY PASS
            const cleanRun = spawnSync(process.execPath, [join(root, 'tools/check-parity.mjs')], {
                cwd: root,
                encoding: 'utf8',
                env: { ...process.env, PARITY_REPORTS_DIR: tempDir },
            });
            assert.equal(cleanRun.status, 0, `Expected clean parity gate to exit 0, got:\n${cleanRun.stdout}\n${cleanRun.stderr}`);
            assert.match(cleanRun.stdout, /PARITY PASS/);

            // 2. Tamper one domain-rules step in nextjs.ndjson (even if URIs use backslashes or forward slashes)
            const nextjsPath = join(tempDir, 'nextjs.ndjson');
            const { content: tamperedContent, planted } = tamperFirstFolderPickleInNdjson(
                readFileSync(nextjsPath, 'utf8'),
                'domain-rules',
            );
            assert.ok(planted, 'Expected at least one domain-rules scenario in nextjs.ndjson');
            writeFileSync(nextjsPath, tamperedContent);

            const tamperedRun = spawnSync(process.execPath, [join(root, 'tools/check-parity.mjs')], {
                cwd: root,
                encoding: 'utf8',
                env: { ...process.env, PARITY_REPORTS_DIR: tempDir },
            });
            assert.equal(tamperedRun.status, 1, 'Expected tampered parity gate to exit 1');
            const combined = `${tamperedRun.stdout}\n${tamperedRun.stderr}`;
            assert.match(combined, /DIFFERS from core/);
            assert.match(combined, /PARITY FAIL/);
            assert.match(combined, /\(tampered\)/);
        } finally {
            assertSafeSubpath(tmpdir(), tempDir);
            rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it('fails cleanly when a surface report is missing', () => {
        const emptyDir = mkdtempSync(join(tmpdir(), 'lop-missing-reports-'));
        try {
            const missingRun = spawnSync(process.execPath, [join(root, 'tools/check-parity.mjs')], {
                cwd: root,
                encoding: 'utf8',
                env: { ...process.env, PARITY_REPORTS_DIR: emptyDir },
            });
            assert.equal(missingRun.status, 1);
            assert.match(missingRun.stderr, /PARITY FAIL/);
            assert.match(missingRun.stderr, /missing .*core\.ndjson/);
        } finally {
            assertSafeSubpath(tmpdir(), emptyDir);
            rmSync(emptyDir, { recursive: true, force: true });
        }
    });
});

describe('CLI launch contract — shell-free @serenity-js/serenity-bdd resolution', () => {
    it('resolves local bin/serenity-bdd and launches via process.execPath without npx or a shell', () => {
        const cliPath = resolveSerenityBddCliPath(import.meta.url);
        assert.equal(existsSync(cliPath), true);
        assert.match(cliPath.replace(/\\/g, '/'), /@serenity-js\/serenity-bdd\/bin\/serenity-bdd$/);

        const versionResult = spawnSync(process.execPath, [cliPath, '--version'], {
            cwd: root,
            encoding: 'utf8',
        });
        assert.equal(versionResult.error, undefined);
        assert.equal(versionResult.status, 0);
        assert.match(versionResult.stdout.trim(), /^\d+\.\d+\.\d+/);
    });

    it('preserves argument boundaries with spaces and propagates non-zero exit codes without a shell', () => {
        const tempDir = mkdtempSync(join(tmpdir(), 'lop cli args with spaces '));
        try {
            const echoScript = join(tempDir, 'echo-args.mjs');
            writeFileSync(
                echoScript,
                'console.log(JSON.stringify(process.argv.slice(2)));\nprocess.exit(process.argv.includes("--fail") ? 7 : 0);\n',
            );
            const projectTitle = 'Loan Origination Parity: Next.js surface (with spaces & symbols)';
            const okRun = spawnSync(process.execPath, [echoScript, '--project', projectTitle, '--source', tempDir], {
                encoding: 'utf8',
            });
            assert.equal(okRun.status, 0);
            assert.deepEqual(JSON.parse(okRun.stdout.trim()), ['--project', projectTitle, '--source', tempDir]);

            const failRun = spawnSync(process.execPath, [echoScript, '--project', projectTitle, '--fail'], {
                encoding: 'utf8',
            });
            assert.equal(failRun.status, 7);
        } finally {
            assertSafeSubpath(tmpdir(), tempDir);
            rmSync(tempDir, { recursive: true, force: true });
        }
    });
});
