import { createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'lop_session';

/**
 * Fixture identity (DR-012): the cookie carries only the username, signed together with the namespace.
 * Roles are looked up from the staff directory on every request, never trusted from the client.
 */
export class Sessions {
    constructor(private readonly secret: string) {}

    issue(namespace: string, username: string): string {
        const user = Buffer.from(username, 'utf8').toString('base64url');
        return `${user}.${this.sign(namespace, username)}`;
    }

    verify(namespace: string, cookieValue: string | undefined): string | undefined {
        if (!cookieValue) return undefined;
        const [user, signature] = cookieValue.split('.');
        if (!user || !signature) return undefined;
        const username = Buffer.from(user, 'base64url').toString('utf8');
        const expected = Buffer.from(this.sign(namespace, username));
        const given = Buffer.from(signature);
        return expected.length === given.length && timingSafeEqual(expected, given) ? username : undefined;
    }

    private sign(namespace: string, username: string): string {
        return createHmac('sha256', this.secret).update(`${namespace}\u0000${username}`).digest('base64url');
    }
}

export function readCookie(header: string | undefined, name: string): string | undefined {
    if (!header) return undefined;
    for (const part of header.split(';')) {
        const [key, ...rest] = part.trim().split('=');
        if (key === name) return decodeURIComponent(rest.join('='));
    }
    return undefined;
}
