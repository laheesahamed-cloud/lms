import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/api_client.dart';

String _s(dynamic v) => v == null ? '' : v.toString();
int _i(dynamic v) => v == null ? 0 : (v is int ? v : int.tryParse(v.toString()) ?? 0);
double _d(dynamic v) =>
    v == null ? 0 : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);
Map<String, dynamic> _m(dynamic v) =>
    v is Map ? Map<String, dynamic>.from(v) : <String, dynamic>{};
List<dynamic> _l(dynamic v) => v is List ? v : const [];

/* ─────────────────────────── models ─────────────────────────── */

/// A subject within a course — Cardiology under Medicine. These are the
/// station categories, taken straight from the course structure.
class OsceSystem {
  final int id;
  final String key;
  final String name;
  final String iconKey;
  final int caseCount;
  final int courseId;
  final String courseTitle;
  final bool locked;
  OsceSystem({
    required this.id,
    required this.key,
    required this.name,
    required this.iconKey,
    required this.caseCount,
    required this.courseId,
    required this.courseTitle,
    required this.locked,
  });
  factory OsceSystem.fromJson(dynamic raw) {
    final m = _m(raw);
    return OsceSystem(
      id: _i(m['id']),
      key: _s(m['key']),
      name: _s(m['name']),
      iconKey: _s(m['iconKey']),
      caseCount: _i(m['caseCount']),
      courseId: _i(m['courseId']),
      courseTitle: _s(m['courseTitle']),
      locked: m['locked'] == true,
    );
  }
}

class OsceCourse {
  final int id;
  final String title;
  final int caseCount;
  final int subjectCount;
  final bool locked;
  OsceCourse({
    required this.id,
    required this.title,
    required this.caseCount,
    required this.subjectCount,
    required this.locked,
  });
  factory OsceCourse.fromJson(dynamic raw) {
    final m = _m(raw);
    return OsceCourse(
      id: _i(m['id']),
      title: _s(m['title']),
      caseCount: _i(m['caseCount']),
      subjectCount: _i(m['subjectCount']),
      locked: m['locked'] == true,
    );
  }
}

class OsceCaseSummary {
  final int id;
  final String title;
  final String slug;
  final String summary;
  final String systemName;
  final String difficulty;
  final OsceImage? cover;
  final bool locked;
  final String stationType;
  final bool favourite;
  final bool completed;
  OsceCaseSummary({
    required this.id,
    required this.title,
    required this.slug,
    required this.summary,
    required this.systemName,
    required this.difficulty,
    required this.cover,
    required this.locked,
    required this.stationType,
    required this.favourite,
    required this.completed,
  });
  factory OsceCaseSummary.fromJson(dynamic raw) {
    final m = _m(raw);
    return OsceCaseSummary(
      id: _i(m['id']),
      title: _s(m['title']),
      slug: _s(m['slug']),
      summary: _s(m['summary']),
      systemName: _s(m['systemName']),
      difficulty: _s(m['difficulty']),
      cover: OsceImage.fromJson(m['cover']),
      locked: m['locked'] == true,
      stationType: _s(m['stationType']).isEmpty ? 'short' : _s(m['stationType']),
      favourite: m['favourite'] == true,
      completed: m['completed'] == true,
    );
  }
}

/// A slot's media — a still or a short clip. Some findings only read as
/// movement (a JVP pulsation, a gait, a tremor), so a slot can hold either.
class OsceImage {
  final String full;
  final String thumb;
  final String kind; // 'image' | 'video'
  OsceImage({required this.full, required this.thumb, this.kind = 'image'});

  bool get isVideo => kind == 'video';

  static OsceImage? fromJson(dynamic raw) {
    if (raw == null) return null;
    final m = _m(raw);
    final full = _s(m['full']);
    if (full.isEmpty) return null;
    // Fall back to the file extension for records saved before `kind` existed.
    final declared = _s(m['kind']);
    final kind = declared.isNotEmpty
        ? declared
        : (RegExp(r'\.(mp4|webm|mov|ogv)(\?|$)', caseSensitive: false).hasMatch(full)
            ? 'video'
            : 'image');
    return OsceImage(
      full: full,
      thumb: _s(m['thumb']).isEmpty ? full : _s(m['thumb']),
      kind: kind,
    );
  }
}

