// Which student study tools this release ships with — the web twin of the
// app's mobile/lib/config/launch_flags.dart.
//
// ECG, Auscultation and Drugs are finished but held back for the second update.
// NOTHING IS DELETED: pages, routes, API helpers and the admin libraries all
// stay in place. The flags only decide whether the student entry points are
// drawn and whether the student routes resolve, so bringing a tool back is
// flipping its flag to `true`. Admins keep both libraries so content can be
// prepared ahead of the release.
export const LAUNCH_FLAGS = {
  ecg: false,
  auscultation: false,
  drugs: false,
};
