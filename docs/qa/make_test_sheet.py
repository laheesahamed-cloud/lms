# Generates the pre-release QA test sheet for the Xyndrome iOS app.
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (BaseDocTemplate, Frame, PageTemplate, Paragraph,
                                Spacer, Table, TableStyle, KeepTogether)

INK   = colors.HexColor('#111318')
MUTED = colors.HexColor('#6B7280')
LINE  = colors.HexColor('#D8DCE3')
SOFT  = colors.HexColor('#F3F5F8')
BRAND = colors.HexColor('#2563EB')
WARN  = colors.HexColor('#B45309')

body  = ParagraphStyle('body', fontName='Helvetica', fontSize=8.2, leading=10.4, textColor=INK)
exp   = ParagraphStyle('exp', parent=body, textColor=MUTED)
h1    = ParagraphStyle('h1', fontName='Helvetica-Bold', fontSize=17, leading=20, textColor=INK, spaceAfter=2)
sub   = ParagraphStyle('sub', fontName='Helvetica', fontSize=9, leading=12, textColor=MUTED, spaceAfter=10)
sec   = ParagraphStyle('sec', fontName='Helvetica-Bold', fontSize=10, leading=12, textColor=colors.white)
note  = ParagraphStyle('note', fontName='Helvetica-Oblique', fontSize=8, leading=10.5, textColor=WARN)

COLS = [11*mm, 58*mm, 60*mm, 7*mm, 7*mm, 38*mm]

def section(title, rows, blurb=None):
    """One titled block of checks. Kept together only per-row so long
    sections may break across pages; the header is repeated by the table."""
    out = []
    bar = Table([[Paragraph(title, sec)]], colWidths=[sum(COLS)])
    bar.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), INK),
        ('LEFTPADDING', (0,0), (-1,-1), 6), ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 4), ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    out.append(Spacer(1, 7))
    out.append(bar)
    if blurb:
        out.append(Spacer(1, 3))
        out.append(Paragraph(blurb, note))
        out.append(Spacer(1, 2))

    data = [[Paragraph('<b>#</b>', body), Paragraph('<b>Check</b>', body),
             Paragraph('<b>Expected</b>', body), Paragraph('<b>P</b>', body),
             Paragraph('<b>F</b>', body), Paragraph('<b>Notes</b>', body)]]
    for i, (what, expect) in enumerate(rows, 1):
        data.append([Paragraph(str(i), body), Paragraph(what, body),
                     Paragraph(expect, exp), '', '', ''])
    t = Table(data, colWidths=COLS, repeatRows=1)
    t.setStyle(TableStyle([
        ('GRID', (0,0), (-1,-1), 0.4, LINE),
        ('BACKGROUND', (0,0), (-1,0), SOFT),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('ALIGN', (0,0), (0,-1), 'CENTER'),
        ('ALIGN', (3,0), (4,-1), 'CENTER'),
        ('LEFTPADDING', (0,0), (-1,-1), 3), ('RIGHTPADDING', (0,0), (-1,-1), 3),
        ('TOPPADDING', (0,0), (-1,-1), 3), ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#FAFBFC')]),
    ]))
    out.append(t)
    return out

