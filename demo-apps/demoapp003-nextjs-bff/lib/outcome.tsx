import { reasonText } from './format';

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const DONE_TEXT: Record<string, string> = {
    submit: 'Application submitted.',
    approve: 'Application approved.',
    decline: 'Application declined.',
    withdraw: 'Application withdrawn.',
    'human-review': 'Human review requested.',
};

const single = (value: string | string[] | undefined): string | undefined => (Array.isArray(value) ? value[0] : value);

/** Renders the outcome a Server Action redirected with (DR-017). */
export async function Outcome({ searchParams }: { searchParams: SearchParams }) {
    const params = await searchParams;
    const refused = single(params.refused);
    const done = single(params.done);
    if (refused) return <ErrorMarker code={refused} />;
    if (done) {
        return (
            <p role="status" className="notice">
                {DONE_TEXT[done] ?? 'Done.'}
            </p>
        );
    }
    return null;
}

export function ErrorMarker({ code }: { code: string }) {
    return (
        <p role="alert" className="error" data-testid="error" data-reason={code}>
            {reasonText(code)}
        </p>
    );
}
