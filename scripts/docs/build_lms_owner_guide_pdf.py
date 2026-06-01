from __future__ import annotations

import subprocess
from datetime import date
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs" / "lms-beginner-owner-guide.pdf"


BLUE = colors.HexColor("#2563A8")
DARK_BLUE = colors.HexColor("#17324D")
INK = colors.HexColor("#1F2937")
MUTED = colors.HexColor("#52616B")
BORDER = colors.HexColor("#D4DCE3")
LIGHT_BLUE = colors.HexColor("#EAF3FB")
LIGHT_GRAY = colors.HexColor("#F4F6F8")
YELLOW = colors.HexColor("#FFF7D6")
GREEN = colors.HexColor("#EAF7EF")
RED = colors.HexColor("#FDECEC")


def run(cmd: list[str]) -> str:
    try:
        return subprocess.check_output(cmd, cwd=ROOT, text=True, stderr=subprocess.DEVNULL).strip()
    except Exception:
        return ""


def esc(text: str) -> str:
    return (
        str(text)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\n", "<br/>")
    )


def styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "GuideTitle",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=24,
            leading=29,
            textColor=DARK_BLUE,
            alignment=TA_CENTER,
            spaceAfter=8,
        ),
        "subtitle": ParagraphStyle(
            "GuideSubtitle",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=11,
            leading=15,
            textColor=MUTED,
            alignment=TA_CENTER,
            spaceAfter=18,
        ),
        "h1": ParagraphStyle(
            "GuideH1",
            parent=base["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=16,
            leading=20,
            textColor=BLUE,
            spaceBefore=12,
            spaceAfter=7,
        ),
        "h2": ParagraphStyle(
            "GuideH2",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=12.5,
            leading=16,
            textColor=BLUE,
            spaceBefore=10,
            spaceAfter=5,
        ),
        "h3": ParagraphStyle(
            "GuideH3",
            parent=base["Heading3"],
            fontName="Helvetica-Bold",
            fontSize=10.8,
            leading=14,
            textColor=DARK_BLUE,
            spaceBefore=7,
            spaceAfter=4,
        ),
        "body": ParagraphStyle(
            "GuideBody",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=9.7,
            leading=12.6,
            textColor=INK,
            alignment=TA_LEFT,
            spaceAfter=5,
        ),
        "small": ParagraphStyle(
            "GuideSmall",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=8.2,
            leading=10.5,
            textColor=MUTED,
            spaceAfter=3,
        ),
        "code": ParagraphStyle(
            "GuideCode",
            parent=base["Code"],
            fontName="Courier",
            fontSize=8.3,
            leading=10.2,
            textColor=colors.HexColor("#111827"),
            backColor=LIGHT_GRAY,
            borderColor=BORDER,
            borderWidth=0.5,
            borderPadding=6,
            spaceBefore=3,
            spaceAfter=7,
        ),
        "callout": ParagraphStyle(
            "GuideCallout",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=9.5,
            leading=12.5,
            textColor=INK,
            spaceAfter=0,
        ),
        "table": ParagraphStyle(
            "GuideTable",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=8.2,
            leading=10.2,
            textColor=INK,
        ),
        "table_head": ParagraphStyle(
            "GuideTableHead",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=8.3,
            leading=10.5,
            textColor=DARK_BLUE,
        ),
    }


S = styles()


def P(text: str):
    return Paragraph(esc(text), S["body"])


def H1(text: str):
    return Paragraph(esc(text), S["h1"])


def H2(text: str):
    return Paragraph(esc(text), S["h2"])


def H3(text: str):
    return Paragraph(esc(text), S["h3"])


def Code(text: str):
    return Paragraph(esc(text), S["code"])


def Bullet(items: list[str]):
    return ListFlowable(
        [ListItem(Paragraph(esc(item), S["body"]), leftIndent=12) for item in items],
        bulletType="bullet",
        start="circle",
        leftIndent=16,
        bulletIndent=4,
        spaceBefore=2,
        spaceAfter=6,
    )


def Number(items: list[str]):
    return ListFlowable(
        [ListItem(Paragraph(esc(item), S["body"]), leftIndent=14) for item in items],
        bulletType="1",
        leftIndent=18,
        bulletIndent=4,
        spaceBefore=2,
        spaceAfter=6,
    )


def Callout(title: str, body: str, fill=LIGHT_BLUE):
    text = Paragraph(f"<b>{esc(title)}</b> {esc(body)}", S["callout"])
    table = Table([[text]], colWidths=[6.5 * inch])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), fill),
                ("BOX", (0, 0), (-1, -1), 0.6, BORDER),
                ("LEFTPADDING", (0, 0), (-1, -1), 9),
                ("RIGHTPADDING", (0, 0), (-1, -1), 9),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    return KeepTogether([table, Spacer(1, 7)])


def DataTable(headers: list[str], rows: list[list[str]], widths: list[float]):
    data = [[Paragraph(esc(h), S["table_head"]) for h in headers]]
    for row in rows:
        data.append([Paragraph(esc(cell), S["table"]) for cell in row])
    table = Table(data, colWidths=[w * inch for w in widths], repeatRows=1, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), LIGHT_GRAY),
                ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.35, BORDER),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return KeepTogether([table, Spacer(1, 8)])


def KeyTable(rows: list[tuple[str, str]], headers=("Item", "Meaning")):
    return DataTable(list(headers), [[a, b] for a, b in rows], [1.85, 4.65])


def page_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(doc.leftMargin, 0.38 * inch, "xyndrome LMS Owner Guide")
    canvas.drawRightString(letter[0] - doc.rightMargin, 0.38 * inch, f"Page {doc.page}")
    canvas.restoreState()