CHANGED = [
 ("Sit a PREMIUM exam in the app and press Submit at the end",
  "Submits and shows the result. NOT 'Could not submit exam ... 403'"),
 ("While sitting that exam, close and reopen the app mid-paper",
  "Answers given so far are still there (progress was being saved)"),
 ("Open a course whose lessons have a topic heading (e.g. ATLS)",
  "Heading sits exactly where admin placed it, not pushed to the end"),
 ("In admin, move a topic group up/down, then reopen that course in the app",
  "Whole group moves together, lessons stay with their heading"),
 ("Open a lesson containing a classification chart (branch card)",
  "Renders: topic box on top, its sub-types stacked under it. Not blank"),
 ("Open a lesson whose Management card has a drug mechanism",
  "Mechanism shows as arrow steps under a labelled rule inside that card"),
 ("Open a lesson with a highlighted table column heading",
  "Heading reads as plain text. NOT literal '==X=='"),
 ("Open an OSCE short case that has treatment written",
  "A 'Treatment' stop appears between Investigations and Summary"),
 ("Open an OSCE long case that has treatment written",
  "Treatment block appears after 'Initial management', both visible"),
 ("Open an OSCE case with NO treatment written",
  "No Treatment step and no empty section"),
 ("Open Planner while NOT subscribed",
  "'Generate study plan' card shows a PRO badge"),
 ("Tap Generate study plan while NOT subscribed",
  "Paywall opens. Cancelling returns to Planner, nothing created"),
 ("Tap Generate study plan while subscribed",
  "Goes straight to the form, no paywall"),
 ("Add a task by hand while NOT subscribed",
  "Works, no paywall - manual tasks stay free"),
 ("Generate a plan over 2-3 courses and watch the loading screen",
  "Ring keeps moving and counts 'N of M tasks'. No green tick until done"),
 ("Count tasks created vs tasks promised",
  "All of them land. No partial plan"),
 ("Generate a plan with the phone in airplane mode",
  "Clear error. No half-created plan left in the Planner"),
 ("Delete your account / sign in as a brand-new user",
  "Welcome screen asks for nickname + avatar before the dashboard"),
]

AUTH = [
 ("Sign in with email + password", "Lands on dashboard, stays signed in after force-quit"),
 ("Sign in with Google", "Completes without leaving the app to a broken page"),
 ("Sign in with Apple", "Completes; name/email handled even if hidden"),
 ("Sign up with a new email", "6-digit OTP arrives by email, code is NOT shown on screen"),
 ("Enter a wrong OTP", "Clear error, can resend"),
 ("Sign out, then reopen the app", "Returns to sign-in, not a blank screen"),
 ("Onboarding: skip / leave the name blank", "Handled gracefully, no dead end"),
 ("Force-quit during onboarding, reopen", "Onboarding resumes, not skipped silently"),
]

SHELL = [
 ("Move through every bottom-nav tab", "No flicker, no blank frame, tab bar stays readable"),
 ("Check the bottom nav over a scrolling list", "Blur/gradient looks right, content readable behind it"),
 ("Open any popup/sheet (profile, filters, reminders)", "Sheet paints ABOVE the tab bar, not under it"),
 ("Rotate / use a larger device", "No overlap, nothing clipped at the edges"),
 ("Switch light <-> dark in Profile > Appearance", "Every screen follows, no white flash, no unreadable text"),
 ("Check safe areas with the dynamic island", "Headers and timers clear of the island"),
]

LESSONS = [
 ("Open Study > Lessons, pick a course", "Subjects listed, lesson counts correct"),
 ("Open a lesson with notes", "Canvas opens, cards readable, no yellow debug underlines"),
 ("Pinch/zoom and scroll the canvas", "Smooth, stays inside bounds"),
 ("Write with Apple Pencil / finger on the canvas", "Ink appears where expected, no lag spikes"),
 ("Switch pen / highlighter / eraser and sizes", "Each tool behaves; highlighter is translucent"),
 ("Close and reopen the lesson", "Your ink is still there"),
 ("Open a PDF lesson", "PDF renders, annotation works, saved on reopen"),
 ("Open a locked (premium) lesson", "Lock shown with a clear reason, no crash"),
 ("Flow card (cause -> effect)", "Centered down-arrows, no cards/labels around steps"),
 ("Image / image-explained card", "Image loads at sensible size with its caption"),
]

QBANK = [
 ("Open Q-Bank, pick a subject", "Topic name above, quizzes listed under it"),
 ("Start a PRACTICE quiz", "Questions load, answer feedback immediate"),
 ("Start an EXAM", "Timer counts down, question count correct"),
 ("Answer a true/false (multi-statement) question", "Each statement records separately"),
 ("Let an exam timer run out", "Auto-submits, result shown, no lost attempt"),
 ("Review a finished attempt", "Correct answers + explanations, images load"),
 ("Open a quiz outside your subscription scope", "Clear message, not a raw error"),
]

