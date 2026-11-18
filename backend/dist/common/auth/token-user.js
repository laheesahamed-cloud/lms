"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NO_FEATURE_ACCESS = void 0;
exports.userFromAccessToken = userFromAccessToken;
exports.setFullFeatureAccess = setFullFeatureAccess;
const common_1 = require("@nestjs/common");
const access_token_1 = require("./access-token");
const subscription_scope_1 = require("./subscription-scope");
function userFromAccessToken(token) {
    const result = (0, access_token_1.verifyAccessToken)(token);
    if (!result.ok) {
        if (result.reason === 'invalid')
            throw new common_1.UnauthorizedException('Session is invalid or has expired');
        throw new common_1.UnauthorizedException({ statusCode: 401, code: 'ACCESS_TOKEN_EXPIRED', message: 'Access token expired' });
    }
    const c = result.claims;
    (0, subscription_scope_1.rememberTokenScope)(c.sub, c.scope);
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
exports.NO_FEATURE_ACCESS = {
    aiNotes: false, advancedInsights: false, practiceMode: false, examMode: false, aiQuizGenerator: false,
    resultsTracking: false, notesCanvasStudyMode: false, performanceAnalytics: false, weakAreaAnalysis: false,
    progressTrackingBasic: false, progressTrackingAdvanced: false, reportQuestion: false, pastPaperAccess: false,
    mockPaperAccess: false, featureKeys: [],
};
let fullFeatures = null;
function setFullFeatureAccess(map) { fullFeatures = map; }
function withFeatureAccess(acc) {
    if (!acc || acc.featureAccess || !acc.fa)
        return acc;
    const { fa, ...rest } = acc;
    return { ...rest, featureAccess: fa === 'all' && fullFeatures ? fullFeatures : exports.NO_FEATURE_ACCESS };
}
//# sourceMappingURL=token-user.js.map