def build_story():
    branch = run(["git", "branch", "--show-current"]) or "unknown"
    remote = run(["git", "remote", "get-url", "origin"]) or "not detected"

    story = []
    story += [
        Paragraph("xyndrome LMS Beginner Owner Guide", S["title"]),
        Paragraph(
            "A plain-English manual for opening, understanding, changing, and launching your app",
            S["subtitle"],
        ),
        Callout(
            "Read this first.",
            "You do not need to become a software engineer to own this project. This guide explains the project like a map: where it lives, what each major folder means, how to open it locally, what Git main and branches mean, and what still matters before launch.",
            GREEN,
        ),
        KeyTable(
            [
                ("Project folder", str(ROOT)),
                ("Local website", "http://localhost/lms/"),
                ("Login page", "http://localhost/lms/auth/login"),
                ("Backend API", "http://localhost:3000/api"),
                ("Current Git branch", branch),
                ("GitHub remote", remote),
                ("Generated on", date.today().isoformat()),
            ]
        ),
        H2("How to use this PDF"),
        Number(
            [
                "Start with Part 1 if you only want the simple picture.",
                "Use Part 2 when you need to open the LMS locally.",
                "Use Part 3 when you ask Codex or ChatGPT to change the app.",
                "Use Part 4 before touching Git.",
                "Use Part 6 before launch.",
                "Use the appendices as dictionaries for files, commands, and Git words.",
            ]
        ),
        PageBreak(),
        H1("Contents"),
        Bullet(
            [
                "Part 1 - The simple picture",
                "Part 2 - How to open the LMS locally",
                "Part 3 - Project folders and what they mean",
                "Part 4 - Git, main branch, and sub-branches",
                "Part 5 - How changes should be made safely",
                "Part 6 - Launch readiness",
                "Part 7 - Native app, API IPs, and local testing",
                "Part 8 - Troubleshooting",
                "Appendix A - File and folder dictionary",
                "Appendix B - Commands cheat sheet",
                "Appendix C - Environment variables in plain English",
                "Appendix D - What to ask Codex",
                "Appendix E - 30 day learning path",
            ]
        ),
        Callout(
            "Note.",
            "This contents page is a reading map, not a clickable generated table of contents. The PDF is meant to be opened and skimmed visually.",
            YELLOW,
        ),
        PageBreak(),
        H1("Part 1 - The Simple Picture"),
        P(
            "Your LMS is not one single magic file. It is a small system made of a few parts that talk to each other. When something breaks, the goal is to identify which part is failing instead of feeling like the whole app is broken."
        ),
        DataTable(
            ["Part", "Plain-English Meaning", "Real Project Location"],
            [
                ["Frontend", "The screens people see and click: website, login, student dashboard, admin pages, quiz pages.", "frontend/src/"],
                ["Backend/API", "The server brain. It receives requests, checks users, saves quiz results, talks to the database.", "backend/src/"],
                ["Database", "The stored data: users, courses, lessons, questions, quizzes, payments, attempts.", "MySQL through XAMPP or production DB"],
                ["XAMPP/Apache", "The local web server that lets the built website open at localhost/lms.", "/Applications/XAMPP/"],
                ["Native app", "Android/iOS wrappers around the frontend, using Capacitor.", "frontend/android/ and frontend/ios/"],
                ["Desktop app", "Electron wrapper for desktop builds.", "desktop/"],
                ["Git", "The project history and safety system.", ".git/ and GitHub"],
            ],
            [1.3, 3.0, 2.2],
        ),
        H2("The request flow"),
        P("Most screens follow this flow:"),
        Number(
            [
                "User opens a page in the browser or native app.",
                "The React frontend displays the screen.",
                "If the page needs data, frontend calls the backend API.",
                "Backend checks permissions and talks to MySQL.",
                "Backend sends data back.",
                "Frontend shows the result.",
            ]
        ),
        Code("Browser or mobile app -> React frontend -> /api backend -> MySQL database -> response back to screen"),
        H2("Why local development can still work after adding a real domain"),
        P(
            "Files such as sitemap.xml, robots.txt, canonical URLs, and social preview tags can point to your real public domain. That does not stop local development. Local development uses localhost and local API settings. SEO metadata is mostly for Google and social previews after deployment."
        ),
        KeyTable(
            [
                ("Local app URL", "http://localhost/lms/"),
                ("Local API URL", "http://localhost:3000/api"),
                ("Production public URL", "https://www.xyndrome.lk or your chosen final URL"),
                ("Production API URL", "https://www.xyndrome.lk/api"),
            ],
            ("Type", "Example"),
        ),
        H2("What vibe coding means for ownership"),
        P(
            "Vibe coding is useful because you can describe what you want and let an AI agent help implement it. The important upgrade is learning enough of the map to ask for safer changes and to know what must be tested. You do not need to memorize every file. You need to know which area the change belongs to and what result to verify."
        ),
        Callout(
            "Owner mindset.",
            "You are allowed to say: 'I do not know the file names. Please inspect the app, find the right files, make the change, run tests, and explain what changed.' That is a good prompt.",
            GREEN,
        ),
        Spacer(1, 10),
        H1("Part 2 - How To Open The LMS Locally"),
        P(
            "Local means the app runs on your own computer instead of the public internet. Your local app is stored inside the XAMPP htdocs folder."
        ),
        Code(str(ROOT)),
        H2("Daily local startup"),
        Number(
            [
                "Open XAMPP.",
                "Start Apache.",
                "Start MySQL.",
                "Open Terminal inside the project folder.",
                "Start the backend API.",
                "Open the login page in the browser.",
            ]
        ),
        Code("cd /Applications/XAMPP/xamppfiles/htdocs/lms\nnpm run start:api:bg\nnpm run status:api\nopen http://localhost/lms/auth/login"),
        H2("The most important local URLs"),
        KeyTable(
            [
                ("Public website", "http://localhost/lms/"),
                ("Login", "http://localhost/lms/auth/login"),
                ("Student dashboard", "http://localhost/lms/app/dashboard"),
                ("Admin dashboard", "http://localhost/lms/admin/dashboard"),
                ("API health", "http://localhost:3000/api/health"),
                ("API ready check", "http://localhost:3000/api/health/ready"),
            ],
            ("Area", "URL"),
        ),
        H2("If the login page says Network Error"),
        P("This usually means the frontend opened, but the backend API is not running or cannot reach the database."),
        Number(
            [
                "Check whether the API is running.",
                "Check API health.",
                "If needed, restart the API.",
                "If health works but ready fails, check XAMPP MySQL and database settings.",
            ]
        ),
        Code("npm run status:api\ncurl http://localhost:3000/api/health\nnpm run stop:api:bg\nnpm run start:api:bg"),
        H2("Why /api alone can show 404"),
        P(
            "The backend does not have a plain index page at /api. That is normal. Use a real endpoint like /api/health, /api/auth/login, or /api/results."
        ),
        H2("When frontend changes do not appear"),
        P(
            "The Apache version uses the built frontend bundle from frontend/dist. After changing frontend files, rebuild the frontend before testing through localhost/lms."
        ),
        Code("npm run build:frontend"),
        Callout("Simple rule.", "If you changed what the user sees and localhost/lms still looks old, rebuild the frontend.", YELLOW),
        Spacer(1, 10),
        H1("Part 3 - Project Folders And What They Mean"),
        P(
            "You do not need to open every folder. Think of the project like a building. Some rooms are where the app is built. Some are storage. Some are generated and should not be edited by hand."
        ),
        DataTable(
            ["Folder/File", "What It Means", "Should You Edit It?"],
            [
                ["frontend/src/surfaces/website/", "Landing page, login, register, legal pages, public AI generator.", "Only when changing website/auth/public pages."],
                ["frontend/src/surfaces/app/", "Student app: dashboard, courses, lessons, quizzes, results, notes, billing.", "Only when changing student experience."],
                ["frontend/src/surfaces/admin/", "Admin dashboard and management pages.", "Only when changing admin experience."],
                ["frontend/src/shared/", "Shared UI, API clients, auth store, layout, platform helpers, styles.", "Careful. Changes can affect many pages."],
                ["frontend/public/", "Public images, icons, robots.txt, sitemap.xml.", "Yes for assets and SEO files."],
                ["frontend/dist/", "Built web output generated by Vite.", "No. Rebuild instead."],
                ["frontend/dist-capacitor/", "Built native output generated for Capacitor.", "No. Rebuild/sync instead."],
                ["backend/src/modules/", "Backend features: auth, courses, questions, quizzes, payments, settings.", "Yes, but test carefully."],
                ["backend/.env", "Local backend secrets and database settings.", "Edit locally, never share publicly."],
                ["backend/.env.example", "Example backend environment template.", "Safe template only. No real secrets."],
                ["database/", "SQL dumps and migrations.", "Careful. Database changes need backup."],
                ["docs/", "Project documentation and guides.", "Yes."],
                ["scripts/", "Build, QA, migration, and helper scripts.", "Only when changing workflow."],
                ["desktop/", "Electron desktop wrapper.", "Only for desktop app changes."],
                ["frontend/android/ and frontend/ios/", "Native app projects generated/managed by Capacitor.", "Usually through sync, not manual edits."],
                ["node_modules/", "Installed packages.", "No. Do not edit."],
                ["backups/", "Saved project/database copies.", "Do not casually delete."],
            ],
            [2.05, 2.75, 1.7],
        ),
        H2("Where common changes usually live"),
        DataTable(
            ["Change You Want", "Likely Area", "Example"],
            [
                ["Landing page text/design", "frontend/src/surfaces/website/pages/", "LandingPage.jsx"],
                ["Login/register UI", "frontend/src/surfaces/website/auth/", "LoginPage.jsx, RegisterPage.jsx"],
                ["Student dashboard", "frontend/src/surfaces/app/student/dashboard/", "StudentDashboardPage.jsx"],
                ["Quiz taking screen", "frontend/src/surfaces/app/student/quizzes/", "TakeQuizPage.jsx"],
                ["Quiz result/review", "frontend/src/surfaces/app/student/results/", "ResultPage.jsx, ReviewPage.jsx"],
                ["Admin questions", "frontend/src/surfaces/admin/pages/questions/", "QuestionsPage.jsx"],
                ["API request code", "frontend/src/shared/api/", "auth.api.js, aiNotes.api.js, etc."],
                ["Dark mode colors", "frontend/src/shared/styles/", "CSS files and variables"],
                ["Backend quiz logic", "backend/src/modules/quiz-attempts/", "controller/service files"],
                ["Payment settings", "backend/src/modules/subscriptions/ and settings", "PayHere flows"],
                ["Email/password reset", "backend/src/modules/auth/ and settings", "SMTP settings"],
                ["API IP/domain config", "frontend env files and shared platform config", ".env.capacitor, config files"],
            ],
            [2.05, 2.75, 1.7],
        ),
        H2("Files recently important in your project"),
        Bullet(
            [
                "frontend/src/surfaces/app/student/quizzes/TakeQuizPage.jsx - quiz-taking and finish animation behavior.",
                "frontend/src/shared/seo/PageMeta.jsx - page title, description, canonical, social preview metadata.",
                "frontend/public/robots.txt and frontend/public/sitemap.xml - Google crawl guidance.",
                "frontend/src/surfaces/website/pages/RefundPolicyPage.jsx and CookiePolicyPage.jsx - legal pages.",
                "frontend/src/shared/platform/config.js - platform/API fallback configuration.",
                "scripts/build/sync-root-index.mjs - copies built frontend files to the root served by Apache.",
            ]
        ),
        Spacer(1, 10),
        H1("Part 4 - Git, Main Branch, And Sub-Branches"),
        P(
            "Git is the save-history system for your app. GitHub is the online place where that history can be stored. A branch is like a separate working lane. You can try changes on a branch without immediately changing the stable main lane."
        ),
        Callout(
            "Important correction.",
            "A branch is not really a folder inside main. It is more like a named timeline. People may say 'sub-branch', but Git usually just says branch.",
            LIGHT_BLUE,
        ),
        KeyTable(
            [
                ("Repository", "The full project with history."),
                ("main branch", "Usually the stable production branch. Treat it as the clean copy."),
                ("feature branch", "A separate branch for one fix or feature."),
                ("current branch", branch),
                ("commit", "A saved checkpoint with a message."),
                ("push", "Upload your commits to GitHub."),
                ("pull", "Download latest commits from GitHub."),
                ("merge", "Bring one branch's changes into another branch."),
                ("pull request", "A GitHub review page before merging."),
                ("remote", remote),
            ],
            ("Git Word", "Plain-English Meaning"),
        ),
        H2("Simple branch example"),
        Number(
            [
                "main has the current stable app.",
                "Create a branch called fix-login.",
                "Change login code on fix-login.",
                "Run tests.",
                "Commit the change.",
                "Push branch to GitHub.",
                "Merge fix-login into main only when you are happy.",
            ]
        ),
        H2("Commands you can safely ask Codex to run"),
        KeyTable(
            [
                ("Check current branch", "git branch --show-current"),
                ("Check changed files", "git status --short"),
                ("See a summary of edits", "git diff --stat"),
                ("Create a new branch", "git switch -c codex/short-change-name"),
                ("Switch branch", "git switch branch-name"),
                ("Save changes", "git add selected-files then git commit -m \"message\""),
                ("Upload branch", "git push -u origin branch-name"),
            ],
            ("Goal", "Command"),
        ),
        H2("Git safety rules"),
        Bullet(
            [
                "Do not commit real secrets such as database passwords, API keys, PayHere secrets, SMTP passwords, or private keys.",
                "Do not run destructive commands unless you fully understand them.",
                "Avoid git reset --hard unless you intentionally want to throw away local work.",
                "Before major changes, ask Codex to check git status and explain what files are already modified.",
                "Use one branch per meaningful change when possible.",
                "Commit only after build/tests pass, unless the commit is intentionally a work-in-progress.",
            ]
        ),
        Callout(
            "Best prompt.",
            "Before editing, say: 'Check git status first. Do not overwrite unrelated changes. Make a safe branch if needed. Then fix the issue and run tests.'",
            GREEN,
        ),
        Spacer(1, 10),
        H1("Part 5 - How Changes Should Be Made Safely"),
        P(
            "Every app change should follow a simple loop: understand, edit, build, test, explain. This protects you from accidental breakage, especially when using AI coding tools."
        ),
        H2("The safe change loop"),
        Number(
            [
                "Describe the change in plain English.",
                "Ask Codex to inspect the relevant files before editing.",
                "Ask Codex to make the smallest reasonable change.",
                "Run frontend build if the user interface changed.",
                "Run backend build or tests if API/database/auth/payment changed.",
                "Open the app and manually test the exact user flow.",
                "Ask for a summary of changed files and remaining risks.",
            ]
        ),
        H2("Which checks to run"),
        DataTable(
            ["Type Of Change", "Minimum Check", "Why"],
            [
                ["Text, color, layout", "npm run build:frontend", "Confirms React/CSS build still works."],
                ["Login/register/auth", "npm test and manual login/register", "Auth bugs can lock users out."],
                ["Quiz submit/results", "npm test plus manual student quiz flow", "Scoring/results must be trusted."],
                ["Admin content", "npm run build:backend and manual admin CRUD", "Admin data changes affect courses/questions."],
                ["Payment", "Backend tests plus sandbox/live payment test", "Money flow must be tested outside code only."],
                ["Email reset", "SMTP test with real email", "Password reset depends on external email provider."],
                ["Native app", "npm run mobile:cap:sync then device test", "Native bundle can lag behind web code."],
                ["Production deploy", "npm test, npm run build, health checks, manual role checks", "Final safety gate."],
            ],
            [1.6, 2.2, 2.7],
        ),
        H2("What changed recently in plain English"),
        Bullet(
            [
                "Quiz finish animation was made more expressive and centered, with review transition behavior.",
                "Native app support was synced after frontend changes.",
                "Local native API IP was adjusted for your network, including 172.20.10.2 during testing.",
                "Dark mode cards were made darker while keeping page backgrounds mostly unchanged.",
                "SEO metadata, robots.txt, sitemap.xml, refund policy, and cookie policy were added.",
                "A fake Google sign-in button was removed so users do not click an unfinished login option.",
            ]
        ),
        H2("Manual test checklist after a UI change"),
        Bullet(
            [
                "Open public website.",
                "Open login page.",
                "Login as student.",
                "Open dashboard.",
                "Start a quiz.",
                "Finish quiz and check finish animation.",
                "Confirm automatic review/result navigation works.",
                "Switch light/dark mode if available.",
                "Check on narrow/mobile width.",
                "Logout and login as admin.",
                "Check admin dashboard and one content page.",
            ]
        ),
        Spacer(1, 10),
        H1("Part 6 - Launch Readiness"),
        P(
            "Launch is not only code. A real launch needs domain, HTTPS, production environment variables, database backups, payment setup, email setup, legal pages, monitoring, and manual testing."
        ),
        H2("Critical blockers before launch"),
        DataTable(
            ["Blocker", "What Must Be True", "Who/Where"],
            [
                ["Domain", "A real domain is connected and production URLs point to it.", "Hosting/DNS and project env files."],
                ["HTTPS", "Website and API load over https, not plain http.", "Hosting/reverse proxy."],
                ["Production API", "Frontend calls the public production API, not localhost or LAN IP.", "Frontend env/build."],
                ["Database", "Production DB exists with correct user, password, schema, and backups.", "Hosting/MySQL."],
                ["Secrets", "JWT/session/settings keys are long and private.", "Backend environment."],
                ["Email", "Password reset sends real email successfully.", "SMTP settings."],
                ["Payment", "PayHere live payment and notify webhook are tested end to end.", "Admin settings/PayHere."],
                ["Legal", "Privacy, Terms, Refund, Cookie pages contain real business information.", "Website pages and legal review."],
                ["Monitoring", "Uptime/error alerts exist for API, database, payment, email, and disk space.", "Hosting/monitoring tool."],
                ["Manual QA", "Student, admin, logged-out, mobile, and payment flows are tested.", "You/Codex/testing person."],
            ],
            [1.45, 3.15, 1.9],
        ),
        H2("Files with domain placeholders"),
        Bullet(
            [
                "frontend/index.html",
                "frontend/public/robots.txt",
                "frontend/public/sitemap.xml",
                "backend/.env.example and production backend env",
                "frontend/.env.example and production frontend env",
                "frontend/.env.capacitor.example and native production env",
            ]
        ),
        H2("Production env values in plain English"),
        KeyTable(
            [
                ("FRONTEND_URL", "Your public website URL."),
                ("FRONTEND_URLS", "Allowed browser origins that may call the API."),
                ("APP_PUBLIC_URL", "Public LMS app URL used in links."),
                ("API_PUBLIC_URL", "Public backend API URL."),
                ("ALLOW_LAN_ORIGINS", "Should be false in production."),
                ("SETTINGS_ENCRYPTION_KEY", "Long secret used to protect saved settings."),
                ("HEALTH_METRICS_TOKEN", "Secret token for protected metrics."),
                ("DB_HOST/DB_USER/DB_PASSWORD/DB_NAME", "Production database connection details."),
                ("VITE_API_BASE_URL", "Frontend's API target."),
                ("VITE_PUBLIC_WEBSITE_URL", "Public website URL used by metadata."),
            ],
            ("Variable", "Meaning"),
        ),
        H2("What not to launch with"),
        Bullet(
            [
                "Do not launch with localhost or LAN IP in production frontend API settings.",
                "Do not launch with ALLOW_LAN_ORIGINS=true.",
                "Do not launch with DB_USER=root or empty database password.",
                "Do not launch if password reset email is untested.",
                "Do not launch if PayHere live payment and notify webhook are untested.",
                "Do not launch without a recent database backup.",
                "Do not launch with example legal policy text only.",
            ]
        ),
        Callout(
            "Launch truth.",
            "A build passing means the code can compile. It does not prove payments, email, DNS, SSL, backups, or legal details are ready.",
            YELLOW,
        ),
        Spacer(1, 10),
        H1("Part 7 - Native App, API IPs, And Local Testing"),
        P(
            "The native app is built with Capacitor. Capacitor packages the React frontend into Android/iOS projects. The native app still needs to call the backend API, so API URLs matter a lot."
        ),
        H2("Why localhost can fail on a phone"),
        P(
            "On your Mac, localhost means your Mac. On a phone, localhost means the phone itself. So a phone usually cannot call http://localhost:3000/api unless the backend is running on the phone, which it is not."
        ),
        KeyTable(
            [
                ("Browser on Mac", "http://localhost:3000/api can work."),
                ("Phone on same Wi-Fi", "Use your Mac's LAN IP, such as http://172.20.10.2:3000/api when that is the current IP."),
                ("Production native app", "Use https://www.xyndrome.lk/api."),
            ],
            ("Situation", "API URL"),
        ),
        H2("Native sync command"),
        P("After frontend/native changes, rebuild and sync Capacitor."),
        Code("npm run mobile:cap:sync\nnpm run mobile:cap:sync:android\nnpm run mobile:cap:sync:ios"),
        H2("If the native app shows old UI"),
        Number(
            [
                "Rebuild/sync Capacitor.",
                "Open Android Studio or Xcode again.",
                "Clean/reinstall app if needed.",
                "Confirm the device can reach the backend API URL.",
            ]
        ),
        Callout(
            "Use HTTPS in production.",
            "A shipped native app should call the public HTTPS API. A local IP is only for testing on your own network.",
            RED,
        ),
        Spacer(1, 10),
        H1("Part 8 - Troubleshooting"),
        P("Use this when something breaks. Start with the simplest checks before assuming the app is ruined."),
        DataTable(
            ["Symptom", "Most Likely Cause", "First Fix"],
            [
                ["Login says Network Error", "Backend API is stopped or unreachable.", "npm run start:api:bg then curl /api/health."],
                ["API health works but ready fails", "Database/MySQL problem.", "Start XAMPP MySQL and check backend .env."],
                ["/api shows 404", "No plain API index route.", "Use /api/health instead."],
                ["Frontend change not visible", "Built bundle is old.", "npm run build:frontend."],
                ["Native app old UI", "Capacitor not synced or app not reinstalled.", "npm run mobile:cap:sync."],
                ["Phone cannot reach API", "Using localhost instead of computer IP.", "Use current LAN IP or production HTTPS API."],
                ["Admin gets 403", "Role/permission problem.", "Check user role and backend permission mapping."],
                ["Results not showing", "Quiz attempts/student answers issue.", "Check quiz-attempts and results API."],
                ["Payment not activating", "PayHere notify/webhook not reaching backend.", "Check public notify URL and logs."],
                ["Password reset email not arriving", "SMTP setting or provider issue.", "Test SMTP settings and logs."],
            ],
            [1.8, 2.25, 2.45],
        ),
        H2("Log locations"),
        Bullet(
            [
                ".runtime/api.log - background API log.",
                "Browser DevTools Network tab - failing frontend requests.",
                "Backend terminal output - API errors during development.",
                "Hosting provider logs - production backend errors.",
            ]
        ),
        H2("First three commands when confused"),
        Code("npm run status:api\ncurl http://localhost:3000/api/health\nnpm run build:frontend"),
        P("If those are clean, then the problem is more specific and should be traced by page/API route."),
        Spacer(1, 10),
        H1("Appendix A - File And Folder Dictionary"),
        P("This section is intentionally simple. Use it when someone mentions a file name and you want to know what it is."),
        DataTable(
            ["Name", "Meaning", "Beginner Warning"],
            [
                ["package.json", "A command/menu file for Node projects. It lists scripts like build and test.", "Edit only when changing commands or dependencies."],
                ["node_modules", "Installed packages downloaded by npm.", "Never edit manually."],
                ["src", "Source code written by developers/AI.", "This is where real code lives."],
                ["dist", "Built output generated from source.", "Do not edit; rebuild."],
                [".env", "Private local settings and secrets.", "Do not upload/share real secrets."],
                [".env.example", "A template showing what env variables exist.", "Safe only if it has no real secrets."],
                ["README.md", "Human-readable project notes.", "Good first file to read."],
                ["router.jsx", "Frontend route map: which URL opens which page.", "Wrong routes can break navigation."],
                ["AppFrame/AppShell", "Main app layout wrapper.", "Changes affect many pages."],
                ["BootLoader", "Loading screen when app starts.", "Affects perceived startup polish."],
                ["controller.ts", "Backend file that receives API requests.", "Usually paired with service.ts."],
                ["service.ts", "Backend file where business logic often lives.", "Changes can affect data behavior."],
                ["schema-sync.service.ts", "Database schema bootstrap/backfill logic.", "Be careful; database structure risk."],
                ["capacitor.config.ts", "Native app config.", "Important for mobile builds."],
                ["robots.txt", "Tells search engines what they may crawl.", "Use real domain at launch."],
                ["sitemap.xml", "List of important public URLs for search engines.", "Use real domain at launch."],
            ],
            [1.55, 3.15, 1.8],
        ),
        Spacer(1, 10),
        H1("Appendix B - Commands Cheat Sheet"),
        DataTable(
            ["Command", "Use It For", "When"],
            [
                ["npm run install:all", "Install frontend/backend dependencies.", "First setup or after package changes."],
                ["npm run start:api", "Start API in current terminal.", "Development when terminal stays open."],
                ["npm run start:api:bg", "Start API in background.", "Daily local use."],
                ["npm run status:api", "Check background API status.", "When login/API fails."],
                ["npm run stop:api:bg", "Stop background API.", "Restarting API."],
                ["npm run dev:frontend", "Start Vite dev server.", "Optional frontend development."],
                ["npm run build:frontend", "Build frontend.", "After UI changes."],
                ["npm run build:backend", "Build backend.", "After API/backend changes."],
                ["npm run build", "Build frontend and backend.", "Before committing/deploying."],
                ["npm test", "Run project QA/security checks.", "Before commit/launch."],
                ["npm run mobile:cap:sync", "Build and sync native bundle.", "After native/frontend changes."],
                ["npm run check:health", "Check local API health.", "When diagnosing API."],
                ["git status --short", "See changed files.", "Before and after edits."],
                ["git branch --show-current", "See branch name.", "Before committing."],
            ],
            [2.15, 2.35, 2.0],
        ),
        Spacer(1, 10),
        H1("Appendix C - Environment Variables In Plain English"),
        P(
            "Environment variables are settings outside the code. They tell the app where the database is, where the API is, and which secret keys to use. Production environment variables are usually set in the server or hosting dashboard, not typed into public GitHub files."
        ),
        H2("Backend variables"),
        KeyTable(
            [
                ("NODE_ENV", "Use production on the live server."),
                ("PORT", "Backend server port, usually 3000 locally."),
                ("FRONTEND_URL/FRONTEND_URLS", "Allowed frontend domains that can call the API."),
                ("APP_PUBLIC_URL", "Public URL used in generated links."),
                ("API_PUBLIC_URL", "Public API URL."),
                ("BODY_LIMIT", "Max request body size."),
                ("ALLOW_LAN_ORIGINS", "Allows local network origins. False in production."),
                ("SETTINGS_ENCRYPTION_KEY", "Protects saved provider/payment/email settings."),
                ("HEALTH_METRICS_TOKEN", "Protects metrics endpoint."),
                ("OPENROUTER/GEMINI keys", "AI provider credentials."),
                ("VAPID/APNS/FCM", "Push notification credentials."),
                ("DB_*", "MySQL database connection."),
            ],
            ("Backend Variable Group", "Meaning"),
        ),
        H2("Frontend variables"),
        KeyTable(
            [
                ("VITE_API_BASE_URL", "Main API URL the frontend calls."),
                ("VITE_API_BASE_URLS", "Fallback API URLs."),
                ("VITE_API_REQUEST_TIMEOUT_MS", "How long frontend waits for API response."),
                ("VITE_PWA_SW_URL/SCOPE", "Progressive Web App service worker paths."),
                ("VITE_LMS_BUILD_TARGET", "web, pwa, native, or desktop build target."),
                ("VITE_ENABLE_PWA", "Whether PWA features are enabled."),
                ("VITE_PUBLIC_WEBSITE_URL", "Public website URL used by metadata."),
                ("VITE_APP_ONLY_HOSTS", "Domains that should open app-only surface."),
            ],
            ("Frontend Variable", "Meaning"),
        ),
        Callout(
            "Secret rule.",
            "If a value can give access to money, user data, database, email, AI billing, or private admin functions, treat it as a secret.",
            RED,
        ),
        Spacer(1, 10),
        H1("Appendix D - What To Ask Codex"),
        P("Good prompts tell Codex the result you want, the risk level, and what checks to run."),
        H2("General safe fix prompt"),
        Code("I do not know the file names. Please inspect the project, find the right files, fix this issue, do not overwrite unrelated changes, then run the relevant build/tests and explain what changed."),
        H2("UI change prompt"),
        Code("Make this UI change: [describe]. Keep light/dark mode working. Check desktop and mobile layout. Run npm run build:frontend. Tell me which files changed."),
        H2("Backend/API prompt"),
        Code("Fix this API/backend issue: [describe]. Check the route/controller/service. Run backend build and relevant tests. Explain any database risk."),
        H2("Launch readiness prompt"),
        Code("Review launch readiness again. Check domain placeholders, env files, SEO files, legal pages, payment/email readiness, security, tests, and tell me what is still blocked."),
        H2("Git prompt"),
        Code("Before editing, check git status and current branch. If needed, create a branch with codex/ prefix. After the fix, show changed files and ask before committing."),
        Spacer(1, 10),
        H1("Appendix E - 30 Day Learning Path For Owning This App"),
        P("This is not a computer science course. It is a practical path so you can talk to developers and AI tools with confidence."),
        DataTable(
            ["Days", "Focus", "Goal"],
            [
                ["1-3", "Open app locally", "Start XAMPP, API, login page, health check without panic."],
                ["4-6", "Folder map", "Know frontend, backend, database, docs, scripts, native folders."],
                ["7-9", "Git basics", "Understand main, branch, commit, push, pull, merge."],
                ["10-12", "Frontend basics", "Know where pages, shared components, styles, and API clients live."],
                ["13-15", "Backend basics", "Know controller, service, module, env, database connection."],
                ["16-18", "Debug basics", "Use API health, build output, logs, browser Network tab."],
                ["19-21", "Launch basics", "Understand domain, HTTPS, env vars, backups, monitoring."],
                ["22-24", "Payments/email", "Understand why PayHere and SMTP require real external testing."],
                ["25-27", "Native basics", "Understand localhost vs LAN IP vs production HTTPS API."],
                ["28-30", "Safe AI workflow", "Ask better prompts, demand tests, read summaries, avoid secrets."],
            ],
            [0.75, 1.85, 3.9],
        ),
        H2("The only things to memorize first"),
        Bullet(
            [
                "Project folder: /Applications/XAMPP/xamppfiles/htdocs/lms",
                "Local login: http://localhost/lms/auth/login",
                "API health: http://localhost:3000/api/health",
                "Build frontend: npm run build:frontend",
                "Run QA: npm test",
                "Check branch: git branch --show-current",
                "Check changed files: git status --short",
            ]
        ),
        PageBreak(),
        H1("Appendix F - Important Routes In The App"),
        P(
            "Routes are URL paths. A route tells the frontend which page to open. The same built React app serves the public website, student app, and admin console."
        ),
        DataTable(
            ["Area", "Route", "What It Opens"],
            [
                ["Website", "/", "Public landing website."],
                ["Website", "/login or /auth/login", "Login page."],
                ["Website", "/register or /auth/register", "Register page."],
                ["Website", "/terms", "Terms page."],
                ["Website", "/privacy-policy", "Privacy policy."],
                ["Website", "/refund-policy", "Refund policy."],
                ["Website", "/cookie-policy", "Cookie policy."],
                ["Website", "/ai", "AI question builder page."],
                ["Student", "/app/dashboard", "Student dashboard."],
                ["Student", "/app/courses", "Course list."],
                ["Student", "/app/quizzes", "Practice quizzes."],
                ["Student", "/app/results", "Student results list."],
                ["Student", "/app/review/:attemptId", "Quiz review page."],
                ["Admin", "/admin/dashboard", "Admin dashboard."],
                ["Admin", "/admin/questions", "Question bank."],
                ["Admin", "/admin/quizzes", "Quiz management."],
                ["Admin", "/admin/users", "User management."],
                ["Admin", "/admin/settings", "Settings."],
            ],
            [1.1, 2.15, 3.25],
        ),
        KeepTogether(
            [
                H2("Important API endpoints"),
                DataTable(
                    ["Method", "API Route", "What It Is For"],
                    [
                        ["GET", "/api/health", "Basic API health check."],
                        ["GET", "/api/health/ready", "API plus database readiness check."],
                        ["POST", "/api/auth/login", "Login request."],
                        ["POST", "/api/auth/register", "Register request."],
                        ["GET", "/api/auth/me", "Current logged-in user."],
                        ["POST", "/api/auth/forgot-password", "Start password reset."],
                        ["GET", "/api/courses/student", "Student course list."],
                        ["GET", "/api/quiz-attempts/quizzes", "Student quiz list."],
                        ["POST", "/api/quiz-attempts/exam/:quizId/submit", "Submit exam quiz."],
                        ["GET", "/api/results/:attemptId", "Result detail."],
                        ["POST", "/api/subscriptions/payhere/initiate", "Start PayHere payment."],
                        ["POST", "/api/subscriptions/payhere/notify", "PayHere webhook/notification."],
                    ],
                    [0.7, 2.7, 3.1],
                ),
            ]
        ),
        Spacer(1, 10),
        H1("Appendix G - Manual QA Script Before Launch"),
        P(
            "Manual QA means a human actually opens the app and behaves like a real user. Automated tests help, but they cannot prove every payment, email, mobile, and design experience."
        ),
        H2("Logged-out visitor")
        ,
        Bullet(
            [
                "Open public website.",
                "Check top navigation links.",
                "Open login and register pages.",
                "Open Terms, Privacy, Refund, and Cookie pages.",
                "Check mobile width.",
                "Confirm no unfinished or placeholder copy appears.",
            ]
        ),
        H2("Student user"),
        Bullet(
            [
                "Login as student.",
                "Open dashboard.",
                "Open courses.",
                "Open a lesson.",
                "Open quizzes.",
                "Take a quiz from start to finish.",
                "Watch finish animation.",
                "Confirm result/review page opens correctly.",
                "Check billing/subscription page.",
                "Logout.",
            ]
        ),
        H2("Admin user"),
        Bullet(
            [
                "Login as admin.",
                "Open admin dashboard.",
                "Open courses, structure, users, questions, quizzes, subscriptions, reports, settings.",
                "Create/edit one safe test item if using a staging database.",
                "Confirm unauthorized users cannot open admin pages.",
                "Logout.",
            ]
        ),
        H2("Production services"),
        Bullet(
            [
                "Send a password reset email through real SMTP.",
                "Complete one low-value live PayHere payment.",
                "Confirm PayHere notify webhook activates the subscription.",
                "Confirm database backup exists before launch.",
                "Confirm uptime monitoring is enabled.",
                "Confirm error logs are visible.",
            ]
        ),
        Spacer(1, 10),
        KeepTogether(
            [
                H1("Appendix H - Beginner Glossary"),
                DataTable(
                    ["Word", "Meaning", "Why It Matters"],
                    [
                        ["API", "A URL-based way for frontend and backend to talk.", "Most data problems happen here."],
                        ["Backend", "Server code that handles logic and data.", "Protects users, quizzes, payments, settings."],
                        ["Build", "Turns source code into runnable output.", "Needed after code changes."],
                        ["Cache", "Stored old files/data.", "Can make old UI appear."],
                        ["CORS", "Browser rule about which websites can call API.", "Wrong CORS can block login/API."],
                        ["Database", "Stored app data.", "Needs backups and careful changes."],
                        ["Deploy", "Put app onto live server.", "Launch step."],
                        ["DNS", "Domain name routing.", "Needed for real domain."],
                        ["Environment variable", "Private setting outside code.", "Keeps secrets/config out of source."],
                        ["Frontend", "Visible user interface.", "Most design changes live here."],
                        ["HTTPS", "Secure website connection.", "Required for production trust."],
                        ["localhost", "This same machine.", "Works on Mac, not automatically on phone."],
                        ["Migration", "Database structure update.", "Needs backup before production."],
                        ["Native app", "Android/iOS app wrapper.", "Needs correct API URL."],
                        ["Node/npm", "JavaScript runtime and package manager.", "Runs build/test commands."],
                        ["Pull request", "Review page before merging branch.", "Safer Git workflow."],
                        ["Reverse proxy", "Server rule forwarding /api to backend.", "Needed in production."],
                        ["SEO", "Search engine basics.", "Needs titles, sitemap, robots."],
                        ["SMTP", "Email sending service.", "Needed for password reset."],
                        ["Webhook", "External service calls your backend.", "PayHere uses notify webhook."],
                    ],
                    [1.55, 2.65, 2.3],
                ),
            ]
        ),
        Spacer(1, 10),
        H1("Appendix I - Handover Sheet For A Hosting Person"),
        P(
            "If you hire someone or ask a hosting support person to deploy the app, give them this list. It prevents vague conversations."
        ),
        Bullet(
            [
                "Project type: React frontend plus NestJS backend plus MySQL database.",
                "Local project path: /Applications/XAMPP/xamppfiles/htdocs/lms.",
                "Frontend build command: npm run build:frontend.",
                "Backend build command: npm run build:backend.",
                "Full build command: npm run build.",
                "QA command: npm test.",
                "Backend port: 3000 by default.",
                "API base path: /api.",
                "Frontend build output: frontend/dist.",
                "Backend build output: backend/dist.",
                "Production must reverse proxy /api to the backend.",
                "Production must serve frontend through HTTPS.",
                "Production database should not use root user.",
                "Backups must include MySQL database and upload folders.",
                "PayHere notify URL must be public HTTPS and point to backend.",
                "Native app production API must be public HTTPS, not local IP.",
            ]
        ),
        Callout(
            "Final reminder.",
            "You can own this app by using maps, checklists, backups, and safe Git branches. You do not need to memorize every file name. You need to ask for careful changes and verify the important flows.",
            GREEN,
        ),
    ]
    return story


def build():
    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=letter,
        rightMargin=0.85 * inch,
        leftMargin=0.85 * inch,
        topMargin=0.72 * inch,
        bottomMargin=0.62 * inch,
        title="xyndrome LMS Beginner Owner Guide",
        author="Codex",
    )
    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc.build(build_story(), onFirstPage=page_footer, onLaterPages=page_footer)
    print(OUT)


if __name__ == "__main__":
    build()
