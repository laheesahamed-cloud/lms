// Demo-page content (OPTIMIZE 10.52) — written by hand, shipped in the page: no requests, no database.
// Topic: acute coronary syndrome. Facts checked against ESC 2023 ACS / NICE guidance; no drug doses.
export const TRY_CONTENT = {
  lesson: {
    title: 'Acute coronary syndrome',
    // A small piece of the lesson — just enough to show the pen marks.
    sections: [
      { heading: 'Symptoms', points: [
        'Central chest pain for more than 15 minutes, radiating to the arm or jaw, with sweating or breathlessness.',
      ] },
      { heading: 'Diagnosis', points: [
        '12-lead ECG within 10 minutes of arrival.',
        'STEMI: ST elevation in two contiguous leads.',
        'NSTEMI: troponin rises. Unstable angina: it does not.',
      ] },
      { heading: 'Treatment', points: [
        'Aspirin, pain relief; oxygen only if saturation is low.',
        'STEMI: primary PCI if possible within 120 minutes, otherwise fibrinolysis.',
      ] },
    ],
    keyPoint: 'STEMI is diagnosed on the ECG — never wait for the troponin.',
    // The marks the demo draws by itself: pastel highlighters, a pen and a pencil.
    marks: [
      { text: 'radiating to the arm or jaw', kind: 'highlight', tone: 'pink' },
      { text: 'within 10 minutes', kind: 'underline', tool: 'pen' },
      { text: 'two contiguous leads', kind: 'underline', tool: 'pencil' },
      { text: 'oxygen only if saturation is low', kind: 'highlight', tone: 'mint' },
      { text: 'within 120 minutes', kind: 'highlight', tone: 'lilac' },
    ],
    note: 'time is muscle!',
  },
  // One practice question with everything the app shows after an answer.
  question: {
    stem: 'A 58-year-old man has had central crushing chest pain radiating to his left arm for 1 hour, with sweating. The ECG shows ST elevation in II, III and aVF. The nearest PCI centre is 45 minutes away. What is the most appropriate management?',
    highlights: ['central crushing chest pain', '1 hour', 'sweating', 'ST elevation in II, III and aVF', '45 minutes away'],
    options: [
      { label: 'A', text: 'Primary PCI', correct: true },
      { label: 'B', text: 'Thrombolysis', correct: false, why: 'Fibrinolysis is for when primary PCI cannot be done within 120 minutes of diagnosis — here it can.' },
      { label: 'C', text: 'Serial troponin and repeat ECG in 3 hours', correct: false, why: 'STEMI is diagnosed on the ECG. Waiting for troponin wastes heart muscle.' },
      { label: 'D', text: 'CT pulmonary angiography', correct: false, why: 'Nothing points to a PE, and the ECG already shows a STEMI.' },
      { label: 'E', text: 'Discharge with GTN spray', correct: false, why: 'He is having a heart attack; he needs reperfusion now.' },
    ],
    explanation: 'Ischaemic chest pain with ST elevation in the inferior leads is an inferior STEMI. Symptoms began under 12 hours ago and a PCI centre is reachable well within 120 minutes, so primary PCI is the reperfusion of choice.',
    approach: [
      { clue: 'central crushing chest pain', text: 'Classic ischaemic pain — think acute coronary syndrome first.' },
      { clue: '1 hour', text: 'Onset under 12 hours: he is within the window for reperfusion.' },
      { clue: 'sweating', text: 'Autonomic features make a true infarct more likely.' },
      { clue: 'ST elevation in II, III and aVF', text: 'Two or more contiguous inferior leads = inferior STEMI, usually the right coronary artery. Get right-sided leads before giving nitrates.' },
      { clue: '45 minutes away', text: 'PCI is achievable within 120 minutes of diagnosis, so it beats thrombolysis.' },
    ],
    keyPoints: [
      'ECG within 10 minutes of arrival for anyone with chest pain.',
      'STEMI = ST elevation in two contiguous leads; do not wait for troponin.',
      'Primary PCI if possible within 120 minutes of diagnosis; otherwise fibrinolysis if symptoms began within 12 hours.',
      'Inferior STEMI: check right-sided leads (V4R) — right ventricular infarction drops the blood pressure with nitrates.',
    ],
    recap: {
      concept: 'ST-elevation myocardial infarction',
      sections: [
        { heading: 'Causes and risks', points: ['Plaque rupture or erosion with a clot blocking a coronary artery', 'Risk factors: smoking, diabetes, hypertension, high cholesterol, family history, older age, male sex'] },
        { heading: 'How it develops', points: ['A complete blockage starves the full thickness of the muscle', 'Muscle dies over hours — the sooner the artery opens, the more is saved'] },
        { heading: 'Clinical features', points: ['Chest pain over 20 minutes, to the arm, jaw or neck', 'Sweating, nausea, breathlessness; can be silent in diabetes'] },
        { heading: 'Investigations', points: ['12-lead ECG within 10 minutes', 'High-sensitivity troponin, FBC, U&E, glucose, lipids', 'Echocardiogram for heart function'] },
        { heading: 'Treatment', points: ['Aspirin plus a second antiplatelet; pain relief', 'Primary PCI, or fibrinolysis if PCI is not possible in time', 'Then dual antiplatelets, statin, beta-blocker, ACE inhibitor, cardiac rehab'] },
      ],
    },
  },
  // 5 short questions, always 5 options (A–E). Keys checked against ESC 2023 ACS guidance.
  exam: {
    minutes: 2,
    questions: [
      {
        stem: 'A man has central chest pain and arrives at the emergency department. What is the first test?',
        options: [
          { label: 'A', text: '12-lead ECG', correct: true },
          { label: 'B', text: 'Troponin', correct: false, why: 'Needed, but the ECG comes first — within 10 minutes.' },
          { label: 'C', text: 'Chest X-ray', correct: false, why: 'Useful later; it does not diagnose a STEMI.' },
          { label: 'D', text: 'Echocardiogram', correct: false, why: 'Not the first test for chest pain.' },
          { label: 'E', text: 'CT coronary angiogram', correct: false, why: 'For stable chest pain, not the acute setting.' },
        ],
        explanation: 'Anyone with suspected ACS needs a 12-lead ECG within 10 minutes of arrival — it finds a STEMI straight away.',
      },
      {
        stem: 'Suspected NSTEMI. Which blood test confirms heart muscle injury?',
        options: [
          { label: 'A', text: 'High-sensitivity troponin', correct: true },
          { label: 'B', text: 'D-dimer', correct: false, why: 'Used to rule out a clot (PE, DVT), not heart muscle injury.' },
          { label: 'C', text: 'BNP', correct: false, why: 'A marker of heart failure.' },
          { label: 'D', text: 'CRP', correct: false, why: 'A non-specific marker of inflammation.' },
          { label: 'E', text: 'Amylase', correct: false, why: 'A test for pancreatitis.' },
        ],
        explanation: 'A rise and/or fall of high-sensitivity troponin shows heart muscle injury and separates NSTEMI from unstable angina.',
      },
      {
        stem: 'Inferior STEMI. His blood pressure falls after GTN; his lungs are clear. What is the likely cause?',
        options: [
          { label: 'A', text: 'Right ventricular infarction', correct: true },
          { label: 'B', text: 'Left ventricular failure', correct: false, why: 'Would give crackles and pulmonary oedema, not clear lungs.' },
          { label: 'C', text: 'Septic shock', correct: false, why: 'Nothing points to infection.' },
          { label: 'D', text: 'Aortic stenosis', correct: false, why: 'Not a new event after an inferior MI.' },
          { label: 'E', text: 'Hypoglycaemia', correct: false, why: 'Does not explain the fall after GTN.' },
        ],
        explanation: 'The right coronary artery also supplies the right ventricle. A right ventricular infarct needs its filling pressure, so nitrates drop the blood pressure; the lungs stay clear. Give fluids and avoid nitrates.',
      },
      {
        stem: 'Three days after an inferior MI he becomes suddenly breathless, with a new loud pansystolic murmur at the apex. What is the cause?',
        options: [
          { label: 'A', text: 'Papillary muscle rupture', correct: true },
          { label: 'B', text: "Dressler's syndrome", correct: false, why: 'Pericarditis weeks later, with a rub — not a pansystolic murmur.' },
          { label: 'C', text: 'Left ventricular aneurysm', correct: false, why: 'Develops over weeks, with persistent ST elevation.' },
          { label: 'D', text: 'Pulmonary embolism', correct: false, why: 'Does not cause a new murmur.' },
          { label: 'E', text: 'Pericardial effusion', correct: false, why: 'Gives quiet heart sounds, not a loud murmur.' },
        ],
        explanation: 'Sudden pulmonary oedema with a new apical pansystolic murmur days after an MI is acute mitral regurgitation from papillary muscle rupture. It needs urgent echo and surgery.',
      },
      {
        stem: 'Which of these lowers the risk of death after an MI?',
        options: [
          { label: 'A', text: 'Statin', correct: true },
          { label: 'B', text: 'Digoxin', correct: false, why: 'Controls heart rate; it does not lower the risk of death.' },
          { label: 'C', text: 'Furosemide', correct: false, why: 'Relieves fluid overload only.' },
          { label: 'D', text: 'Short-acting nifedipine', correct: false, why: 'Can cause reflex tachycardia; avoided after an MI.' },
          { label: 'E', text: 'Amiodarone', correct: false, why: 'Treats arrhythmias; not routine after an MI.' },
        ],
        explanation: 'After an MI, a high-intensity statin is used together with dual antiplatelets, a beta-blocker and an ACE inhibitor. All of these lower the risk of death.',
      },
    ],
  },
  flashcard: {
    front: 'In STEMI, when is primary PCI chosen over fibrinolysis?',
    back: 'When it can be done within 120 minutes of diagnosis — otherwise fibrinolysis, if symptoms began within 12 hours.',
  },
  ratings: [
    { label: 'Again', next: 'in 1 min' },
    { label: 'Hard', next: 'in 6 min' },
    { label: 'Good', next: 'in 10 min' },
    { label: 'Easy', next: 'in 4 days' },
  ],
  // Sample data for the Progress & analysis step (labelled as a sample on screen).
  progress: {
    readiness: [
      { subject: 'Cardio', pct: 78 },
      { subject: 'Haem', pct: 64 },
      { subject: 'Resp', pct: 52 },
      { subject: 'Renal', pct: 35 },
    ],
    trend: [48, 55, 52, 61, 66, 63, 72],
    weak: [
      { topic: 'Acid–base', subject: 'Renal', pct: 38, missed: 13 },
      { topic: 'Glomerular disease', subject: 'Renal', pct: 44, missed: 9 },
      { topic: 'Arrhythmias', subject: 'Cardio', pct: 51, missed: 7 },
    ],
    strong: { topic: 'Acute coronary syndrome', pct: 92 },
    stats: [{ value: '312', label: 'questions done' }, { value: '9 days', label: 'study streak' }, { value: '72%', label: 'last mock' }],
  },
  planner: [
    { kind: 'Read', title: 'Acute coronary syndrome', meta: '5 min', done: true },
    { kind: 'Practise', title: 'Cardiology set 1', meta: '20 questions', done: false },
    { kind: 'Review', title: 'Flashcards due', meta: '12 cards', done: false },
    { kind: 'Exam', title: 'Medicine mock 3', meta: 'Saturday', done: false },
  ],
  streak: { days: 10, points: 40 },
  comingSoon: [
    { title: 'OSCE stations', text: 'History, examination and counselling stations with checklists.' },
    { title: 'Heart & lung sounds', text: 'Listen, identify, and quiz on auscultation.' },
    { title: 'Drug cards', text: 'Classes, actions and key side effects at a glance.' },
  ],
};
