import React from 'react';
import { createRoot } from 'react-dom/client';
import { MedicalText } from '/@fs/Applications/XAMPP/xamppfiles/htdocs/lms/frontend/src/shared/components/MedicalText.jsx';

const clinicalCopy = "![Chest x-ray showing right lower lobe consolidation](data:image/svg+xml;charset=utf-8,%0A%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%201280%20720%22%3E%0A%20%20%3Crect%20width%3D%221280%22%20height%3D%22720%22%20fill%3D%22%23eef4f8%22%2F%3E%0A%20%20%3Crect%20x%3D%22140%22%20y%3D%2270%22%20width%3D%221000%22%20height%3D%22580%22%20rx%3D%2236%22%20fill%3D%22%23d9e6ee%22%20stroke%3D%22%2393a7b5%22%20stroke-width%3D%228%22%2F%3E%0A%20%20%3Cellipse%20cx%3D%22480%22%20cy%3D%22355%22%20rx%3D%22210%22%20ry%3D%22250%22%20fill%3D%22%23f8fbfd%22%20stroke%3D%22%238297a6%22%20stroke-width%3D%227%22%2F%3E%0A%20%20%3Cellipse%20cx%3D%22800%22%20cy%3D%22355%22%20rx%3D%22210%22%20ry%3D%22250%22%20fill%3D%22%23f8fbfd%22%20stroke%3D%22%238297a6%22%20stroke-width%3D%227%22%2F%3E%0A%20%20%3Cpath%20d%3D%22M760%20438c70-28%20150-30%20238-8%2018%205%2027%2026%2017%2043-42%2071-126%20117-220%20117-88%200-168-40-213-104-12-18-4-42%2016-50%2053-21%20107-20%20162%202z%22%20fill%3D%22%23b9d2df%22%2F%3E%0A%20%20%3Cpath%20d%3D%22M640%20120v490%22%20stroke%3D%22%238297a6%22%20stroke-width%3D%2212%22%20stroke-linecap%3D%22round%22%2F%3E%0A%20%20%3Ctext%20x%3D%22640%22%20y%3D%22676%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%2C%20sans-serif%22%20font-size%3D%2236%22%20fill%3D%22%23365465%22%3EClinical%20image%20fixture%3C%2Ftext%3E%0A%3C%2Fsvg%3E%0A \"Chest radiograph\")\n\n| Finding | Learner-facing value | Reference range |\n| --- | --- | --- |\n| SpO2 | 91% on air | 94-98% |\n| Respiratory rate | 28/min | 12-20/min |\n| CURB-65 | Confusion absent, urea pending, RR high, BP normal, age 68 | Escalate if score is 2 or more |\n\nIn this case, <abbr title=\"community-acquired pneumonia\">CAP</abbr> is supported by fever and focal signs. Check [abbr:ECG|electrocardiogram] before macrolide therapy when QT risk is present.\n\nFormula checks: \\\\(QTc = QT / \\\\sqrt{RR}\\\\), \\\\[A-a = PAO_2 - PaO_2\\\\], and $Na - (Cl + HCO_3)$.\n\nUse current local antimicrobial guidance and review the source note before publishing.[^1]\n\n[^1]: Medical content quality gate fixture, reviewed workflow sample, version v4.";

function App() {
  return (
    <main className="medical-content-fixture">
      <section className="medical-content-panel">
        <h1>Medical Content Rendering Fixture</h1>
        <MedicalText className="medical-text-rendered" text={clinicalCopy} imageLoading="eager" imageFetchPriority="high" />
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