FLASH = [
 ("Open Flashcards for a lesson", "Deck loads, card flips"),
 ("Grade cards Again / Hard / Good / Easy", "Next due interval changes sensibly"),
 ("Leave and come back later", "Due counts persist, not reset"),
 ("Flashcard with an image", "Image renders (not a broken box)"),
 ("Create a personal flashcard / deck", "Saves and appears in your own list"),
]

OSCE = [
 ("Open OSCE, pick a category", "Cases listed with difficulty"),
 ("Walk a short case end to end", "Exam > Mechanism > Ix > Treatment > Summary > OSCE"),
 ("Tap findings on the body map", "Opens the right finding with its image"),
 ("Play an auscultation sound inside a case", "Plays, markers line up, stops on leaving"),
 ("Tick the practice checklist, leave, return", "Ticks persist"),
 ("Walk a long case end to end", "History sections flow, differentials and viva present"),
 ("Open a case with missing media", "Placeholder, not a crash or endless spinner"),
]

OTHER = [
 ("ECG hub: open each of the 4 cards", "Basics / Rhythm library / Practice cases / Quiz all load"),
 ("ECG: a heading starting with 'Basics'", "Filed under the Basics category"),
 ("Auscultation: heart and lung", "Icons correct, centred, sounds play"),
 ("Drugs randomiser: spin", "Returns a drug with its details, repeatable"),
 ("Saved pages / bookmarks", "Saving and unsaving reflects immediately and after reopen"),
 ("Personal notes", "Create, edit, delete all persist"),
 ("Notifications: open the list", "Items listed, tapping opens the right screen"),
 ("Notifications: clear one / clear all", "Stays cleared after reopening the app"),
 ("Push notification while app is closed", "Arrives and opens the right screen"),
]

PLANNER = [
 ("Open Planner with no tasks", "Empty state explains what to do"),
 ("Add a task by hand with a due date", "Appears under that day"),
 ("Tick a task done", "Moves to done, count updates, survives reopen"),
 ("Delete a task", "Removed, stays removed after reopen"),
 ("Generate a plan 'by day'", "Tasks spread across days within your hours/day"),
 ("Generate a plan 'by subject'", "Tasks grouped by course, no due dates"),
 ("Set a reminder time", "Notification arrives at that time"),
 ("Reset the planner", "Clears all, with confirmation first"),
]

BILLING = [
 ("Open Subscriptions while not subscribed", "Plans listed with correct prices"),
 ("Open the paywall", "Renewal terms shown (Apple requires it)"),
 ("Buy a plan with a sandbox account", "Unlocks immediately, no restart needed"),
 ("Restore purchases", "Restores without buying again"),
 ("Cancel mid-purchase", "Returns cleanly, nothing charged or unlocked"),
 ("Check locked content after subscribing", "Previously locked lessons/quizzes now open"),
 ("Check content outside your plan's courses", "Still locked, with a clear reason"),
]

EDGE = [
 ("Airplane mode on every main tab", "Clear offline message, no infinite spinner"),
 ("Drop to a slow connection mid-load", "Recovers or errors clearly, never hangs silently"),
 ("Force-quit and reopen on each main screen", "Returns to a sane state, still signed in"),
 ("Leave the app backgrounded for an hour", "Still signed in, data refreshes on return"),
 ("Low battery / low power mode", "Animations degrade gracefully"),
 ("Largest accessibility text size", "Nothing clipped or overlapping badly"),
 ("Run on iPad", "Layout usable; note anything stretched - phone-width by design"),
]

OUT = '/Applications/XAMPP/xamppfiles/htdocs/lms/docs/qa/XYNDROME_APP_TEST_SHEET.pdf'

