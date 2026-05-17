# Frontend Surface Architecture Plan

Created: 2026-05-17

This document explains the frontend organization for the public website, student app, admin console, and shared code.

## Why This Change Exists

The product is becoming more than one surface:

```text
domain.com        Public website
app.mydomain.com  Student app and native app surface
admin             Admin console
```

These surfaces have different users, layouts, navigation patterns, and release risks. Keeping all UI files mixed together makes future changes dangerous because a student app redesign can accidentally affect the public website or admin console.

The goal is to make the folder tree match the product:

- `website` means public-facing website.
- `app` means authenticated student app and native app surface.
- `admin` means admin console.
- `shared` means code used by more than one surface.

## Surface Definitions

### Website

The website is the public `domain.com` surface.

It is for:

- Public visitors
- Marketing pages
- Course/product explanations
- Login/register entry
- Public policy pages
- Public PWA behavior if we choose to support it there

Website navigation should feel like a website:

- Top navbar
- Public links
- Clear login/register actions
- Landing-page sections
- Public brand storytelling

Website changes should not affect the student app unless the request says `both`.

### App

The app is the private `app.mydomain.com` surface.

During development, localhost acts as the app surface.

It is for:

- Authenticated students
- Student dashboard/home
- Courses
- Q-Bank
- Lessons
- Results
- Planner
- Bookmarks
- Native app wrapper

App navigation should feel like an app:

- Bottom tabs on phones
- Safe-area support for iOS/Android
- Strong home/dashboard
- Fast resume action
- App-style header
- Responsive layouts for phone, tablet, and desktop

The `app-3` folder is the current design reference for this app surface.

App changes should not affect the public website or admin console unless the request says `both`.

### Admin

The admin surface is for operators and staff.

It is for:

- Course management
- Structure management
- Question bank management
- Quiz builder
- Users/students
- Subscriptions
- Reports
- Settings

Admin navigation should remain a productivity console:

- Sidebar
- Dense data tables
- Management forms
- Filters
- Review queues

Admin is not part of the current redesign scope. It should remain untouched unless the request explicitly says admin.

### Shared

Shared code is for things that truly belong to more than one surface.

Examples:

- API client
- Auth store
- Route guards
- Platform detection
- Utility functions
- Basic UI primitives
- Design tokens that are intentionally cross-surface

Shared should not become a dumping ground. If something belongs only to the app, it should live in `app`. If something belongs only to the website, it should live in `website`.

## Current Tree

The restructuring is intentionally inside `frontend/src`, not at the repository root. This keeps the current Vite, Capacitor, Apache, and backend assumptions stable.

```text
frontend/src/
  surfaces/
    website/
      pages/
      components/
      routes.jsx
      content/
      ai/

    app/
      student/
        dashboard/
        courses/
        quizzes/
        lessons/
        results/
        planner/
        billing/

    admin/
      pages/

  shared/
    api/
    auth/
    components/
    hooks/
    platform/
    stores/
    styles/
    utils/

  app/
    App.jsx
    AppFrame.jsx
    providers.jsx
    router.jsx
```

The existing `frontend/src/app` folder can remain as the runtime app bootstrap layer. That folder name means React application bootstrap, not the student app surface. To avoid confusion later, we may eventually rename it to `runtime`, but that should be a separate decision.

## Mapping From Previous Tree

Previous:

```text
frontend/src/surfaces/website/pages/LandingPage.jsx
frontend/src/surfaces/app/student/*
frontend/src/surfaces/admin/pages/*
frontend/src/shared/layout/*
frontend/src/shared/api/*
frontend/src/shared/platform/*
frontend/src/shared/stores/*
frontend/src/shared/styles/*
```

Future:

```text
frontend/src/surfaces/website/pages/LandingPage.jsx
frontend/src/surfaces/app/student/*
frontend/src/surfaces/admin/pages/*
frontend/src/surfaces/app/shell/*
frontend/src/surfaces/admin/shell/*
frontend/src/shared/api/*
frontend/src/shared/platform/*
frontend/src/shared/stores/*
frontend/src/shared/styles/*
```

## Migration Strategy

### Stage 1: Document and Enforce Meaning

Use the terms consistently:

- `app` = student app/native surface
- `website` = public website
- `admin` = admin console
- `shared` = true shared code

Status: complete.

### Stage 2: Move Surfaces and Shared Code

The frontend source tree now has `surfaces/website`, `surfaces/app`, `surfaces/admin`, and `shared`.

Status: complete.

### Stage 3: Student Dashboard Redesign

The next product/design step is to redesign the student dashboard inside the app surface.

Likely files:

```text
frontend/src/surfaces/app/student/dashboard/StudentDashboardPage.jsx
frontend/src/shared/styles/04-pages/dashboard.css
```

Status: pending.

Admin has been structurally moved into its own surface, but admin design remains untouched.

## Request Scope Rule

Future requests should be interpreted by surface:

```text
"app"      Change only the student app surface.
"website"  Change only the public website surface.
"admin"    Change only the admin surface.
"both"     Change both app and website deliberately.
"shared"   Change shared code only when it is genuinely cross-surface.
```

If the request is ambiguous, ask before changing code.

## Design Direction By Surface

### Website Design

The website should be clear, public, and brand-led.

Expected feel:

- Public trust
- Course/product clarity
- Direct calls to action
- Website navbar
- Marketing sections
- Strong responsive layout

### App Design

The app should follow the `app-3` Study Hub direction.

Expected feel:

- App-like, not marketing-like
- Phone-first
- Native-safe
- Fast to resume study
- Friendly but focused
- Soft lavender/white/deep navy palette
- Cobalt/purple gradient as a motif
- Bottom tabs on phones
- No text overlap or clipped tab-bar content

### Admin Design

Admin should remain operational and dense.

Expected feel:

- Quiet
- Fast
- Data-first
- Tables/forms/filtering
- Minimal decorative design

## Recommended Next Product Step

Next approved implementation should be one of:

1. Redesign only the student dashboard in place.
2. Redesign student dashboard plus tune student mobile shell/navigation.

The physical folder migration is already complete and the frontend production build passes.