/// A point on a scene image. Coordinates are 0–1 fractions, so the same case
/// renders correctly at any size and survives pinch-zoom.
class OsceHotspot {
  final double x;
  final double y;
  final String label;
  final String actionType; // sign | scene | label
  final String targetId;
  OsceHotspot({
    required this.x,
    required this.y,
    required this.label,
    required this.actionType,
    required this.targetId,
  });
  factory OsceHotspot.fromJson(dynamic raw) {
    final m = _m(raw);
    final action = _m(m['action']);
    return OsceHotspot(
      x: _d(m['x']).clamp(0.0, 1.0),
      y: _d(m['y']).clamp(0.0, 1.0),
      label: _s(m['label']),
      actionType: _s(action['type']).isEmpty ? 'label' : _s(action['type']),
      targetId: _s(action['id']),
    );
  }
}

class OsceScene {
  final String id;
  final String title;
  final String? parent;
  final OsceImage? image;
  final OsceImage? compareImage;
  final String compareLabel;
  final List<OsceHotspot> hotspots;
  OsceScene({
    required this.id,
    required this.title,
    required this.parent,
    required this.image,
    required this.compareImage,
    required this.compareLabel,
    required this.hotspots,
  });
  factory OsceScene.fromJson(dynamic raw) {
    final m = _m(raw);
    final compare = _m(m['compare']);
    return OsceScene(
      id: _s(m['id']),
      title: _s(m['title']).isEmpty ? _s(m['id']) : _s(m['title']),
      parent: _s(m['parent']).isEmpty ? null : _s(m['parent']),
      image: OsceImage.fromJson(m['image']),
      compareImage: OsceImage.fromJson(compare['image']),
      compareLabel: _s(compare['label']),
      hotspots: _l(m['hotspots']).map(OsceHotspot.fromJson).toList(),
    );
  }
}

class OsceSign {
  final String id;
  final String name;
  final String category;
  final String region;
  final String short;
  final String body;
  final OsceImage? image;
  final OsceImage? compareImage;
  final String compareLabel;
  OsceSign({
    required this.id,
    required this.name,
    required this.category,
    required this.region,
    required this.short,
    required this.body,
    required this.image,
    required this.compareImage,
    required this.compareLabel,
  });
  factory OsceSign.fromJson(dynamic raw) {
    final m = _m(raw);
    final compare = _m(m['compare']);
    return OsceSign(
      id: _s(m['id']),
      name: _s(m['name']),
      category: _s(m['category']),
      region: _s(m['region']),
      short: _s(m['short']),
      body: _s(m['body']),
      image: OsceImage.fromJson(m['image']),
      compareImage: OsceImage.fromJson(compare['image']),
      compareLabel: _s(compare['label']),
    );
  }
}

class OsceChainStep {
  final int step;
  final String title;
  final String body;
  final OsceImage? image;
  OsceChainStep({
    required this.step,
    required this.title,
    required this.body,
    required this.image,
  });
  factory OsceChainStep.fromJson(dynamic raw) {
    final m = _m(raw);
    return OsceChainStep(
      step: _i(m['step']),
      title: _s(m['title']),
      body: _s(m['body']),
      image: OsceImage.fromJson(m['image']),
    );
  }
}

class OsceInvestigation {
  final String modality;
  final String title;
  final OsceImage? image;
  final List<String> findings;
  OsceInvestigation({
    required this.modality,
    required this.title,
    required this.image,
    required this.findings,
  });
  factory OsceInvestigation.fromJson(dynamic raw) {
    final m = _m(raw);
    return OsceInvestigation(
      modality: _s(m['modality']),
      title: _s(m['title']).isEmpty ? _s(m['modality']).toUpperCase() : _s(m['title']),
      image: OsceImage.fromJson(m['image']),
      findings: _l(m['findings']).map(_s).toList(),
    );
  }
}

