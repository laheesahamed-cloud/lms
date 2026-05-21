# Cleanup Rule

In this project, **cleanup** means safely removing unwanted, broken, duplicate, unused, or risky code **without changing the current UI or backend logic**.

Cleanup is not redesign. Cleanup is not refactoring for fun. Cleanup must make the codebase easier to maintain while keeping the app working exactly the same for users.

## Core Rules

- Do not delete working code.
- Do not break existing logic.
- Do not change the UI.
- Do not change layouts, colors, spacing, typography, icons, animations, or user flows.
- Do not add new features during cleanup.
- Add new code only when there is no safer option; 99% of cleanup work should avoid dumping new code and should prefer removing, simplifying, or reusing existing code.
- Do not rewrite working systems unless there is a clear bug, security risk, or duplicate/unwanted code.
- Remove unwanted code carefully.
- Remove broken code that is no longer used.
- Remove dead code, unused imports, unused variables, duplicate helpers, and abandoned files when safe.
- Do not leave broken routes, broken imports, broken API calls, or broken database logic.
- Do not leave insecure code paths that make the system easier to attack.

## Security Cleanup

Cleanup should reduce security risk.

Look for and fix/remove:

- Broken authentication checks.
- Broken permission checks.
- Exposed secrets, tokens, API keys, or credentials.
- Unsafe file upload logic.
- Debug-only code that exposes sensitive data.
- Dead admin routes that still accept requests.
- Unused backend endpoints that bypass normal guards.
- Old test/demo code that can access real data.
- Broken validation that accepts unsafe input.
- Console logs that expose passwords, session tokens, or payment data.

Security cleanup must not change the intended backend behavior. It should only remove or harden unsafe/broken leftovers.

## Professional Code Standard

Cleanup should make the code look like it was maintained by a professional software engineer.

That means:

- Clear names.
- No duplicate blocks when one existing helper can be used.
- No commented-out old code.
- No random temporary code.
- No unused files kept just in case.
- No confusing fallback logic that hides real errors.
- No half-finished functions.
- No broken imports.
- No unnecessary dependencies.
- No unnecessary CSS rules that are not used anywhere.

## What Cleanup Does Not Mean

- Do not redesign pages.
- Do not change frontend behavior.
- Do not change backend business logic.
- Do not change database meaning.
- Do not change API response shapes unless fixing a confirmed bug.
- Do not replace components just because another style looks cleaner.
- Do not add new abstraction unless it removes real duplicate code safely.

## Safe Cleanup Workflow

1. Scan before editing.
2. Identify code that is definitely unused, duplicate, broken, or risky.
3. Make the smallest safe removal.
4. Check imports and references.
5. Run build or smoke checks.
6. If cleanup touches security, verify the protected route or action still requires auth.
7. If cleanup touches UI files, verify the UI still looks the same.

## Required Verification

After cleanup, run the checks that match the changed area:

```bash
npm test
```

For frontend cleanup:

```bash
npm run build:frontend
```

For backend cleanup:

```bash
npm run build:backend
```

For full cleanup:

```bash
npm run build
```

## Final Rule

Cleanup must leave the LMS working the same, looking the same, and behaving the same, but with less unwanted code, fewer risks, fewer broken leftovers, and fewer maintenance problems.
