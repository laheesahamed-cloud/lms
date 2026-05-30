# Quiz Taking And Review UI Structure

## Quiz Taking Page

```text
Quiz Taking Screen
├── Quiz Header
│   ├── Quiz title
│   ├── Quiz label / number
│   ├── Mode or timer area
│   ├── Theme toggle
│   └── End action
│       ├── Finish practice
│       └── Submit exam
│
├── Error / feedback banner
│
└── Quiz Workspace
    ├── Left Sidebar
    │   ├── Summary tiles
    │   │   ├── Total
    │   │   ├── Answered
    │   │   ├── Current
    │   │   └── Progress
    │   ├── Progress card
    │   │   ├── Progress title
    │   │   ├── Percentage label
    │   │   ├── Progress bar
    │   │   └── Current question label
    │   └── Question navigator
    │       ├── Section title
    │       ├── Question number bubbles
    │       └── Status legend
    │
    ├── Main Question Area
    │   └── Question card
    │       ├── Question text
    │       ├── Question meta row
    │       │   ├── Question position
    │       │   ├── Question type chip
    │       │   └── Answer status chip
    │       ├── Answer options
    │       │   ├── SBA option cards
    │       │   │   ├── Option letter
    │       │   │   ├── Option text
    │       │   │   └── Selected / correct / wrong state
    │       │   └── True / False option cards
    │       │       ├── Option letter
    │       │       ├── Option text
    │       │       ├── True button
    │       │       └── False button
    │       ├── Inline learning support
    │       ├── Question navigation row
    │       │   ├── Previous
    │       │   ├── Show answer
    │       │   └── Next / Finish practice
    │       └── Utility actions
    │           ├── Save question
    │           ├── Flag question
    │           └── Report question
    │
    └── Right Sidebar
        └── Study support / explanation support
```

## Practice Completion Popup

```text
Completion Overlay
├── Blurred full-screen backdrop
└── Centered completion capsule
    ├── Tick / success animation
    └── Text area
        ├── Small status label
        ├── Main message
        └── Review-opening helper text
```

## Exam Taking Page

```text
Exam Screen
├── Exam Header
│   ├── Quiz title
│   ├── Quiz label
│   ├── Timer
│   ├── Theme toggle
│   └── Submit action
│
├── Error / feedback banner
│
├── Exam Workspace
│   ├── Left Sidebar
│   │   ├── Progress panel
│   │   │   ├── Question type
│   │   │   ├── Question position
│   │   │   ├── Percentage complete
│   │   │   └── Progress bar
│   │   └── Question navigator
│   │       ├── Section title
│   │       ├── Question number bubbles
│   │       └── Status legend
│   │
│   └── Main Exam Card
│       ├── Question text
│       ├── Answer list
│       │   ├── SBA answer cards
│       │   └── True / False answer cards
│       ├── Footer navigation
│       │   ├── Previous
│       │   └── Next / Submit exam
│       └── Utility actions
│           ├── Save question
│           ├── Flag question
│           └── Report question
│
├── Mobile Action Bar
│   ├── Previous
│   ├── Flag
│   ├── Progress indicator
│   └── Next / Finish
│
└── Exam Footer
    ├── Current block label
    └── Block progress tracker
```

## Practice Review Page

```text
Practice Review Screen
├── Review Header
│   ├── Review icon
│   ├── Title
│   ├── Quiz / topic subtitle
│   ├── Theme toggle
│   ├── Score chip
│   ├── Home button
│   └── Quizzes button
│
├── Error / feedback banner
│
└── Review Workspace
    ├── Left Sidebar
    │   ├── Summary tiles
    │   │   ├── Total
    │   │   ├── Correct
    │   │   ├── Wrong
    │   │   └── Unanswered
    │   └── Question navigator
    │       ├── Section title
    │       ├── Question number bubbles
    │       └── Status legend
    │
    ├── Main Review Area
    │   └── Review question card
    │       ├── Question text
    │       ├── Question meta row
    │       │   ├── Question position
    │       │   ├── Question type chip
    │       │   └── Result status chip
    │       ├── Answer review grid
    │       │   ├── Option cards
    │       │   ├── Your answer state
    │       │   ├── Correct answer state
    │       │   └── Wrong / unanswered state
    │       ├── Explanation card
    │       ├── Inline study support
    │       ├── Review navigation
    │       │   ├── Previous
    │       │   └── Next / Finish
    │       └── Question actions
    │           ├── Save question
    │           └── Report question
    │
    └── Right Sidebar
        └── Study support / explanation support
```

## Responsive Structure

```text
Desktop
├── Header stays full width
├── Workspace uses sidebar + main content + optional right sidebar
└── Navigation bubbles stay visible in sidebars

Tablet
├── Header actions compress
├── Workspace narrows
└── Right-side support moves into the main content

Mobile
├── Header becomes compact
├── Sidebars collapse or move below/inside main content
├── Question cards take full width
├── Action buttons stack or move into mobile action bar
└── Review/study support appears inline
```