class OsceSoundMarker {
  final String label;
  final int from;
  final int to;
  OsceSoundMarker({required this.label, required this.from, required this.to});
  factory OsceSoundMarker.fromJson(dynamic raw) {
    final m = _m(raw);
    return OsceSoundMarker(label: _s(m['label']), from: _i(m['from']), to: _i(m['to']));
  }
}

class OsceSound {
  final String title;
  final String audioUrl;
  final String compareUrl;
  final List<OsceSoundMarker> markers;
  OsceSound({
    required this.title,
    required this.audioUrl,
    required this.compareUrl,
    required this.markers,
  });
  factory OsceSound.fromJson(dynamic raw) {
    final m = _m(raw);
    return OsceSound(
      title: _s(m['title']),
      audioUrl: _s(_m(m['audio'])['url']),
      compareUrl: _s(_m(m['compareAudio'])['url']),
      markers: _l(m['markers']).map(OsceSoundMarker.fromJson).toList(),
    );
  }
}

/// One mechanism with the findings it explains — the Summary & Connect graph.
/// The server resolves sign ids to names and drops steps that explain nothing,
/// so every row here has at least one finding under it.
class OsceConnectStep {
  final int step;
  final String title;
  final String body;
  final List<OsceConnectSign> signs;
  OsceConnectStep({
    required this.step,
    required this.title,
    required this.body,
    required this.signs,
  });
  factory OsceConnectStep.fromJson(dynamic raw) {
    final m = _m(raw);
    return OsceConnectStep(
      step: _i(m['step']),
      title: _s(m['title']),
      body: _s(m['body']),
      signs: _l(m['signs']).map(OsceConnectSign.fromJson).toList(),
    );
  }
}

class OsceConnectSign {
  final String id;
  final String name;
  final String short;
  final String category;
  OsceConnectSign({
    required this.id,
    required this.name,
    required this.short,
    required this.category,
  });
  factory OsceConnectSign.fromJson(dynamic raw) {
    final m = _m(raw);
    return OsceConnectSign(
      id: _s(m['id']),
      name: _s(m['name']),
      short: _s(m['short']),
      category: _s(m['category']),
    );
  }
}

class OsceRelated {
  final String rel;
  final String caseSlug;
  final String note;

  /// The linked station's real title, resolved server-side. Empty means the
  /// slug matched no case — the server drops those before a student sees them,
  /// so an empty title here only happens in an admin preview.
  final String title;
  final String stationType;

  OsceRelated({
    required this.rel,
    required this.caseSlug,
    required this.note,
    required this.title,
    required this.stationType,
  });

  /// What to show on the row: the real case title first, then the author's note,
  /// and the de-slugged name only as a last resort.
  String get label => title.isNotEmpty
      ? title
      : (note.isNotEmpty ? note : caseSlug.replaceAll('-', ' '));

  factory OsceRelated.fromJson(dynamic raw) {
    final m = _m(raw);
    return OsceRelated(
      rel: _s(m['rel']),
      caseSlug: _s(m['case']),
      note: _s(m['note']),
      title: _s(m['title']),
      stationType: _s(m['stationType']),
    );
  }
}

class OsceChecklistSection {
  final String section;
  final List<String> items;
  OsceChecklistSection({required this.section, required this.items});
  factory OsceChecklistSection.fromJson(dynamic raw) {
    final m = _m(raw);
    return OsceChecklistSection(
      section: _s(m['section']),
      items: _l(m['items']).map(_s).toList(),
    );
  }
}

class OsceQuestion {
  final String q;
  final String a;
  OsceQuestion({required this.q, required this.a});
  factory OsceQuestion.fromJson(dynamic raw) {
    final m = _m(raw);
    return OsceQuestion(q: _s(m['q']), a: _s(m['a']));
  }
}

