import { UnauthorizedException } from '@nestjs/common';
import { AccessClaims, verifyAccessToken } from './access-token';
import { rememberTokenScope, ScopeRow } from './subscription-scope';

/**
 * The user a signed access token stands for, without any SQL. Shaped like the
 * users row the services already use. An expired or revoked token answers 401
 * with code ACCESS_TOKEN_EXPIRED: the app then renews with its session token
 * (and only signs out if that fails).
 */
export function userFromAccessToken(token: string) {
  const result = verifyAccessToken(token);
  if (!result.ok) {
    if (result.reason === 'invalid') throw new UnauthorizedException('Session is invalid or has expired');
    throw new UnauthorizedException({ statusCode: 401, code: 'ACCESS_TOKEN_EXPIRED', message: 'Access token expired' });
  }
  const c: AccessClaims = result.claims;
  // Content screens read the subscription scopes carried by the token.
  rememberTokenScope(c.sub, (c as any).scope as ScopeRow[] | undefined);
  return {
    id: c.sub,
    full_name: c.name,
    email: c.email,
    role: c.role,
    permissions: c.perm,
    status: c.st,
    avatar_key: c.av,
    needs_profile_setup: c.nps,
    __accessProfile: withFeatureAccess(c.acc),
    __claims: c,
  };
}

/** No plan: every feature off (same list the auth service builds). */
export const NO_FEATURE_ACCESS = {
  aiNotes: false, advancedInsights: false, practiceMode: false, examMode: false, aiQuizGenerator: false,
  resultsTracking: false, notesCanvasStudyMode: false, performanceAnalytics: false, weakAreaAnalysis: false,
  progressTrackingBasic: false, progressTrackingAdvanced: false, reportQuestion: false, pastPaperAccess: false,
  mockPaperAccess: false, featureKeys: [] as string[],
};

let fullFeatures: Record<string, unknown> | null = null;
export function setFullFeatureAccess(map: Record<string, unknown>) { fullFeatures = map; }

/** The token says "all" or "none"; put the full feature list back. */
function withFeatureAccess(acc: any) {
  if (!acc || acc.featureAccess || !acc.fa) return acc;
  const { fa, ...rest } = acc;
  return { ...rest, featureAccess: fa === 'all' && fullFeatures ? fullFeatures : NO_FEATURE_ACCESS };
}