def header_block():
    """Tester / device / build, and the one question that explains most
    'failures': whether the backend was actually deployed."""
    f = lambda label: [Paragraph(f'<b>{label}</b>', body), '']
    rows = [f('Tester') + f('Date'),
            f('Device') + f('iOS version'),
            f('App version') + f('Build'),
            f('Backend deployed? (git pull + restart)') + f('Signed in as')]
    t = Table(rows, colWidths=[42*mm, 48*mm, 36*mm, 55*mm])
    t.setStyle(TableStyle([
        ('GRID', (0,0), (-1,-1), 0.4, LINE),
        ('BACKGROUND', (0,0), (0,-1), SOFT),
        ('BACKGROUND', (2,0), (2,-1), SOFT),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('LEFTPADDING', (0,0), (-1,-1), 4),
        ('TOPPADDING', (0,0), (-1,-1), 5), ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    return t

def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont('Helvetica', 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(14*mm, 10*mm, 'Xyndrome - iOS pre-release test sheet')
    canvas.drawRightString(A4[0] - 14*mm, 10*mm, f'Page {doc.page}')
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.4)
    canvas.line(14*mm, 13*mm, A4[0] - 14*mm, 13*mm)
    canvas.restoreState()

doc = BaseDocTemplate(OUT, pagesize=A4,
                      leftMargin=14*mm, rightMargin=14*mm,
                      topMargin=13*mm, bottomMargin=16*mm,
                      title='Xyndrome - iOS pre-release test sheet',
                      author='Xyndrome')
frame = Frame(doc.leftMargin, doc.bottomMargin,
              doc.width, doc.height, id='f', showBoundary=0)
doc.addPageTemplates([PageTemplate(id='all', frames=[frame], onPage=footer)])

story = [
    Paragraph('Xyndrome - final test sheet', h1),
    Paragraph('iOS app, pre-release. Tick P (pass) or F (fail). Write what you '
              'actually saw in Notes - "looks wrong" is hard to fix, "the heading '
              'said ==X==" is not.', sub),
    header_block(),
    Spacer(1, 4),
    Paragraph('If the backend has not been pulled and restarted, section A will '
              'fail for that reason alone - check that box first.', note),
]
story += section('A. CHANGED IN THIS RELEASE - test these first', CHANGED,
                 'Everything below was written or fixed in the last few days. '
                 'If anything regressed, it is most likely here.')
story += section('B. Sign in, sign up and onboarding', AUTH)
story += section('C. Shell, navigation and theme', SHELL)
story += section('D. Courses, lessons and the notes canvas', LESSONS)
story += section('E. Q-Bank, quizzes and exams', QBANK)
story += section('F. Flashcards', FLASH)
story += section('G. OSCE clinical', OSCE)
story += section('H. ECG, auscultation, drugs, saved and notifications', OTHER)
story += section('I. Planner', PLANNER)
story += section('J. Subscriptions and in-app purchase', BILLING)
story += section('K. Network, lifecycle and device', EDGE)

story.append(Spacer(1, 10))
sign = Table([[Paragraph('<b>Blockers found</b>', body), '',
               Paragraph('<b>Cleared to ship?</b>', body), '']],
             colWidths=[36*mm, 60*mm, 36*mm, 49*mm], rowHeights=[16*mm])
sign.setStyle(TableStyle([
    ('GRID', (0,0), (-1,-1), 0.4, LINE),
    ('BACKGROUND', (0,0), (0,-1), SOFT),
    ('BACKGROUND', (2,0), (2,-1), SOFT),
    ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ('LEFTPADDING', (0,0), (-1,-1), 4), ('TOPPADDING', (0,0), (-1,-1), 4),
]))
story.append(KeepTogether([sign]))

doc.build(story)

total = sum(len(x) for x in (CHANGED, AUTH, SHELL, LESSONS, QBANK, FLASH,
                             OSCE, OTHER, PLANNER, BILLING, EDGE))
print(f'built {OUT} with {total} checks')