/// Every picture a station needs, so the media cache can warm them in one go.
extension OsceCaseMedia on OsceCase {
  List<String> get imageUrls => [
        for (final scene in scenes) ...[
          ?scene.image?.full,
          ?scene.compareImage?.full,
        ],
        for (final sign in signs) ...[
          ?sign.image?.full,
          ?sign.image?.thumb,
          ?sign.compareImage?.full,
        ],
        for (final step in chain) ?step.image?.full,
        for (final ix in investigations) ?ix.image?.full,
      ].where((u) => u.isNotEmpty).toSet().toList();
}

class OsceCase {
  final int id;
  final String title;
  final String slug;
  final String summary;
  final OsceImage? cover;
  final List<OsceScene> scenes;
  final List<OsceSign> signs;
  final List<OsceChainStep> chain;
  final List<OsceInvestigation> investigations;
  final List<OsceSound> sounds;
  final List<String> keyPoints;
  final List<String> osceTips;
  final List<OsceConnectStep> connect;
  final List<OsceRelated> related;
  final List<OsceChecklistSection> checklist;
  final List<OsceQuestion> questions;

  OsceCase({
    required this.id,
    required this.title,
    required this.slug,
    required this.summary,
    required this.cover,
    required this.scenes,
    required this.signs,
    required this.chain,
    required this.investigations,
    required this.sounds,
    required this.keyPoints,
    required this.osceTips,
    required this.connect,
    required this.related,
    required this.checklist,
    required this.questions,
  });

  factory OsceCase.fromJson(dynamic raw) {
    final m = _m(raw);
    final doc = _m(m['caseData']);
    final summaryBlock = _m(doc['summary']);
    final practice = _m(doc['practice']);
    return OsceCase(
      id: _i(m['id']),
      title: _s(m['title']),
      slug: _s(m['slug']),
      summary: _s(m['summary']),
      cover: OsceImage.fromJson(m['cover']),
      scenes: _l(doc['scenes']).map(OsceScene.fromJson).toList(),
      signs: _l(doc['signs']).map(OsceSign.fromJson).toList(),
      chain: _l(doc['chain']).map(OsceChainStep.fromJson).toList(),
      investigations: _l(doc['investigations']).map(OsceInvestigation.fromJson).toList(),
      sounds: _l(doc['sounds']).map(OsceSound.fromJson).toList(),
      keyPoints: _l(summaryBlock['keyPoints']).map(_s).toList(),
      osceTips: _l(summaryBlock['osceTips']).map(_s).toList(),
      connect: _l(summaryBlock['graph']).map(OsceConnectStep.fromJson).toList(),
      related: _l(doc['related']).map(OsceRelated.fromJson).toList(),
      checklist: _l(practice['checklist']).map(OsceChecklistSection.fromJson).toList(),
      questions: _l(practice['questions']).map(OsceQuestion.fromJson).toList(),
    );
  }

  OsceScene? get rootScene {
    for (final s in scenes) {
      if (s.parent == null) return s;
    }
    return scenes.isEmpty ? null : scenes.first;
  }

  OsceScene? sceneById(String id) {
    for (final s in scenes) {
      if (s.id == id) return s;
    }
    return null;
  }

  OsceSign? signById(String id) {
    for (final s in signs) {
      if (s.id == id) return s;
    }
    return null;
  }
}

/* ───────────────────── long case (history) ──────────────────── */

class OscePatient {
  final String name;
  final int? age;
  final String sex;
  final String occupation;
  final String opening;
  OscePatient({
    required this.name,
    required this.age,
    required this.sex,
    required this.occupation,
    required this.opening,
  });
  factory OscePatient.fromJson(dynamic raw) {
    final m = _m(raw);
    final age = _i(m['age']);
    return OscePatient(
      name: _s(m['name']).isEmpty ? 'The patient' : _s(m['name']),
      age: age > 0 ? age : null,
      sex: _s(m['sex']),
      occupation: _s(m['occupation']),
      opening: _s(m['opening']),
    );
  }
}

