/**
 * @jest-environment node
 */
import { generateMockTokens, generateMockTokensForUser, extractUserFromToken, MOCK_AUTH_USER } from '../mock';

// ---------------------------------------------------------------------------
// generateMockTokens
// ---------------------------------------------------------------------------

describe('generateMockTokens', () => {
  it('returns a token set with the expected shape', () => {
    const tokens = generateMockTokens();
    expect(tokens).toHaveProperty('access_token');
    expect(tokens).toHaveProperty('id_token');
    expect(tokens).toHaveProperty('refresh_token');
    expect(tokens.token_type).toBe('Bearer');
    expect(tokens.expires_in).toBe(3_600);
  });

  it('access_token has three JWT segments', () => {
    const { access_token } = generateMockTokens();
    expect(access_token.split('.')).toHaveLength(3);
  });

  it('refresh_token ends with mock-signature', () => {
    const { refresh_token } = generateMockTokens();
    expect(refresh_token.endsWith('.mock-signature')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// generateMockTokensForUser
// ---------------------------------------------------------------------------

describe('generateMockTokensForUser', () => {
  it('embeds the user id in the access_token payload', () => {
    const tokens = generateMockTokensForUser(MOCK_AUTH_USER);
    const user = extractUserFromToken(tokens.access_token);
    expect(user?.id).toBe(MOCK_AUTH_USER.id);
  });

  it('omits organization_id claim when organizationId is null', () => {
    const userWithoutOrg = { ...MOCK_AUTH_USER, organizationId: null };
    const tokens = generateMockTokensForUser(userWithoutOrg);
    const [, payloadSeg] = tokens.access_token.split('.');
    const payload = JSON.parse(atob(payloadSeg.replace(/-/g, '+').replace(/_/g, '/')));
    expect(payload).not.toHaveProperty('organization_id');
  });

  it('includes organization_id claim when organizationId is set', () => {
    const userWithOrg = { ...MOCK_AUTH_USER, organizationId: 'org-999' };
    const tokens = generateMockTokensForUser(userWithOrg);
    const [, payloadSeg] = tokens.access_token.split('.');
    const payload = JSON.parse(atob(payloadSeg.replace(/-/g, '+').replace(/_/g, '/')));
    expect(payload.organization_id).toBe('org-999');
  });
});

// ---------------------------------------------------------------------------
// extractUserFromToken — error path (catch branch)
// ---------------------------------------------------------------------------

describe('extractUserFromToken', () => {
  it('returns null for a malformed token', () => {
    expect(extractUserFromToken('not.a.valid.jwt')).toBeNull();
  });

  it('returns null when the token has no payload segment', () => {
    expect(extractUserFromToken('header')).toBeNull();
  });
});
