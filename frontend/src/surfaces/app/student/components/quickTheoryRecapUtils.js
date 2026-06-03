function normalizeRecapArray(value) {
  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map(String).map((item) => item.trim()).filter(Boolean);
      }
    } catch {
      // Fall back to line-based admin drafts.
    }

    return trimmed.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  }

  return [];
}

export function normalizeQuickTheoryRecap(recap) {
  if (!recap) return null;

  const hierarchy = recap.hierarchy || {};
  return {
    ...recap,
    conceptName: recap.conceptName || recap.concept_name || '',
    hierarchy: {
      course: hierarchy.course || recap.hierarchyCourse || recap.hierarchy_course || '',
      subject: hierarchy.subject || recap.hierarchySubject || recap.hierarchy_subject || '',
      topic: hierarchy.topic || recap.hierarchyTopic || recap.hierarchy_topic || '',
      lesson: hierarchy.lesson || recap.hierarchyLesson || recap.hierarchy_lesson || '',
    },
    etiology: normalizeRecapArray(recap.etiology),
    pathophysiology: normalizeRecapArray(recap.pathophysiology),
    clinicalFeatures: normalizeRecapArray(recap.clinicalFeatures || recap.clinical_features),
    investigations: normalizeRecapArray(recap.investigations),
    treatment: normalizeRecapArray(recap.treatment),
    keyPoints: normalizeRecapArray(recap.keyPoints || recap.key_points),
    mnemonic: String(recap.mnemonic || '').trim(),
  };
}

export function hasQuickTheoryRecapContent(recap) {
  const normalized = normalizeQuickTheoryRecap(recap);
  return Boolean(normalized && (
    normalized.etiology.length ||
    normalized.pathophysiology.length ||
    normalized.clinicalFeatures.length ||
    normalized.investigations.length ||
    normalized.treatment.length ||
    normalized.keyPoints.length ||
    normalized.mnemonic
  ));
}