/// The two pictures every long case shares.
class OsceCast {
  final OsceImage? doctor;
  final OsceImage? patient;
  OsceCast({required this.doctor, required this.patient});
  factory OsceCast.fromJson(dynamic raw) {
    final m = _m(raw);
    return OsceCast(
      doctor: OsceImage.fromJson(m['doctor']),
      patient: OsceImage.fromJson(m['patient']),
    );
  }
}

class OsceExchange {
  final String ask;
  final String reply;
  final String note;
  OsceExchange({required this.ask, required this.reply, required this.note});
  factory OsceExchange.fromJson(dynamic raw) {
    final m = _m(raw);
    return OsceExchange(
      ask: _s(m['ask']),
      reply: _s(m['reply']),
      note: _s(m['note']),
    );
  }
}

class OsceHistorySection {
  final String id;
  final String title;
  final String purpose;
  final List<OsceExchange> exchanges;
  OsceHistorySection({
    required this.id,
    required this.title,
    required this.purpose,
    required this.exchanges,
  });
  factory OsceHistorySection.fromJson(dynamic raw) {
    final m = _m(raw);
    return OsceHistorySection(
      id: _s(m['id']),
      title: _s(m['title']),
      purpose: _s(m['purpose']),
      exchanges: _l(m['exchanges']).map(OsceExchange.fromJson).toList(),
    );
  }
}

class OsceDifferential {
  final String diagnosis;
  final String supporting;
  final String against;
  OsceDifferential({
    required this.diagnosis,
    required this.supporting,
    required this.against,
  });
  factory OsceDifferential.fromJson(dynamic raw) {
    final m = _m(raw);
    return OsceDifferential(
      diagnosis: _s(m['diagnosis']),
      supporting: _s(m['supporting']),
      against: _s(m['against']),
    );
  }
}

class OsceLongCase {
  final int id;
  final String title;
  final String slug;
  final String summary;
  final OscePatient patient;
  final OsceCast cast;
  final List<OsceHistorySection> sections;
  final List<OsceDifferential> differentials;
  final List<String> initialManagement;
  final List<OsceChecklistSection> checklist;
  final List<OsceQuestion> questions;
  final List<OsceRelated> related;

  OsceLongCase({
    required this.id,
    required this.title,
    required this.slug,
    required this.summary,
    required this.patient,
    required this.cast,
    required this.sections,
    required this.differentials,
    required this.initialManagement,
    required this.checklist,
    required this.questions,
    required this.related,
  });

  factory OsceLongCase.fromJson(dynamic raw) {
    final m = _m(raw);
    final doc = _m(m['caseData']);
    final practice = _m(doc['practice']);
    return OsceLongCase(
      id: _i(m['id']),
      title: _s(m['title']),
      slug: _s(m['slug']),
      summary: _s(m['summary']),
      patient: OscePatient.fromJson(doc['patient']),
      cast: OsceCast.fromJson(doc['cast']),
      sections: _l(doc['sections']).map(OsceHistorySection.fromJson).toList(),
      differentials: _l(doc['differentials']).map(OsceDifferential.fromJson).toList(),
      initialManagement: _l(doc['initialManagement']).map(_s).toList(),
      checklist: _l(practice['checklist']).map(OsceChecklistSection.fromJson).toList(),
      questions: _l(practice['questions']).map(OsceQuestion.fromJson).toList(),
      related: _l(doc['related']).map(OsceRelated.fromJson).toList(),
    );
  }
}

/// One zone of the body map, with the stations whose findings sit there.
class OsceRegion {
  final String key;
  final String label;
  final int caseCount;
  final List<OsceCaseSummary> cases;
  OsceRegion({
    required this.key,
    required this.label,
    required this.caseCount,
    required this.cases,
  });
  factory OsceRegion.fromJson(dynamic raw) {
    final m = _m(raw);
    return OsceRegion(
      key: _s(m['key']),
      label: _s(m['label']),
      caseCount: _i(m['caseCount']),
      cases: _l(m['cases']).map(OsceCaseSummary.fromJson).toList(),
    );
  }
}

/* ───────────────────────── repository ───────────────────────── */

class OsceRepository {
  final ApiClient _client;
  OsceRepository(this._client);

  Future<List<OsceCourse>> courses() async {
    final res = await _client.dio.get('/osce/courses');
    return _l(_m(res.data)['courses']).map(OsceCourse.fromJson).toList();
  }

  Future<List<OsceRegion>> regions() async {
    final res = await _client.dio.get('/osce/regions');
    return _l(_m(res.data)['regions']).map(OsceRegion.fromJson).toList();
  }

  Future<List<OsceSystem>> systems({int? courseId}) async {
    final res = await _client.dio.get('/osce/systems',
        queryParameters: courseId == null ? null : {'course': courseId});
    return _l(_m(res.data)['systems']).map(OsceSystem.fromJson).toList();
  }

  Future<List<OsceCaseSummary>> cases(String systemKey) async {
    // systemKey is the subject's topic id
    final res = await _client.dio.get('/osce/cases', queryParameters: {'system': systemKey});
    return _l(_m(res.data)['cases']).map(OsceCaseSummary.fromJson).toList();
  }

  /// One request draws the whole case — the server has already resolved every
  /// image slot and every ECG/auscultation reference into a URL.
  Future<OsceCase> caseBySlug(String slug) async {
    final res = await _client.dio.get('/osce/cases/$slug');
    return OsceCase.fromJson(res.data);
  }

  /// Same endpoint as a short case — the document just carries a history
  /// instead of scenes, so it's parsed into a different shape.
  Future<OsceLongCase> longCaseBySlug(String slug) async {
    final res = await _client.dio.get('/osce/cases/$slug');
    return OsceLongCase.fromJson(res.data);
  }

  /// Only the fields passed are sent — the server leaves the rest of the row
  /// alone, so favouriting a station can't wipe its ticked checklist.
  Future<void> saveProgress(
    int caseId, {
    Map<String, bool>? checklist,
    List<String>? seen,
    bool completed = false,
    bool? favourite,
  }) async {
    await _client.dio.put('/osce/progress/$caseId', data: {
      'checklist': ?checklist,
      'seen': ?seen,
      'completed': completed,
      'favourite': ?favourite,
    });
  }

  /// Star or un-star a station. Returns nothing useful — the list is
  /// invalidated by the caller so the server stays the source of truth.
  Future<void> setFavourite(int caseId, bool value) =>
      saveProgress(caseId, favourite: value);

  Future<Map<String, dynamic>> progress() async {
    final res = await _client.dio.get('/osce/progress');
    return _m(res.data);
  }
}

final osceRepositoryProvider = Provider<OsceRepository>(
  (ref) => OsceRepository(ref.read(apiClientProvider)),
);

final osceRegionsProvider = FutureProvider<List<OsceRegion>>(
  (ref) => ref.read(osceRepositoryProvider).regions(),
);

final osceCoursesProvider = FutureProvider.autoDispose<List<OsceCourse>>(
  (ref) => ref.read(osceRepositoryProvider).courses(),
);

final osceSubjectsProvider = FutureProvider.autoDispose.family<List<OsceSystem>, int>(
  (ref, courseId) => ref.read(osceRepositoryProvider).systems(courseId: courseId),
);

final osceCasesProvider = FutureProvider.autoDispose.family<List<OsceCaseSummary>, String>(
  (ref, systemKey) => ref.read(osceRepositoryProvider).cases(systemKey),
);

final osceCaseProvider = FutureProvider.autoDispose.family<OsceCase, String>(
  (ref, slug) => ref.read(osceRepositoryProvider).caseBySlug(slug),
);

final osceLongCaseProvider = FutureProvider.autoDispose.family<OsceLongCase, String>(
  (ref, slug) => ref.read(osceRepositoryProvider).longCaseBySlug(slug),
);
