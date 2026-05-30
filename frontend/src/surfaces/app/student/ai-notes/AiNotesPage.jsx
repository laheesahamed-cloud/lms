import { memo, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getAiNote, getLessonAiNote } from '../../../../shared/api/aiNotes.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { recordStudyActivity } from '../../../../shared/api/dashboard.api.js';
import { updateStudentLessonProgress } from '../../../../shared/api/courses.api.js';
import { getVideoEmbed, getVideoThumbnail } from '../../../../shared/utils/videoEmbed.js';
import { detectPlatform } from '../../../../shared/platform/detect.js';
import { ThemeToggle } from '../../../../shared/layout/ThemeToggle.jsx';
import { cx } from '../../../../shared/styles/tailwindClasses.js';
import { NoteCanvas } from './NoteCanvas.jsx';

// ── Fonts ─────────────────────────────────────────────────────────────────────
if (typeof document !== 'undefined' && !document.getElementById('canvas-hand-font')) {
  const lnk = document.createElement('link');
  lnk.id = 'canvas-hand-font'; lnk.rel = 'stylesheet';
  lnk.href = 'https://fonts.googleapis.com/css2?family=Patrick+Hand&family=Plus+Jakarta+Sans:wght@400;600;700;800;900&display=swap';
  document.head.appendChild(lnk);
}
const KL = { fontFamily: "'Patrick Hand', cursive" };

let drawingAudioContext = null;
let lastDrawingSoundAt = 0;
let activeDrawingSound = null;
let spenLoopBuffers = null;
const DRAWING_SOUND_MODES = [
  { id:'spen', label:'S Pen' },
  { id:'secret', label:'Secret Study' },
];
const DRAWING_SOUND_STORAGE_KEY = 'lms.aiNotes.drawingSoundMode';
const SECRET_STUDY_EFFECTS = ['fart', 'dog', 'cat', 'boing', 'squeak'];
let lastSecretStudyEffect = '';
let currentSecretStudyEffect = '';
let lastSecretStudyEffectAt = 0;

function normalizeDrawingSoundMode(mode) {
  return mode === 'secret' ? 'secret' : 'spen';
}

function getDrawingAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  drawingAudioContext ||= new AudioContextClass();
  return drawingAudioContext;
}

function getSpenLoopBuffers(context) {
  if (spenLoopBuffers?.sampleRate === context.sampleRate) return spenLoopBuffers;

  const duration = 0.72;
  const sampleCount = Math.max(1, Math.floor(context.sampleRate * duration));
  const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < sampleCount; i += 1) {
    const progress = i / sampleCount;
    const grain = Math.random() * 2 - 1;
    const rub = Math.sin(progress * Math.PI * 28) * 0.034;
    const paper = Math.sin(progress * Math.PI * (10 + Math.random() * 14)) * 0.026;
    channel[i] = grain * 0.028 + rub + paper;
  }

  const textureBuffer = context.createBuffer(1, sampleCount, context.sampleRate);
  const textureChannel = textureBuffer.getChannelData(0);
  for (let i = 0; i < sampleCount; i += 1) {
    const progress = i / sampleCount;
    const grain = Math.random() * 2 - 1;
    const fiber = Math.sin(progress * Math.PI * 76) * 0.032;
    const tooth = Math.sin(progress * Math.PI * 38) * 0.018;
    textureChannel[i] = grain * 0.035 + fiber + tooth;
  }

  const verticalBuffer = context.createBuffer(1, sampleCount, context.sampleRate);
  const verticalChannel = verticalBuffer.getChannelData(0);
  for (let i = 0; i < sampleCount; i += 1) {
    const progress = i / sampleCount;
    const grain = Math.random() * 2 - 1;
    const drag = Math.sin(progress * Math.PI * 58) * 0.026;
    const paperTooth = Math.sin(progress * Math.PI * (116 + Math.random() * 32)) * 0.018;
    verticalChannel[i] = grain * 0.042 + drag + paperTooth;
  }

  spenLoopBuffers = { sampleRate: context.sampleRate, buffer, textureBuffer, verticalBuffer };
  return spenLoopBuffers;
}

function postNativeDrawingSound(action = 'play', mode = 'spen', volume = 1, force = false, extras = null) {
  if (typeof window === 'undefined') return false;
  const handler = window.webkit?.messageHandlers?.lmsScribbleAudio;
  if (!handler || typeof handler.postMessage !== 'function') return false;
  const soundMode = normalizeDrawingSoundMode(mode);

  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const minGap = soundMode === 'secret' ? 95 : 320;
  if (action === 'play' && !force && now - lastDrawingSoundAt < minGap) return true;
  lastDrawingSoundAt = now;

  try {
    handler.postMessage({ action, mode: soundMode, volume, ...(extras || {}) });
    return true;
  } catch {
    return false;
  }
}

function stopWebDrawingSound() {
  const sound = activeDrawingSound;
  activeDrawingSound = null;
  if (!sound) return;
  try {
    const now = sound.context.currentTime;
    sound.gain.gain.cancelScheduledValues(now);
    sound.gain.gain.setTargetAtTime(0.001, now, 0.035);
    sound.textureGain?.gain.cancelScheduledValues(now);
    sound.textureGain?.gain.setTargetAtTime(0.001, now, 0.025);
    sound.verticalGain?.gain.cancelScheduledValues(now);
    sound.verticalGain?.gain.setTargetAtTime(0.001, now, 0.02);
    sound.source.stop(now + 0.16);
    sound.textureSource?.stop(now + 0.12);
    sound.verticalSource?.stop(now + 0.12);
  } catch {
    // Optional sound cleanup only.
  }
}

function pickSecretStudyEffect() {
  let effect = SECRET_STUDY_EFFECTS[Math.floor(Math.random() * SECRET_STUDY_EFFECTS.length)] || 'fart';
  if (SECRET_STUDY_EFFECTS.length > 1 && effect === lastSecretStudyEffect) {
    effect = SECRET_STUDY_EFFECTS[(SECRET_STUDY_EFFECTS.indexOf(effect) + 1) % SECRET_STUDY_EFFECTS.length];
  }
  lastSecretStudyEffect = effect;
  return effect;
}

function playSecretStudyShuffleEffect(context, effectOverride = '') {
  if (!context) return;
  const now = context.currentTime;
  const effect = effectOverride || pickSecretStudyEffect();
  lastSecretStudyEffectAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const master = context.createGain();
  master.gain.setValueAtTime(0.001, now);
  master.gain.linearRampToValueAtTime(0.052, now + 0.014);
  master.gain.exponentialRampToValueAtTime(0.001, now + 0.82);
  master.connect(context.destination);

  const addOsc = (type, startFreq, endFreq, start, duration, gainValue = 0.2) => {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, now + start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + start + duration);
    gain.gain.setValueAtTime(0.001, now + start);
    gain.gain.linearRampToValueAtTime(gainValue, now + start + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now + start);
    osc.stop(now + start + duration + 0.04);
  };

  const addNoise = (start, duration, frequency, q, gainValue = 0.16) => {
    const sampleCount = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i += 1) {
      const progress = i / sampleCount;
      const envelope = Math.sin(Math.PI * progress);
      channel[i] = (Math.random() * 2 - 1) * envelope;
    }
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer;
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = q;
    gain.gain.setValueAtTime(gainValue, now + start);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(now + start);
    source.stop(now + start + duration);
  };

  if (effect === 'fart') {
    addOsc('sawtooth', 86, 46, 0, 0.34, 0.22);
    addOsc('triangle', 58, 42, 0.06, 0.28, 0.15);
    addNoise(0.02, 0.3, 92, 0.62, 0.2);
  } else if (effect === 'dog') {
    addOsc('square', 250, 92, 0, 0.12, 0.26);
    addNoise(0, 0.13, 720, 2.4, 0.22);
    addOsc('square', 210, 82, 0.16, 0.12, 0.22);
    addNoise(0.16, 0.12, 620, 2.2, 0.16);
  } else if (effect === 'cat') {
    addOsc('triangle', 620, 1320, 0, 0.2, 0.18);
    addOsc('sine', 1320, 540, 0.14, 0.26, 0.15);
  } else if (effect === 'boing') {
    addOsc('sine', 118, 780, 0, 0.11, 0.18);
    addOsc('triangle', 780, 180, 0.1, 0.36, 0.18);
  } else {
    addOsc('square', 840, 420, 0, 0.08, 0.16);
    addOsc('triangle', 1080, 620, 0.1, 0.1, 0.14);
    addNoise(0.02, 0.16, 2200, 6, 0.08);
  }
}

function repeatSecretStudyEffectForMovement(previous, point) {
  if (!isAudibleStrokeMovement(previous, point)) return;
  const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (nowMs - lastSecretStudyEffectAt < 520) return;

  try {
    const context = getDrawingAudioContext();
    if (!context) return;
    if (context.state === 'suspended') {
      context.resume().then(() => repeatSecretStudyEffectForMovement(previous, point)).catch(() => {});
      return;
    }
    currentSecretStudyEffect ||= pickSecretStudyEffect();
    playSecretStudyShuffleEffect(context, currentSecretStudyEffect);
  } catch {
    // Funny Secret Study sounds are optional.
  }
}

function strokeSegmentMotion(previous, point) {
  if (!previous || !point) return { distance: 0, elapsed: 8, speed: 0 };
  const dx = point.x - previous.x;
  const dy = point.y - previous.y;
  const distance = Math.hypot(dx, dy);
  const elapsed = Math.max(8, (point.t || 0) - (previous.t || 0));
  const speed = clampNumber((distance / elapsed) * 1800, 0, 1);
  return { distance, elapsed, speed };
}

function isAudibleStrokeMovement(previous, point) {
  const { distance, speed } = strokeSegmentMotion(previous, point);
  return distance >= 0.0009 && speed >= 0.045;
}

function isAudibleTinyVerticalMovement(previous, point) {
  if (!previous || !point) return false;
  const dx = point.x - previous.x;
  const dy = point.y - previous.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= 0) return false;
  const verticalStroke = clampNumber((Math.abs(dy) / distance - 0.48) / 0.52, 0, 1);
  const { speed } = strokeSegmentMotion(previous, point);
  return verticalStroke >= 0.5 && Math.abs(dy) >= 0.00032 && distance >= 0.00038 && speed >= 0.012;
}

function isAudibleTinyFastMovement(previous, point) {
  const { distance, speed } = strokeSegmentMotion(previous, point);
  return distance >= 0.00034 && distance <= 0.0017 && speed >= 0.16;
}

function isAudibleTinyAverageMovement(previous, point) {
  const { distance, speed } = strokeSegmentMotion(previous, point);
  return distance >= 0.00042 && distance <= 0.0019 && speed >= 0.055 && speed < 0.42;
}

function modulateDrawingStrokeSound(previous, point, mode = 'spen') {
  if (!previous || !point) return;
  const soundMode = normalizeDrawingSoundMode(mode);
  if (soundMode === 'secret') {
    repeatSecretStudyEffectForMovement(previous, point);
    return;
  }
  const dx = point.x - previous.x;
  const dy = point.y - previous.y;
  const { distance, speed } = strokeSegmentMotion(previous, point);
  const pressure = clampNumber(Number(point.pressure) || 0.35, 0, 1);
  const pressureDelta = clampNumber(Math.abs(pressure - (Number(previous.pressure) || pressure)) * 2.4, 0, 1);
  const tilt = clampNumber(
    Math.hypot(Number(point.tiltX) || 0, Number(point.tiltY) || 0) / 90,
    0,
    1
  );
  const direction = Math.atan2(dy, dx);
  const lastDirection = activeDrawingSound?.lastDirection;
  const directionDelta = typeof lastDirection === 'number'
    ? Math.atan2(Math.sin(direction - lastDirection), Math.cos(direction - lastDirection))
    : 0;
  const directionChange = clampNumber(Math.abs(directionDelta) / 0.62, 0, 1);
  const wavePulse = clampNumber(directionChange * (0.65 + speed * 0.55), 0, 1);
  const verticalStroke = distance > 0 ? clampNumber((Math.abs(dy) / distance - 0.45) / 0.55, 0, 1) : 0;
  const directionTexture = (Math.sin(direction * 3.7) + 1) / 2;
  const segmentTexture = (Math.sin(((point.t || 0) * 0.073) + direction * 4.6 + wavePulse * 2.8) + 1) / 2;
  const prior = activeDrawingSound?.lastPreviousPoint;
  let curve = 0;
  if (prior && prior !== previous) {
    const ax = previous.x - prior.x;
    const ay = previous.y - prior.y;
    const bx = point.x - previous.x;
    const by = point.y - previous.y;
    const aLength = Math.hypot(ax, ay);
    const bLength = Math.hypot(bx, by);
    if (aLength > 0.00002 && bLength > 0.00002) {
      const dot = clampNumber((ax * bx + ay * by) / (aLength * bLength), -1, 1);
      curve = clampNumber((Math.acos(dot) / Math.PI) * 1.8, 0, 1);
    }
  }

  const slowWriting = clampNumber((0.22 - speed) / 0.22, 0, 1);
  const averageWriting = clampNumber(1 - Math.abs(speed - 0.34) / 0.24, 0, 1);
  const fastWriting = clampNumber((speed - 0.38) / 0.34, 0, 1);
  const veryFastWriting = clampNumber((speed - 0.72) / 0.28, 0, 1);
  const smallHandwriting = clampNumber((0.0028 - distance) / 0.0022, 0, 1) * clampNumber(Math.max(averageWriting, slowWriting * 0.75), 0, 1);
  const smallAverageHandwriting = clampNumber((0.0019 - distance) / 0.00145, 0, 1) * averageWriting;
  const smallFastHandwriting = clampNumber((0.0017 - distance) / 0.00135, 0, 1) * clampNumber((speed - 0.14) / 0.32, 0, 1);
  const minimalStroke = smallHandwriting * clampNumber((0.0024 - distance) / 0.0018, 0, 1);
  const horizontalStroke = 1 - verticalStroke;
  const minimalVerticalHandwriting = minimalStroke * verticalStroke;
  const minimalHorizontalHandwriting = minimalStroke * horizontalStroke;
  const cleanVerticalHandwriting = minimalVerticalHandwriting * (1 - fastWriting * 0.35);
  const shortVerticalHandwriting = cleanVerticalHandwriting * clampNumber((0.46 - speed) / 0.46, 0, 1);
  const compactCurve = curve * (1 - smallHandwriting * 0.34);
  const minimalStraightHandwriting = minimalStroke * (1 - compactCurve * 0.5);
  const horizontalRootVertical = clampNumber(shortVerticalHandwriting + minimalVerticalHandwriting * slowWriting * 0.85, 0, 1);
  const verticalDrag = clampNumber(
    verticalStroke
      * (0.42 + speed * 0.72)
      * (1 - compactCurve * 0.28)
      * (1 - smallHandwriting * 0.38)
      * (1 - minimalVerticalHandwriting * 0.04),
    0,
    1
  );
  const soundVerticalStroke = clampNumber(
    verticalStroke * (1 - horizontalRootVertical * 0.45)
      + minimalVerticalHandwriting * 0.22
      + smallAverageHandwriting * verticalStroke * 0.1
      + smallFastHandwriting * verticalStroke * 0.12,
    0,
    1
  );
  const soundVerticalDrag = clampNumber(
    verticalDrag * (1 - horizontalRootVertical * 0.45)
      + minimalVerticalHandwriting * 0.08
      + smallAverageHandwriting * verticalStroke * 0.08
      + smallFastHandwriting * verticalStroke * 0.1,
    0,
    1
  );
  const verticalDirectionTexture = dy >= 0 ? 1 : 0.62;
  const movement = clampNumber(speed * 0.42 + compactCurve * 0.3 + wavePulse * (0.5 - smallHandwriting * 0.14 - minimalHorizontalHandwriting * 0.12 - cleanVerticalHandwriting * 0.045) + pressureDelta * 0.16 + soundVerticalDrag * 0.22 + smallHandwriting * 0.1 + smallAverageHandwriting * 0.14 + smallFastHandwriting * 0.12 + minimalStraightHandwriting * 0.05 + horizontalRootVertical * 0.055, 0, 1);
  const volume = soundMode === 'secret'
    ? 0.07 + pressure * 0.06 + speed * 0.11 + curve * 0.08 + pressureDelta * 0.045 + wavePulse * 0.09
    : 0.026
      + pressure * 0.036
      + speed * 0.058
      + slowWriting * 0.016
      + smallHandwriting * 0.018
      + smallAverageHandwriting * 0.018
      + smallFastHandwriting * 0.014
      + minimalStraightHandwriting * 0.006
      + fastWriting * 0.028
      + veryFastWriting * 0.026
      + soundVerticalStroke * (0.018 + fastWriting * 0.014)
      + soundVerticalDrag * 0.034
      + horizontalRootVertical * 0.008
      + compactCurve * (0.044 - veryFastWriting * 0.018)
      + pressureDelta * 0.024
      + wavePulse * (0.064 - smallHandwriting * 0.02 - minimalHorizontalHandwriting * 0.028 - minimalVerticalHandwriting * 0.004);
  const rate = soundMode === 'secret'
    ? 0.76 + speed * 0.24 + curve * 0.17 + directionTexture * 0.07 + wavePulse * 0.28 - tilt * 0.045
    : 0.66
      + speed * 0.22
      - smallHandwriting * 0.025
      + smallAverageHandwriting * 0.028
      + smallFastHandwriting * 0.035
      - minimalStraightHandwriting * 0.018
      + fastWriting * 0.12
      + veryFastWriting * 0.16
      + soundVerticalStroke * (0.045 + fastWriting * 0.035)
      + soundVerticalDrag * (0.055 + verticalDirectionTexture * 0.018)
      + compactCurve * (0.105 - veryFastWriting * 0.045)
      + directionTexture * 0.045
      + wavePulse * (0.16 + fastWriting * 0.08 - smallHandwriting * 0.04 - minimalStroke * 0.035)
      - tilt * 0.035;
  const brightness = soundMode === 'secret'
    ? 720 + pressure * 300 + speed * 980 + curve * 860 + pressureDelta * 260 + wavePulse * 1180 + segmentTexture * 180 - tilt * 180
    : 190
      + pressure * 72
      + slowWriting * 70
      + speed * 430
      + smallHandwriting * 110
      + smallAverageHandwriting * 115
      + smallFastHandwriting * 135
      + minimalStraightHandwriting * 45
      + fastWriting * 360
      + veryFastWriting * 720
      + soundVerticalStroke * (180 + fastWriting * 260 + veryFastWriting * 240)
      + soundVerticalDrag * (260 + verticalDirectionTexture * 120)
      + compactCurve * (430 - veryFastWriting * 210)
      + pressureDelta * 110
      + wavePulse * (560 + fastWriting * 360 - smallHandwriting * 130 - minimalStroke * 95)
      + segmentTexture * (80 - smallHandwriting * 24 - minimalStroke * 12)
      - tilt * 46;
  const roughness = clampNumber(
    compactCurve * (0.42 - veryFastWriting * 0.16)
      + directionChange * (0.48 + fastWriting * 0.24 - smallHandwriting * 0.16)
      + pressureDelta * 0.24
      + speed * 0.2
      + slowWriting * 0.14
      + smallHandwriting * 0.08
      + smallAverageHandwriting * 0.1
      + smallFastHandwriting * 0.11
      - minimalStraightHandwriting * 0.035
      - cleanVerticalHandwriting * 0.06
      + veryFastWriting * 0.18
      + soundVerticalStroke * (0.13 + fastWriting * 0.12)
      + soundVerticalDrag * 0.24
      + segmentTexture * 0.1,
    0,
    1
  );

  const sound = activeDrawingSound;
  const audibleStrokeMovement = isAudibleStrokeMovement(previous, point)
    || isAudibleTinyAverageMovement(previous, point)
    || isAudibleTinyFastMovement(previous, point)
    || (verticalStroke >= 0.5 && Math.abs(dy) >= 0.00032 && distance >= 0.00038 && speed >= 0.012);
  if (!audibleStrokeMovement) {
    if (sound) {
      try {
        const now = sound.context.currentTime;
        sound.gain.gain.setTargetAtTime(0.001, now, 0.018);
        sound.textureGain?.gain.setTargetAtTime(0.001, now, 0.012);
        sound.verticalGain?.gain.setTargetAtTime(0.001, now, 0.01);
        sound.lastPreviousPoint = previous;
        sound.lastPoint = point;
        sound.lastDirection = direction;
      } catch {
        // Optional sound gating only.
      }
    } else {
      postNativeDrawingSound('modulate', soundMode, 0.001, true, { rate, brightness, roughness: 0, wavePulse: 0 });
    }
    return;
  }
  if (!sound) {
    postNativeDrawingSound('modulate', soundMode, volume, true, { rate, brightness, roughness, wavePulse });
    return;
  }
  try {
    const now = sound.context.currentTime;
    const responseTime = 0.007 - veryFastWriting * 0.003;
    sound.gain.gain.setTargetAtTime(volume * (0.19 + soundVerticalStroke * 0.025), now, responseTime);
    sound.source.playbackRate.setTargetAtTime(rate, now, responseTime);
    sound.source.detune?.setTargetAtTime?.(
      (directionTexture - 0.5) * 76
        + pressureDelta * 34
        + wavePulse * (100 + fastWriting * 80 - smallHandwriting * 28 - minimalStroke * 22)
        + soundVerticalDrag * (72 + verticalDirectionTexture * 28)
        + compactCurve * (42 - veryFastWriting * 18)
        - minimalStraightHandwriting * 18,
      now,
      responseTime
    );
    sound.filter.frequency.setTargetAtTime(brightness, now, responseTime);
    sound.filter.Q.setTargetAtTime(0.48 + roughness * (1.35 - veryFastWriting * 0.28), now, responseTime);
    if (sound.textureGain && sound.textureFilter && sound.textureSource) {
      const textureVolume = 0.0099 * clampNumber(movement + directionChange * (0.24 - smallHandwriting * 0.08 - minimalStroke * 0.05) + slowWriting * 0.18 + smallHandwriting * 0.16 + smallAverageHandwriting * 0.18 + smallFastHandwriting * 0.2 + minimalStraightHandwriting * 0.04 + veryFastWriting * 0.22 + soundVerticalStroke * 0.3 + soundVerticalDrag * 0.38 - minimalHorizontalHandwriting * 0.04, 0, 1);
      sound.textureGain.gain.setTargetAtTime(textureVolume, now, responseTime);
      sound.textureFilter.frequency.setTargetAtTime(brightness * (1.54 + fastWriting * 0.25 + soundVerticalStroke * 0.14 + soundVerticalDrag * 0.18 - smallHandwriting * 0.12 - minimalHorizontalHandwriting * 0.05) + 220, now, responseTime);
      sound.textureFilter.Q.setTargetAtTime(0.7 + roughness * (1.56 - veryFastWriting * 0.42) + soundVerticalStroke * 0.16 + soundVerticalDrag * 0.22 - minimalHorizontalHandwriting * 0.04, now, responseTime);
      sound.textureSource.playbackRate.setTargetAtTime(0.72 + speed * 0.36 + fastWriting * 0.22 + veryFastWriting * 0.2 + soundVerticalStroke * 0.14 + soundVerticalDrag * 0.22 + compactCurve * 0.14 + wavePulse * (0.22 - minimalStroke * 0.05), now, responseTime);
      sound.textureSource.detune?.setTargetAtTime?.((segmentTexture - 0.5) * (110 - minimalStroke * 24) + directionChange * (56 + fastWriting * 52 - smallHandwriting * 16 - minimalStroke * 12) + soundVerticalStroke * 34 + soundVerticalDrag * 62, now, responseTime);
    }
    if (sound.verticalGain && sound.verticalFilter && sound.verticalSource) {
      const verticalVolume = 0.0435 * clampNumber(soundVerticalDrag * (0.68 + speed * 0.46) + soundVerticalStroke * (0.14 + fastWriting * 0.18) + minimalVerticalHandwriting * 0.26 + smallFastHandwriting * verticalStroke * 0.2, 0, 1);
      sound.verticalGain.gain.setTargetAtTime(verticalVolume, now, Math.max(0.006, responseTime * 0.72));
      sound.verticalFilter.frequency.setTargetAtTime(580 + brightness * (1.04 - minimalVerticalHandwriting * 0.1 - cleanVerticalHandwriting * 0.06) + soundVerticalDrag * (410 - minimalVerticalHandwriting * 105) + veryFastWriting * 420, now, responseTime);
      sound.verticalFilter.Q.setTargetAtTime(0.9 + soundVerticalDrag * (1.18 - minimalVerticalHandwriting * 0.28 - cleanVerticalHandwriting * 0.24) + fastWriting * 0.48, now, responseTime);
      sound.verticalSource.playbackRate.setTargetAtTime(0.76 + speed * 0.44 + soundVerticalDrag * (0.23 - minimalVerticalHandwriting * 0.045 - cleanVerticalHandwriting * 0.03) + veryFastWriting * 0.2, now, responseTime);
      sound.verticalSource.detune?.setTargetAtTime?.(soundVerticalDrag * (dy >= 0 ? 58 : 40) + directionChange * (26 - minimalVerticalHandwriting * 7 - cleanVerticalHandwriting * 7), now, responseTime);
    }
    sound.lastPreviousPoint = previous;
    sound.lastPoint = point;
    sound.lastDirection = direction;
  } catch {
    // Optional sound modulation only.
  }
}

function startDrawingStrokeSound(mode = 'spen') {
  const soundMode = normalizeDrawingSoundMode(mode);
  stopWebDrawingSound();

  try {
    const context = getDrawingAudioContext();
    if (!context) {
      postNativeDrawingSound('start', soundMode, soundMode === 'secret' ? 0.26 : 0.14, true);
      return;
    }
    if (context.state === 'suspended') {
      context.resume().then(() => startDrawingStrokeSound(soundMode)).catch(() => {});
      return;
    }

    const isSecret = soundMode === 'secret';
    if (isSecret) {
      currentSecretStudyEffect = pickSecretStudyEffect();
      playSecretStudyShuffleEffect(context, currentSecretStudyEffect);
      return;
    }
    const { buffer, textureBuffer, verticalBuffer } = getSpenLoopBuffers(context);

    const source = context.createBufferSource();
    const textureSource = context.createBufferSource();
    const verticalSource = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const textureFilter = context.createBiquadFilter();
    const verticalFilter = context.createBiquadFilter();
    const gain = context.createGain();
    const textureGain = context.createGain();
    const verticalGain = context.createGain();
    source.buffer = buffer;
    source.loop = true;
    source.playbackRate.value = isSecret ? 0.92 : 0.86;
    textureSource.buffer = textureBuffer;
    textureSource.loop = true;
    textureSource.playbackRate.value = isSecret ? 0.86 : 0.78;
    verticalSource.buffer = verticalBuffer;
    verticalSource.loop = true;
    verticalSource.playbackRate.value = 0.84;
    filter.type = 'bandpass';
    filter.frequency.value = isSecret ? 1500 : 360;
    filter.Q.value = isSecret ? 4.4 : 0.82;
    textureFilter.type = 'bandpass';
    textureFilter.frequency.value = isSecret ? 1800 : 860;
    textureFilter.Q.value = isSecret ? 4.2 : 1.1;
    verticalFilter.type = 'bandpass';
    verticalFilter.frequency.value = 980;
    verticalFilter.Q.value = 1.4;
    gain.gain.setValueAtTime(0.001, context.currentTime);
    textureGain.gain.setValueAtTime(0.001, context.currentTime);
    verticalGain.gain.setValueAtTime(0.001, context.currentTime);
    gain.gain.linearRampToValueAtTime(0.004, context.currentTime + 0.008);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    textureSource.connect(textureFilter);
    textureFilter.connect(textureGain);
    textureGain.connect(context.destination);
    verticalSource.connect(verticalFilter);
    verticalFilter.connect(verticalGain);
    verticalGain.connect(context.destination);
    source.start();
    textureSource.start();
    verticalSource.start();
    activeDrawingSound = { context, source, textureSource, verticalSource, filter, textureFilter, verticalFilter, gain, textureGain, verticalGain, lastPoint: null, lastPreviousPoint: null };
  } catch {
    // Drawing sound is optional; never block the writing canvas.
  }
}

function stopDrawingStrokeSound() {
  postNativeDrawingSound('stop', 'spen', 0, true);
  currentSecretStudyEffect = '';
  lastSecretStudyEffectAt = 0;
  stopWebDrawingSound();
}

function quietDrawingStrokeSound(mode = 'spen') {
  const soundMode = normalizeDrawingSoundMode(mode);
  postNativeDrawingSound('modulate', soundMode, 0.001, true, {
    rate: soundMode === 'secret' ? 0.86 : 0.72,
    brightness: soundMode === 'secret' ? 1200 : 320,
    roughness: 0,
    wavePulse: 0,
  });

  const sound = activeDrawingSound;
  if (!sound) return;
  try {
    const now = sound.context.currentTime;
    sound.gain.gain.setTargetAtTime(0.001, now, 0.045);
    sound.textureGain?.gain.setTargetAtTime(0.001, now, 0.025);
    sound.verticalGain?.gain.setTargetAtTime(0.001, now, 0.02);
    sound.filter.Q.setTargetAtTime(0.7, now, 0.045);
  } catch {
    // Optional sound fade only.
  }
}

function unlockDrawingAudio() {
  try {
    const context = getDrawingAudioContext();
    if (context?.state === 'suspended') {
      context.resume().then(() => getSpenLoopBuffers(context)).catch(() => {});
      return;
    }
    if (context) getSpenLoopBuffers(context);
  } catch {
    // Audio unlock is best-effort only.
  }
}

function LockIcon({ size = 48 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M15 21v-4.2C15 11.4 18.8 7.5 24 7.5s9 3.9 9 9.3V21" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
      <rect x="10.5" y="21" width="27" height="18.5" rx="4.5" stroke="currentColor" strokeWidth="3.2" />
      <path d="M24 27.8v4.8" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}

// ── Theme ─────────────────────────────────────────────────────────────────────
function useDark() {
  const [d, setD] = useState(() => document.documentElement.getAttribute('data-theme') === 'dark');
  useEffect(() => {
    const ob = new MutationObserver(() => setD(document.documentElement.getAttribute('data-theme') === 'dark'));
    ob.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => ob.disconnect();
  }, []);
  return d;
}

const ICONS_LIB = ['☆','💡','📚','🌿','📅','🏷️','💬','✅','⚠️','❓','🔄','📌','🩺','💊','🧬','🔬'];
const DECOS_LIB = ['✦','✧','♡','☁','〰','🌿','🍃','✿','✾','❋','◆','◇'];
const STICKERS  = ['⭐','🔥','💡','🏆','✅','⚠️','❤️','👍','🧠','📚','📌','❗','❓','🚀','✏️','✨','⏰','🚩','🎯','💊','🧬','🔬','🩺','📊'];
const DRAW_COLORS = ['#1f2937', '#2563eb', '#7c3aed', '#dc2626', '#047857', '#f59e0b'];
const DRAW_WIDTHS = [3, 5, 8];
const HIGHLIGHT_COLORS = ['#fde047', '#86efac', '#93c5fd', '#f0abfc'];

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, number));
}

function normalizeStrokePressure(event) {
  const pressure = Number(event?.pressure);
  if (!Number.isFinite(pressure) || pressure <= 0) {
    return event?.pointerType === 'mouse' ? 0.62 : 0.78;
  }
  return clampNumber(pressure, 0.24, 1);
}

function isStylusPointerEvent(event) {
  const nativeEvent = event?.nativeEvent || event || {};
  const pointerType = String(event?.pointerType || nativeEvent?.pointerType || '').toLowerCase();
  if (pointerType === 'pen' || pointerType === 'stylus') return true;

  const touchType = String(event?.touchType || nativeEvent?.touchType || '').toLowerCase();
  return pointerType === 'touch' && (touchType === 'stylus' || touchType === 'pencil');
}

function hasStylusTouch(event) {
  const touches = Array.from(event?.changedTouches || event?.touches || []);
  return touches.some((touch) => {
    const touchType = String(touch?.touchType || '').toLowerCase();
    return touchType === 'stylus' || touchType === 'pencil';
  });
}

function strokePointDistance(a, b) {
  return Math.hypot((Number(a?.x) || 0) - (Number(b?.x) || 0), (Number(a?.y) || 0) - (Number(b?.y) || 0));
}

function shouldKeepStrokePoint(points, point) {
  const last = points[points.length - 1];
  if (!last) return true;
  const distance = strokePointDistance(last, point);
  const pressureDelta = Math.abs((Number(last.pressure) || 0.7) - (Number(point.pressure) || 0.7));
  return distance >= 0.00035 || pressureDelta >= 0.06;
}

function simplifyStrokePoints(points = []) {
  if (points.length <= 2) return points;
  const refined = [points[0]];
  for (let i = 1; i < points.length - 1; i += 1) {
    const current = points[i];
    const last = refined[refined.length - 1];
    const pressureDelta = Math.abs((Number(last?.pressure) || 0.7) - (Number(current?.pressure) || 0.7));
    if (strokePointDistance(last, current) >= 0.0003 || pressureDelta >= 0.045) {
      refined.push(current);
    }
  }
  refined.push(points[points.length - 1]);
  return refined.slice(-2200);
}

function canvasPoint(point, width, height) {
  return {
    x: clampNumber(point?.x, 0, 1) * width,
    y: clampNumber(point?.y, 0, 1) * height,
    pressure: clampNumber(point?.pressure ?? 0.72, 0.24, 1),
  };
}

function pressureStrokeWidth(baseWidth, pressure) {
  return Math.max(1, baseWidth * (0.72 + clampNumber(pressure, 0.24, 1) * 0.5));
}

function averageStrokePressure(points = []) {
  if (!points.length) return 0.72;
  return points.reduce((total, point) => total + clampNumber(point?.pressure ?? 0.72, 0.24, 1), 0) / points.length;
}

function midPoint(a, b) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    pressure: (a.pressure + b.pressure) / 2,
  };
}

function blendStrokePoint(a, b, amount = 0.5) {
  if (!a) return b;
  if (!b) return a;
  const mix = clampNumber(amount, 0, 1);
  return {
    ...b,
    x: a.x + (b.x - a.x) * mix,
    y: a.y + (b.y - a.y) * mix,
    pressure: (Number(a.pressure) || 0.72) + ((Number(b.pressure) || 0.72) - (Number(a.pressure) || 0.72)) * mix,
  };
}

function smoothStrokePoints(points = [], passes = 2) {
  if (points.length <= 2) return points;
  let smoothed = points;
  for (let pass = 0; pass < passes; pass += 1) {
    smoothed = smoothed.map((point, index) => {
      if (index === 0 || index === smoothed.length - 1) return point;
      const previous = smoothed[index - 1];
      const next = smoothed[index + 1];
      return {
        ...point,
        x: (previous.x + point.x * 2 + next.x) / 4,
        y: (previous.y + point.y * 2 + next.y) / 4,
        pressure: (clampNumber(previous.pressure ?? 0.72, 0.24, 1) + clampNumber(point.pressure ?? 0.72, 0.24, 1) * 2 + clampNumber(next.pressure ?? 0.72, 0.24, 1)) / 4,
      };
    });
  }
  return smoothed;
}

function drawSmoothStroke(ctx, stroke, width, height) {
  const rawPoints = Array.isArray(stroke?.points) ? stroke.points : [];
  if (rawPoints.length < 1) return;

  const isHighlighter = stroke?.tool === 'highlighter';
  const renderPoints = rawPoints.length > 2 && isHighlighter ? smoothStrokePoints(rawPoints, 1) : rawPoints;
  const points = renderPoints.map(point => canvasPoint(point, width, height));
  const baseWidth = Math.max(1, Number(stroke?.width) || 4);
  const color = stroke?.color || '#1f2937';

  ctx.save();
  ctx.globalAlpha = Number(stroke?.opacity) || 0.96;
  if (isHighlighter) {
    ctx.globalCompositeOperation = 'multiply';
  }
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;

  if (points.length === 1) {
    const point = points[0];
    ctx.beginPath();
    ctx.arc(point.x, point.y, pressureStrokeWidth(baseWidth, point.pressure) / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (points.length === 2) {
    const [start, end] = points;
    ctx.lineWidth = pressureStrokeWidth(baseWidth, (start.pressure + end.pressure) / 2);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (isHighlighter) {
    ctx.lineWidth = baseWidth;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length - 1; i += 1) {
      const end = midPoint(points[i], points[i + 1]);
      ctx.quadraticCurveTo(points[i].x, points[i].y, end.x, end.y);
    }
    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  ctx.lineWidth = pressureStrokeWidth(baseWidth, averageStrokePressure(points));
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length - 1; i += 1) {
    const end = midPoint(points[i], points[i + 1]);
    ctx.quadraticCurveTo(points[i].x, points[i].y, end.x, end.y);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
  ctx.restore();
}

function drawEraserStroke(ctx, stroke, width, height) {
  const rawPoints = Array.isArray(stroke?.points) ? stroke.points : [];
  if (!rawPoints.length) return;
  const points = (rawPoints.length > 2 ? smoothStrokePoints(rawPoints, 1) : rawPoints)
    .map(point => canvasPoint(point, width, height));
  const eraserWidth = Math.max(12, Number(stroke?.width) || 32);

  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#000';
  ctx.fillStyle = '#000';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = eraserWidth;

  if (points.length === 1) {
    const point = points[0];
    ctx.beginPath();
    ctx.arc(point.x, point.y, eraserWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length - 1; i += 1) {
    const end = midPoint(points[i], points[i + 1]);
    ctx.quadraticCurveTo(points[i].x, points[i].y, end.x, end.y);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
  ctx.restore();
}

function HighlighterIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M8.4 1.7l3.8 3.8-5.6 5.6-3.8-3.8 5.6-5.6z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
      <path d="M2.1 8l3.9 3.9-4.2.4.3-4.3zM8.7 4.9l1.1 1.1" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function EraserIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M8.2 1.8l4 4a1.2 1.2 0 0 1 0 1.7l-3.5 3.5H4.4L1.8 8.4a1.2 1.2 0 0 1 0-1.7l4.7-4.9a1.2 1.2 0 0 1 1.7 0z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
      <path d="M4.6 4.1l5.2 5.2M4.4 11h7.8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
    </svg>
  );
}
function getMCQTag(note) {
  const t = `${note?.title||''} ${note?.courseTitle||''} ${note?.topicName||''}`.toLowerCase();
  if (/cardiac|heart|coronar|arrhythm|myocard/.test(t)) return { tag:'Cardiology',   c:'#9d174d', bg:'#fce7f3' };
  if (/neuro|brain|stroke|parkinson|seizure/.test(t))    return { tag:'Neurology',    c:'#1e3a5f', bg:'#dbeafe' };
  if (/pharmac|drug|medication|antibiotic/.test(t))       return { tag:'Pharmacology', c:'#4a1d96', bg:'#ede9fe' };
  if (/pathol|cancer|tumour|neoplasm/.test(t))            return { tag:'Pathology',    c:'#7c2d12', bg:'#fff7ed' };
  if (/anatom|muscle|nerve|ligament/.test(t))             return { tag:'Anatomy',      c:'#14532d', bg:'#dcfce7' };
  return { tag:'Clinical Med.', c:'#334155', bg:'#f1f5f9' };
}

function studentCanvasPersonalStorageKey(noteId) {
  return noteId ? `lms.studentCanvas.personal.${noteId}` : '';
}

function normalizePersonalLayer(saved) {
  if (Array.isArray(saved)) return { stickers:saved, strokes:[] };
  if (!saved || typeof saved !== 'object') return { stickers:[], strokes:[] };
  return {
    stickers:Array.isArray(saved.stickers) ? saved.stickers : [],
    strokes:Array.isArray(saved.strokes) ? saved.strokes.filter(stroke => Array.isArray(stroke?.points) && stroke.points.length > 0) : [],
  };
}

function PenIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M8.7 1.8l3.5 3.5-6.9 6.9-3.7.6.6-3.7 6.5-7.3z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
      <path d="M7.6 3.2l3.2 3.2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
    </svg>
  );
}

function UndoIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M5.2 4H9a3.2 3.2 0 1 1 0 6.4H4.4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
      <path d="M5.4 1.8L3.1 4l2.3 2.2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function TrashIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2.4 3.7h9.2M5.2 2.2h3.6M4 3.7l.5 7.2c.04.56.5 1 1.06 1h2.88c.56 0 1.02-.44 1.06-1l.5-7.2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5.8 5.7v3.8M8.2 5.7v3.8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
    </svg>
  );
}

// ── Floating sticker ──────────────────────────────────────────────────────────
function FloatingSticker({ s, editable, onUpdate, onDelete, canvasRef }) {
  const dr = useRef(null), el = useRef(null);
  function onPD(e) {
    if (!editable) return;
    e.stopPropagation(); e.preventDefault();
    const r = canvasRef.current?.getBoundingClientRect(); if (!r) return;
    const w = s.type === 'note' ? (s.w || 180) : 40;
    const h = s.type === 'note' ? (s.h || 110) : 40;
    dr.current = { sx:e.clientX, sy:e.clientY, ox:s.x, oy:s.y, x:s.x, y:s.y, w, h, r };
    if (el.current) {
      el.current.style.cursor = 'grabbing';
      el.current.style.willChange = 'transform';
    }
    el.current?.setPointerCapture(e.pointerId);
  }
  function onPM(e) {
    const d = dr.current; if (!d) return;
    d.x = Math.max(0, Math.min(d.r.width - d.w, d.ox + e.clientX - d.sx));
    d.y = Math.max(0, Math.min(d.r.height - d.h, d.oy + e.clientY - d.sy));
    if (el.current) {
      el.current.style.transform = `translate3d(${d.x - d.ox}px, ${d.y - d.oy}px, 0) rotate(${s.r || 0}deg)`;
    }
  }
  function finishDrag(e) {
    const d = dr.current;
    if (!d) return;
    if (el.current) {
      el.current.style.cursor = editable ? 'grab' : 'default';
      el.current.style.willChange = '';
      el.current.style.transform = `rotate(${s.r || 0}deg)`;
    }
    dr.current = null;
    try { e?.currentTarget?.releasePointerCapture?.(e.pointerId); } catch { /* pointer may already be released */ }
    if (Math.abs(d.x - d.ox) > 0.5 || Math.abs(d.y - d.oy) > 0.5) {
      onUpdate({ ...s, x:d.x, y:d.y });
    }
  }
  return (
    <div ref={el} onPointerDown={onPD} onPointerMove={onPM} onPointerUp={finishDrag} onPointerCancel={finishDrag}
      className="group/fs absolute select-none leading-none"
      style={{ left:s.x, top:s.y, cursor:editable?'grab':'default', zIndex:20, transform:`rotate(${s.r||0}deg)`, touchAction:editable?'none':'auto' }}>
      {s.type === 'note' ? (
        <div
          className="rounded-xl border border-amber-300/70 bg-amber-100/95 p-3 text-slate-700 shadow-[0_12px_24px_rgba(120,72,20,.16)]"
          style={{ width:s.w || 180, minHeight:s.h || 96, ...KL }}
        >
          <div className="absolute left-1/2 top-[-5px] size-3 -translate-x-1/2 rounded-full bg-amber-400 shadow-sm" />
          {editable ? (
            <textarea className="block min-h-[72px] w-full resize-y border-0 bg-transparent text-[15px] font-bold leading-snug outline-none"
              value={s.text || ''}
              onPointerDown={e => e.stopPropagation()}
              onChange={e => onUpdate({ ...s, text:e.target.value })}
              placeholder="Write your note..."
            />
          ) : (
            <p className="m-0 whitespace-pre-wrap text-[15px] font-bold leading-snug">{s.text}</p>
          )}
        </div>
      ) : (
        <span className="text-2xl">{s.emoji}</span>
      )}
      {editable && <button className="absolute -right-2 -top-2 hidden size-4 items-center justify-center rounded-full bg-red-500 text-[9px] text-white group-hover/fs:flex"
        type="button"
        onClick={() => onDelete(s.id)}>✕</button>}
    </div>
  );
}

const PersonalDrawingLayer = memo(function PersonalDrawingLayer({
  parentRef,
  editable,
  drawMode,
  drawTool = 'pen',
  strokes,
  penColor,
  penWidth,
  soundMode = 'spen',
  stylusOnly = true,
  onCommitStroke,
}) {
  const canvasEl = useRef(null);
  const highlightCanvasEl = useRef(null);
  const currentStrokeRef = useRef(null);
  const strokeScrollLockRef = useRef(null);
  const strokeSoundIdleTimerRef = useRef(0);
  const stylusTouchUntilRef = useRef(0);
  const strokesRef = useRef(strokes);
  const [eraserCursor, setEraserCursor] = useState(null);

  const prepareCanvas = useCallback((canvas, width, height, dpr) => {
    if (!canvas) return null;
    const targetWidth = Math.round(width * dpr);
    const targetHeight = Math.round(height * dpr);
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, width, height);
    return ctx;
  }, []);

  const drawAll = useCallback((items = strokesRef.current) => {
    const inkCanvas = canvasEl.current;
    const highlightCanvas = highlightCanvasEl.current;
    const host = parentRef.current;
    if (!inkCanvas || !highlightCanvas || !host) return;
    const rect = host.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 4));
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const inkCtx = prepareCanvas(inkCanvas, width, height, dpr);
    const highlightCtx = prepareCanvas(highlightCanvas, width, height, dpr);
    if (!inkCtx || !highlightCtx) return;
    const eraserStrokes = [];
    items.forEach((stroke) => {
      if (stroke?.tool === 'eraser') {
        eraserStrokes.push(stroke);
        return;
      }
      drawSmoothStroke(stroke?.tool === 'highlighter' ? highlightCtx : inkCtx, stroke, width, height);
    });
    eraserStrokes.forEach((stroke) => {
      drawEraserStroke(highlightCtx, stroke, width, height);
      drawEraserStroke(inkCtx, stroke, width, height);
    });
  }, [parentRef, prepareCanvas]);

  function canvasMetrics() {
    const host = parentRef.current;
    if (!host) return null;
    const rect = host.getBoundingClientRect();
    return {
      width: Math.max(1, Math.round(rect.width)),
      height: Math.max(1, Math.round(rect.height)),
    };
  }

  function drawLiveEraserSegment(stroke, fromPoint, toPoint, metrics) {
    const eraserWidth = Math.max(12, Number(stroke?.width) || 32);
    const from = canvasPoint(fromPoint, metrics.width, metrics.height);
    const to = canvasPoint(toPoint, metrics.width, metrics.height);
    [highlightCanvasEl.current, canvasEl.current].forEach((canvas) => {
      const ctx = canvas?.getContext('2d');
      if (!ctx) return;
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#000';
      ctx.fillStyle = '#000';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = eraserWidth;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      ctx.restore();
    });
  }

  function drawLiveStrokeSegment(stroke, fromPoint, toPoint) {
    const metrics = canvasMetrics();
    if (!metrics) return;
    if (stroke?.tool === 'eraser') {
      drawLiveEraserSegment(stroke, fromPoint, toPoint, metrics);
    }
  }

  useEffect(() => {
    strokesRef.current = strokes;
    drawAll(strokes);
  }, [drawAll, strokes]);

  useEffect(() => {
    const host = parentRef.current;
    if (!host) return undefined;
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => drawAll()) : null;
    observer?.observe(host);
    window.addEventListener('resize', drawAll);
    drawAll();
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', drawAll);
    };
  }, [drawAll, parentRef]);

  useEffect(() => {
    const canvas = canvasEl.current;
    if (!canvas || !editable || !drawMode) return undefined;
    const handleNativeTouchStart = (event) => {
      if (!hasStylusTouch(event)) return;
      stylusTouchUntilRef.current = Date.now() + 90;
    };
    const handleNativeTouchMove = (event) => {
      if (!currentStrokeRef.current || !hasStylusTouch(event) || !event.cancelable) return;
      event.preventDefault();
    };
    const handleNativeTouchEnd = (event) => {
      if (hasStylusTouch(event)) stylusTouchUntilRef.current = 0;
    };
    canvas.addEventListener('touchstart', handleNativeTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleNativeTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleNativeTouchEnd, { passive: true });
    canvas.addEventListener('touchcancel', handleNativeTouchEnd, { passive: true });
    return () => {
      canvas.removeEventListener('touchstart', handleNativeTouchStart);
      canvas.removeEventListener('touchmove', handleNativeTouchMove);
      canvas.removeEventListener('touchend', handleNativeTouchEnd);
      canvas.removeEventListener('touchcancel', handleNativeTouchEnd);
    };
  }, [drawMode, editable]);

  function pointFromEvent(event) {
    const rect = parentRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: clampNumber((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1),
      y: clampNumber((event.clientY - rect.top) / Math.max(1, rect.height), 0, 1),
      pressure: normalizeStrokePressure(event),
      tiltX: Number(event.tiltX) || 0,
      tiltY: Number(event.tiltY) || 0,
      twist: Number(event.twist) || 0,
      pointerType: String(event.pointerType || ''),
      t: Math.round(event.timeStamp || performance.now?.() || Date.now()),
    };
  }

function appendPointToCurrentStroke(event) {
    const stroke = currentStrokeRef.current;
    if (!stroke) return null;
    const point = pointFromEvent(event);
    if (!point || !shouldKeepStrokePoint(stroke.points, point)) return null;
    const previous = stroke.points[stroke.points.length - 1] || point;
    stroke.points.push(point);
    if (stroke.points.length > 2200) stroke.points.splice(0, stroke.points.length - 2200);
    return { previous, point };
  }

  function eraserBrushWidth() {
    return Math.max(22, (Number(penWidth) || 5) * 7);
  }

  function updateEraserCursor(event) {
    const point = pointFromEvent(event);
    if (!point) return false;
    setEraserCursor({ x:point.x, y:point.y, size:eraserBrushWidth() });
    return true;
  }

  function getScrollTarget() {
    let element = parentRef.current;
    while (element && element !== document.body) {
      const style = window.getComputedStyle?.(element);
      const canScrollY = style && /(auto|scroll)/.test(style.overflowY || '');
      if (canScrollY && element.scrollHeight > element.clientHeight) return element;
      element = element.parentElement;
    }
    return document.querySelector('.lms-app-scroll-root')
      || document.querySelector('.native-app-frame')
      || document.scrollingElement
      || document.documentElement;
  }

  function getScrollLockTargets() {
    const targets = [
      getScrollTarget(),
      document.querySelector('.lms-app-scroll-root'),
      document.querySelector('.native-app-frame'),
      document.scrollingElement,
      document.documentElement,
      document.body,
    ].filter(Boolean);
    let element = parentRef.current;
    while (element && element !== document.body) {
      const style = window.getComputedStyle?.(element);
      if (style && /(auto|scroll)/.test(style.overflowY || '')) targets.push(element);
      element = element.parentElement;
    }
    return Array.from(new Set(targets));
  }

  function beginStrokeScrollLock() {
    const targets = getScrollLockTargets();
    strokeScrollLockRef.current = {
      targets: targets.map((target) => ({
        target,
        top: target === document.body || target === document.documentElement || target === document.scrollingElement
          ? (window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0)
          : target.scrollTop,
        left: target === document.body || target === document.documentElement || target === document.scrollingElement
          ? (window.scrollX || document.documentElement.scrollLeft || document.body.scrollLeft || 0)
          : target.scrollLeft,
        overflowY: target.style.overflowY,
        overscrollBehavior: target.style.overscrollBehavior,
        touchAction: target.style.touchAction,
      })),
      windowX: window.scrollX || 0,
      windowY: window.scrollY || 0,
      frame: 0,
    };
    targets.forEach((target) => {
      target.style.overflowY = 'hidden';
      target.style.overscrollBehavior = 'none';
      target.style.touchAction = 'none';
    });
  }

  function holdStrokeScrollLock(schedule = false) {
    const lock = strokeScrollLockRef.current;
    if (!lock) return;
    const restore = () => {
      const current = strokeScrollLockRef.current;
      if (!current) return;
      current.targets.forEach(({ target, top, left }) => {
        const isDocument = target === document.body || target === document.documentElement || target === document.scrollingElement;
        if (isDocument) return;
        if (target.scrollTop !== top) target.scrollTop = top;
        if (target.scrollLeft !== left) target.scrollLeft = left;
      });
      if ((window.scrollX || 0) !== current.windowX || (window.scrollY || 0) !== current.windowY) {
        window.scrollTo(current.windowX, current.windowY);
      }
    };

    restore();
    if (schedule) {
      if (lock.frame) window.cancelAnimationFrame(lock.frame);
      lock.frame = window.requestAnimationFrame(restore);
    }
  }

  function endStrokeScrollLock() {
    const lock = strokeScrollLockRef.current;
    if (!lock) return;
    if (lock.frame) window.cancelAnimationFrame(lock.frame);
    holdStrokeScrollLock(false);
    lock.targets.forEach(({ target, overflowY, overscrollBehavior, touchAction }) => {
      target.style.overflowY = overflowY;
      target.style.overscrollBehavior = overscrollBehavior;
      target.style.touchAction = touchAction;
    });
    strokeScrollLockRef.current = null;
  }

  function blockDrawingGesture(event) {
    if (!editable || !drawMode) return;
    if (event?.cancelable !== false) event.preventDefault?.();
    event.stopPropagation?.();
    holdStrokeScrollLock(true);
  }

  function clearStrokeSoundIdleTimer() {
    if (!strokeSoundIdleTimerRef.current) return;
    window.clearTimeout(strokeSoundIdleTimerRef.current);
    strokeSoundIdleTimerRef.current = 0;
  }

  function scheduleStrokeSoundIdleStop(stroke) {
    clearStrokeSoundIdleTimer();
    strokeSoundIdleTimerRef.current = window.setTimeout(() => {
      const currentStroke = currentStrokeRef.current;
      if (currentStroke !== stroke || !currentStroke?.soundStarted) return;
      quietDrawingStrokeSound(soundMode);
    }, 220);
  }

  function onPointerDown(event) {
    if (!editable || !drawMode) return;
    const pointerType = String(event.pointerType || '').toLowerCase();
    const isStylusInput = isStylusPointerEvent(event)
      || (pointerType === 'touch' && Date.now() <= stylusTouchUntilRef.current);
    if (stylusOnly && !isStylusInput) {
      return;
    }
    const point = pointFromEvent(event);
    if (!point) {
      blockDrawingGesture(event);
      return;
    }
    blockDrawingGesture(event);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    beginStrokeScrollLock();
    holdStrokeScrollLock(true);
    unlockDrawingAudio();
    if (drawTool === 'eraser') {
      currentStrokeRef.current = {
        id: `eraser-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        color: '#000000',
        width: eraserBrushWidth(),
        opacity: 1,
        tool: 'eraser',
        points: [point],
      };
      setEraserCursor({ x:point.x, y:point.y, size:eraserBrushWidth() });
      drawAll([...strokesRef.current, currentStrokeRef.current]);
      return;
    }
    const isHighlighter = drawTool === 'highlighter';
    currentStrokeRef.current = {
      id: `stroke-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      color: penColor,
      width: isHighlighter ? Math.max(10, penWidth * 2.4) : penWidth,
      opacity: isHighlighter ? 0.36 : 0.98,
      tool: drawTool,
      points: [point],
      smoothedSoundPoint: point,
      soundStarted: false,
    };
    drawAll([...strokesRef.current, currentStrokeRef.current]);
  }

  function onPointerMove(event) {
    if (!editable || !drawMode) return;
    if (!currentStrokeRef.current) return;
    blockDrawingGesture(event);
    if (drawTool === 'eraser') updateEraserCursor(event);

    const events = typeof event.getCoalescedEvents === 'function'
      ? event.getCoalescedEvents()
      : [event];
    const appendedSegments = [];
    events.forEach(pointerEvent => {
      const segment = appendPointToCurrentStroke(pointerEvent);
      if (segment) appendedSegments.push(segment);
    });

    if (appendedSegments.length) {
      holdStrokeScrollLock(true);
      if (drawTool === 'eraser') updateEraserCursor(event);
      const stroke = currentStrokeRef.current;
      if (stroke?.tool !== 'eraser') {
        drawAll([...strokesRef.current, stroke]);
      }
      appendedSegments.forEach(segment => {
        if (stroke?.tool === 'eraser') {
          drawLiveStrokeSegment(stroke, segment.previous, segment.point);
          return;
        }
        const soundPrevious = stroke.smoothedSoundPoint || segment.previous;
        const dx = segment.point.x - soundPrevious.x;
        const dy = segment.point.y - soundPrevious.y;
        const distance = Math.hypot(dx, dy);
        const verticalStroke = distance > 0 ? clampNumber((Math.abs(dy) / distance - 0.45) / 0.55, 0, 1) : 0;
        const verticalWake = isAudibleTinyVerticalMovement(segment.previous, segment.point);
        const averageWake = isAudibleTinyAverageMovement(segment.previous, segment.point);
        const fastWake = isAudibleTinyFastMovement(segment.previous, segment.point);
        const soundPoint = blendStrokePoint(soundPrevious, segment.point, verticalWake || fastWake ? 0.92 : averageWake ? 0.82 : 0.4 + verticalStroke * 0.24);
        stroke.smoothedSoundPoint = soundPoint;
        const audibleMovement = isAudibleStrokeMovement(soundPrevious, soundPoint)
          || isAudibleStrokeMovement(segment.previous, segment.point)
          || averageWake
          || fastWake
          || verticalWake;
        if (!stroke.soundStarted && !audibleMovement) {
          return;
        }
        if (!stroke.soundStarted) {
          stroke.soundStarted = true;
          startDrawingStrokeSound(soundMode);
          if (activeDrawingSound) {
            activeDrawingSound.lastPoint = soundPrevious;
            activeDrawingSound.lastPreviousPoint = null;
          }
        }
        modulateDrawingStrokeSound(verticalWake || averageWake || fastWake ? segment.previous : soundPrevious, soundPoint, soundMode);
        scheduleStrokeSoundIdleStop(stroke);
      });
    }
  }

  function finishStroke(event) {
    const stroke = currentStrokeRef.current;
    if (!stroke && drawTool !== 'eraser') return;
    if (event?.cancelable !== false) event?.preventDefault?.();
    event?.stopPropagation?.();
    clearStrokeSoundIdleTimer();
    stopDrawingStrokeSound();
    endStrokeScrollLock();
    stylusTouchUntilRef.current = 0;
    currentStrokeRef.current = null;
    try {
      if (event?.pointerId != null) event.currentTarget?.releasePointerCapture?.(event.pointerId);
    } catch {
      /* pointer may already be released */
    }

    if (!stroke) return;
    const points = simplifyStrokePoints(stroke.points);
    if (points.length > 0) {
      onCommitStroke({ ...stroke, points });
    }
  }

  function hideEraserCursor() {
    setEraserCursor(null);
  }

  const eraserDiameter = `${Math.round(eraserCursor?.size || Math.max(20, (Number(penWidth) || 5) * 8))}px`;

  return (
    <>
      {drawMode && editable && drawTool === 'eraser' && eraserCursor && (
        <div
          aria-hidden="true"
          style={{
            position:'absolute',
            left:`${eraserCursor.x * 100}%`,
            top:`${eraserCursor.y * 100}%`,
            width:eraserDiameter,
            height:eraserDiameter,
            border:'2px solid rgba(37,99,235,.78)',
            borderRadius:999,
            background:'rgba(96,165,250,.12)',
            boxShadow:'0 0 0 2px rgba(255,255,255,.72), 0 8px 22px rgba(15,23,42,.16)',
            transform:'translate(-50%, -50%)',
            zIndex:34,
            pointerEvents:'none',
          }}
        />
      )}
      <canvas
        ref={highlightCanvasEl}
        className="lms-student-highlight-layer"
        aria-hidden="true"
        style={{
          position:'absolute',
          inset:0,
          zIndex:30,
          pointerEvents:'none',
          mixBlendMode:'multiply',
          WebkitTouchCallout:'none',
          WebkitUserSelect:'none',
          userSelect:'none',
        }}
      />
      <canvas
        ref={canvasEl}
        className="lms-student-drawing-layer"
        aria-label="Personal writing canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
        onPointerLeave={hideEraserCursor}
        style={{
          position:'absolute',
          inset:0,
          zIndex:drawMode && editable ? 32 : 18,
          pointerEvents:drawMode && editable ? 'auto' : 'none',
          touchAction:drawMode && editable ? 'none' : 'auto',
          cursor:drawMode && editable ? 'crosshair' : 'default',
          WebkitTouchCallout:'none',
          WebkitUserSelect:'none',
          userSelect:'none',
        }}
      />
    </>
  );
});

function FloatingWritingPalette({
  isDark,
  isEditing,
  drawMode,
  drawTool,
  penColor,
  penWidth,
  soundMode,
  strokeCount,
  onActivate,
  onToolChange,
  onPenColorChange,
  onPenWidthChange,
  onSoundModeChange,
  onUndoStroke,
  onClearStrokes,
}) {
  const [open, setOpen] = useState(false);
  const paletteRef = useRef(null);
  const bd = isDark ? 'rgba(148,163,184,.24)' : 'rgba(148,163,184,.36)';
  const panelBg = isDark ? 'rgba(15,23,42,.96)' : 'rgba(255,255,255,.97)';
  const tx = isDark ? '#e2e8f0' : '#1e293b';
  const muted = isDark ? 'rgba(203,213,225,.72)' : '#64748b';
  const activeBg = isDark ? 'rgba(96,165,250,.2)' : '#eff6ff';
  const selectedSoundMode = normalizeDrawingSoundMode(soundMode);
  const tools = [
    { id:'pen', label:'Pen', icon:<PenIcon /> },
    { id:'highlighter', label:'Highlighter', icon:<HighlighterIcon /> },
    { id:'eraser', label:'Eraser', icon:<EraserIcon /> },
  ];
  const colors = drawTool === 'highlighter' ? HIGHLIGHT_COLORS : DRAW_COLORS;
  const handleMainClick = () => {
    if (!drawMode) {
      onActivate();
      setOpen(false);
      return;
    }
    onActivate();
    setOpen(value => !value);
  };

  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;
    const closeOnOutsideTouch = (event) => {
      if (paletteRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideTouch, true);
    document.addEventListener('touchstart', closeOnOutsideTouch, true);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideTouch, true);
      document.removeEventListener('touchstart', closeOnOutsideTouch, true);
    };
  }, [open]);

  return (
    <div
      ref={paletteRef}
      className="lms-ai-note-write-palette"
      style={{
        position:'fixed',
        right:'max(16px, var(--lms-safe-right, 0px))',
        bottom:'calc(var(--lms-mobile-content-bottom, 68px) + 16px)',
        zIndex:92,
        display:'flex',
        flexDirection:'column',
        alignItems:'flex-end',
        gap:10,
        pointerEvents:'none',
      }}
    >
      {open && (
        <div
          style={{
            width:248,
            border:`1px solid ${bd}`,
            borderRadius:18,
            background:panelBg,
            color:tx,
            boxShadow:isDark ? '0 22px 54px rgba(0,0,0,.42)' : '0 22px 54px rgba(15,23,42,.2)',
            padding:12,
            pointerEvents:'auto',
            backdropFilter:'blur(18px)',
          }}
        >
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:7, marginBottom:10 }}>
            {tools.map((tool) => (
              <button
                key={tool.id}
                type="button"
                onClick={() => {
                  onToolChange(tool.id);
                  if (!drawMode) onActivate();
                }}
                aria-pressed={drawTool === tool.id}
                className="inline-flex items-center justify-center"
                title={tool.label}
                style={{
                  minHeight:42,
                  border:`1px solid ${drawTool === tool.id ? (isDark ? 'rgba(96,165,250,.62)' : '#2563eb') : bd}`,
                  borderRadius:12,
                  background:drawTool === tool.id ? activeBg : 'transparent',
                  color:drawTool === tool.id ? (isDark ? '#bfdbfe' : '#1d4ed8') : tx,
                  cursor:'pointer',
                }}
              >
                {tool.icon}
              </button>
            ))}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7, marginBottom:10 }}>
            {DRAWING_SOUND_MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => onSoundModeChange?.(mode.id)}
                aria-pressed={selectedSoundMode === mode.id}
                style={{
                  minHeight:34,
                  border:`1px solid ${selectedSoundMode === mode.id ? (isDark ? 'rgba(45,212,191,.52)' : '#0f766e') : bd}`,
                  borderRadius:11,
                  background:selectedSoundMode === mode.id ? (isDark ? 'rgba(45,212,191,.14)' : '#ecfdf5') : 'transparent',
                  color:selectedSoundMode === mode.id ? (isDark ? '#99f6e4' : '#0f766e') : muted,
                  cursor:'pointer',
                  fontSize:10.5,
                  fontWeight:900,
                }}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {drawTool !== 'eraser' && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:7, marginBottom:10 }}>
              {colors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => onPenColorChange(color)}
                  aria-label={`Use ${color}`}
                  aria-pressed={penColor === color}
                  style={{
                    width:30,
                    height:30,
                    borderRadius:10,
                    border:penColor === color ? `3px solid ${isDark ? '#f8fafc' : '#111827'}` : `1px solid ${bd}`,
                    background:color,
                    cursor:'pointer',
                    boxShadow:penColor === color ? '0 0 0 2px rgba(96,165,250,.36)' : 'none',
                  }}
                />
              ))}
            </div>
          )}

          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:7, marginBottom:10 }}>
            {DRAW_WIDTHS.map((width) => (
              <button
                key={width}
                type="button"
                onClick={() => onPenWidthChange(width)}
                aria-pressed={penWidth === width}
                style={{
                  minHeight:36,
                  border:`1px solid ${penWidth === width ? (isDark ? 'rgba(167,139,250,.56)' : '#7c3aed') : bd}`,
                  borderRadius:11,
                  background:penWidth === width ? (isDark ? 'rgba(167,139,250,.14)' : '#f5f3ff') : 'transparent',
                  cursor:'pointer',
                }}
              >
                <span style={{ display:'block', height:drawTool === 'highlighter' ? Math.max(8, width * 1.7) : width, borderRadius:99, background:drawTool === 'eraser' ? muted : penColor, margin:'0 auto', width:'64%', opacity:drawTool === 'highlighter' ? .55 : 1 }} />
              </button>
            ))}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7 }}>
            <button
              type="button"
              onClick={onUndoStroke}
              disabled={!strokeCount}
              className="inline-flex items-center justify-center gap-1.5"
              style={{ minHeight:36, border:`1px solid ${bd}`, borderRadius:11, background:'transparent', color:muted, cursor:strokeCount?'pointer':'not-allowed', opacity:strokeCount?1:.45, fontSize:11, fontWeight:900 }}
            >
              <UndoIcon /> Undo
            </button>
            <button
              type="button"
              onClick={onClearStrokes}
              disabled={!strokeCount}
              className="inline-flex items-center justify-center gap-1.5"
              style={{ minHeight:36, border:`1px solid ${strokeCount ? 'rgba(220,38,38,.34)' : bd}`, borderRadius:11, background:strokeCount ? (isDark?'rgba(220,38,38,.1)':'#fef2f2') : 'transparent', color:strokeCount ? (isDark?'#fca5a5':'#b91c1c') : muted, cursor:strokeCount?'pointer':'not-allowed', opacity:strokeCount?1:.45, fontSize:11, fontWeight:900 }}
            >
              <TrashIcon /> Clear
            </button>
          </div>
        </div>
      )}
      <button
        className="lms-ai-note-write-fab lms-smooth-action inline-flex items-center justify-center"
        type="button"
        onClick={handleMainClick}
        aria-expanded={open}
        aria-pressed={drawMode}
        style={{
          pointerEvents:'auto',
          width:56,
          height:56,
          border:`1px solid ${drawMode ? (isDark ? 'rgba(96,165,250,.62)' : '#2563eb') : bd}`,
          borderRadius:999,
          background:drawMode ? (isDark ? 'linear-gradient(180deg,rgba(96,165,250,.28),rgba(37,99,235,.18))' : '#eff6ff') : panelBg,
          color:drawMode ? (isDark ? '#dbeafe' : '#1d4ed8') : tx,
          boxShadow:isDark ? '0 18px 42px rgba(0,0,0,.38), inset 0 1px 0 rgba(255,255,255,.12)' : '0 18px 42px rgba(15,23,42,.18)',
          cursor:'pointer',
          opacity:isEditing || drawMode ? 1 : .96,
          WebkitTapHighlightColor:'transparent',
        }}
        title="Pencil / S Pen tools"
      >
        {drawTool === 'eraser' ? <EraserIcon size={18} /> : drawTool === 'highlighter' ? <HighlighterIcon size={18} /> : <PenIcon size={18} />}
      </button>
    </div>
  );
}

const CanvasPage = memo(function CanvasPage({ pageData, index, note, topBd, isDark }) {
  const data = useMemo(() => ({
    ...pageData,
    title: pageData.title || note.title,
    subtitle: pageData.subtitle || note.courseTitle || '',
    layout: pageData.layout || '3col',
  }), [note.courseTitle, note.title, pageData]);

  return (
    <div className="lms-canvas-page">
      {index > 0 && (
        <div style={{ display:'flex', alignItems:'center', gap:14, margin:'4px 0 16px' }}>
          <div style={{ flex:1, height:1, background:topBd }}/>
          <span style={{ ...KL, border:`1px solid ${topBd}`, background:isDark?'rgba(255,255,255,.04)':'#fff', borderRadius:99, padding:'3px 14px', fontSize:11, fontWeight:600, color:isDark?'#94a3b8':'#6b7280', whiteSpace:'nowrap' }}>
            Page {index+1}{pageData.title?` · ${pageData.title}`:''}
          </span>
          <div style={{ flex:1, height:1, background:topBd }}/>
        </div>
      )}
      <NoteCanvas data={data} editable={false} />
    </div>
  );
});

function SmoothCanvasMotion() {
  return (
    <style>{`
      @keyframes lmsToastIn {
        from { opacity: 0; transform: translate3d(-50%, 10px, 0) scale(.98); }
        to { opacity: 1; transform: translate3d(-50%, 0, 0) scale(1); }
      }
      .lms-ai-canvas-shell {
        animation: none;
        transform: none;
      }
      .lms-ai-note-topbar-inner > * {
        min-width: 0;
      }
      .lms-ai-note-back-slot {
        justify-content: flex-start !important;
      }
      .lms-ai-note-back-button,
      .lms-ai-note-action-button {
        min-height: 38px;
        white-space: nowrap;
      }
      .lms-ai-note-title-block {
        min-width: 0;
        overflow: hidden;
      }
      .lms-ai-note-topbar-actions {
        min-width: 0;
      }
      .lms-ai-note-control-row {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        flex-wrap: wrap;
        margin-top: 8px;
      }
      .lms-ai-note-progress-inline {
        display: grid;
        gap: 5px;
        width: 100%;
        border: 1px solid var(--lms-ai-note-progress-border);
        background: var(--lms-ai-note-progress-bg);
        border-radius: 12px;
        padding: 7px 9px;
      }
      .lms-ai-note-page {
        padding-bottom: calc(86px + env(safe-area-inset-bottom, 0px));
      }
      .lms-ai-note-reading-dock {
        position: fixed;
        right: 0;
        bottom: 0;
        left: 0;
        z-index: 9998;
        padding: 10px 24px 0;
        pointer-events: none;
      }
      .lms-ai-note-reading-dock__inner {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 10px;
        max-width: 1680px;
        margin: 0 auto;
        border: 1px solid var(--lms-ai-note-progress-border);
        border-radius: 18px 18px 0 0;
        background: color-mix(in srgb, var(--lms-ai-note-progress-bg) 88%, transparent);
        box-shadow: 0 18px 46px rgba(15, 23, 42, 0.18);
        padding: 10px 10px calc(10px + env(safe-area-inset-bottom, 0px));
        pointer-events: auto;
        -webkit-backdrop-filter: blur(18px) saturate(1.08);
        backdrop-filter: blur(18px) saturate(1.08);
      }
      .lms-ai-note-progress-inline--floating {
        min-height: 38px;
        align-content: center;
      }
      .lms-canvas-page {
        contain: layout paint;
        content-visibility: auto;
        contain-intrinsic-size: 900px;
        opacity: 1;
        transform: none;
      }
      .lms-ai-note-page :where(.ncv-enter, .ncv-entered) {
        animation: none !important;
        opacity: 1 !important;
        transform: none !important;
      }
      .lms-ai-note-page :where(.lms-ai-canvas-editor, .lms-ai-canvas-surface, .lms-canvas-page, .ncv-item) {
        perspective: none !important;
        transform: none !important;
        transform-style: flat !important;
        filter: none !important;
      }
      .lms-ai-note-page :where(.lms-ai-canvas-surface, .ncv-item, .ncv-item > *) {
        box-shadow: none !important;
      }
      .lms-ai-note-page :where(.ncv-item, .ncv-item > *) {
        transition-property: background-color, border-color, color, opacity !important;
      }
      .lms-ai-note-page :where(.ncv-item:hover, .ncv-item:hover > *, .focus-canvas .ncv-item:hover) {
        opacity: 1 !important;
        transform: none !important;
        box-shadow: none !important;
      }
      .lms-smooth-action {
        transition: transform 180ms cubic-bezier(.16,1,.3,1), box-shadow 180ms ease, background-color 180ms ease, border-color 180ms ease, color 180ms ease, opacity 180ms ease;
      }
      .lms-smooth-action:hover:not(:disabled) {
        transform: translate3d(0, -1px, 0);
      }
      .lms-toast {
        animation: lmsToastIn 190ms cubic-bezier(.16,1,.3,1) both;
      }
      @media (max-width: 1180px) {
        .lms-ai-note-topbar-inner {
          grid-template-columns: auto minmax(0, 1fr) auto !important;
          gap: 12px !important;
        }
        .lms-ai-canvas-shell {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          align-items: start;
        }
        .lms-ai-note-main {
          grid-column: 1 / -1;
          order: 1;
        }
        .lms-ai-note-left-panel {
          order: 2;
        }
        .lms-ai-note-right-panel {
          order: 3;
        }
      }
      @media (max-width: 760px) {
        .lms-ai-note-topbar-inner {
          grid-template-columns: minmax(0, 1fr) !important;
          align-items: center !important;
          gap: 10px !important;
        }
        .lms-ai-note-topbar-actions {
          display: flex !important;
          justify-content: stretch !important;
          gap: 8px !important;
        }
        .lms-ai-note-control-row {
          gap: 7px;
        }
        .lms-ai-note-control-row > button,
        .lms-ai-note-control-row > .theme-toggle,
        .lms-ai-note-action-button {
          flex: 1 1 auto;
        }
        .lms-ai-note-page {
          padding-bottom: calc(92px + env(safe-area-inset-bottom, 0px));
        }
        .lms-ai-note-reading-dock {
          bottom: 0;
          padding: 8px 12px 0;
        }
        .lms-ai-note-reading-dock__inner {
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 8px;
          border-radius: 16px 16px 0 0;
          padding: 9px 9px calc(9px + env(safe-area-inset-bottom, 0px));
        }
        .lms-ai-note-reading-dock .lms-ai-note-action-button {
          width: auto;
          min-width: 92px;
        }
        .lms-ai-note-progress-inline--floating {
          min-width: 0;
        }
      }
      @media (max-width: 360px) {
        .lms-ai-note-reading-dock__inner {
          grid-template-columns: minmax(0, 1fr) minmax(78px, auto);
        }
        .lms-ai-note-reading-dock .lms-ai-note-action-button {
          min-width: 78px;
          padding-inline: 9px !important;
          font-size: 10.5px !important;
        }
        .lms-ai-canvas-shell {
          grid-template-columns: 1fr !important;
        }
      }
      @media (max-width: 760px) {
        .lms-ai-canvas-shell {
          grid-template-columns: 1fr !important;
        }
        .lms-ai-note-main,
        .lms-ai-note-left-panel,
        .lms-ai-note-right-panel {
          grid-column: auto;
        }
      }
      @media (max-width: 430px) {
        .lms-ai-note-topbar-inner {
          grid-template-columns: 1fr !important;
          align-items: stretch !important;
        }
        .lms-ai-note-back-button {
          justify-content: center !important;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .lms-ai-canvas-shell,
        .lms-canvas-page,
        .lms-toast {
          animation: none;
        }
        .lms-smooth-action {
          transition: none;
        }
        .lms-smooth-action:hover:not(:disabled) {
          transform: none;
        }
      }
    `}</style>
  );
}

function StickerPicker({ onPick, onClose }) {
  const r = useRef(null);
  useEffect(() => {
    const h = e => { if (r.current && !r.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, [onClose]);
  return (
    <div ref={r} className="absolute bottom-full left-0 z-50 mb-2 grid grid-cols-6 gap-1 rounded-2xl border border-gray-200 bg-white p-2.5 shadow-lg">
      {STICKERS.map((s,i) => (
        <button key={i} className="flex size-8 items-center justify-center rounded-lg border border-gray-100 text-base hover:border-violet-300 hover:bg-violet-50"
          onClick={() => { onPick(s); onClose(); }}>{s}</button>
      ))}
    </div>
  );
}

function WatchVideoModal({ open, url, onClose, isDark }) {
  if (!open || typeof document === 'undefined') return null;
  const embed = getVideoEmbed(url);
  const panelBg = isDark ? 'rgba(15,18,31,.98)' : '#ffffff';
  const line = isDark ? 'rgba(255,255,255,.10)' : '#e5e7eb';
  const muted = isDark ? 'rgba(226,232,240,.62)' : '#64748b';
  const text = isDark ? '#f8fafc' : '#334155';
  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-lg"
      style={{ zIndex: 99999 }}
      role="dialog"
      aria-modal="true"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <style>{`
        @keyframes lmsVideoDialogIn {
          from { opacity: 0; transform: translateY(-34px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      <div className="w-full max-w-4xl overflow-hidden rounded-2xl border shadow-2xl" style={{ background:panelBg, borderColor:line, animation:'lmsVideoDialogIn 220ms cubic-bezier(.16,1,.3,1) both' }}>
        <div className="flex items-center justify-between gap-3 border-b px-5 py-4" style={{ borderColor:line }}>
          <div>
            <div style={{ ...KL, fontSize:24, fontWeight:800, color:text }}>Watch lesson video</div>
            <div className="text-xs" style={{ color:muted }}>Video added by your instructor.</div>
          </div>
          <button className="inline-flex size-9 items-center justify-center rounded-full border text-sm font-black"
            type="button"
            onClick={onClose}
            style={{ borderColor:line, color:text, background:isDark?'rgba(255,255,255,.05)':'#f8fafc' }}
            aria-label="Close video popup"
          >
            ✕
          </button>
        </div>
        <div className="space-y-4 p-5">
          {url && (
            <div className="rounded-2xl border px-4 py-3 text-xs font-semibold" style={{ borderColor:line, background:isDark?'rgba(255,255,255,.05)':'#f8fafc', color:muted }}>
              Protected lesson player. Sharing, copying, and opening the source URL are disabled in this workspace.
            </div>
          )}
          <div className="aspect-video overflow-hidden rounded-xl border" style={{ borderColor:line, background:isDark?'rgba(255,255,255,.035)':'#f8fafc' }}>
            {embed?.type === 'iframe' ? (
              <div className="relative h-full w-full bg-black">
                <iframe
                  title="Protected lesson video player"
                  src={embed.src}
                  className="h-full w-full"
                  allow="autoplay; encrypted-media"
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                />
                {embed.hideTopChrome ? (
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-black"
                    aria-hidden="true"
                  />
                ) : null}
              </div>
            ) : embed?.type === 'video' ? (
              <video
                className="h-full w-full bg-black object-contain"
                controls
                controlsList="nodownload noplaybackrate"
                disablePictureInPicture
                onContextMenu={(event) => event.preventDefault()}
                src={embed.src}
              />
            ) : embed?.type === 'blocked' ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                <div style={{ ...KL, fontSize:22, color:text }}>This lesson video cannot be played securely.</div>
                <div className="max-w-sm text-xs leading-relaxed" style={{ color:muted }}>Ask your instructor to upload an embeddable protected video instead of a public link.</div>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
                <div style={{ fontSize:40 }}>🎬</div>
                <div style={{ ...KL, fontSize:20, fontWeight:800, color:text }}>No video available yet</div>
                <div className="max-w-sm text-xs leading-relaxed" style={{ color:muted }}>Your instructor hasn't added a video for this lesson yet.</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function WatchVideoPanel({ videoUrl, onOpenVideo, isDark }) {
  const bg = isDark ? '#12141f' : '#fff';
  const bd = isDark ? 'rgba(255,255,255,.09)' : '#e5e7eb';
  const muted = isDark ? 'rgba(200,210,255,.58)' : '#64748b';
  const thumb = getVideoThumbnail(videoUrl);
  return (
    <div style={{ background:bg, border:`1px solid ${bd}`, borderRadius:14, padding:10, marginBottom:12 }}>
      <button className="group relative block aspect-video w-full overflow-hidden rounded-xl border text-left shadow-[0_16px_34px_rgba(15,23,42,.12)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_44px_rgba(37,99,235,.18)]"
        type="button"
        onClick={onOpenVideo}
        style={{ borderColor:bd, opacity:videoUrl ? 1 : 0.76, cursor:'pointer', background:isDark?'linear-gradient(135deg,rgba(37,99,235,.22),rgba(124,58,237,.18),rgba(15,23,42,.96))':'linear-gradient(135deg,#eff6ff,#f5f3ff,#ffffff)' }}
      >
        {thumb && <img src={thumb} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80 transition duration-200 group-hover:scale-[1.03]" loading="lazy" decoding="async" />}
        <span className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(59,130,246,.15),transparent_36%),linear-gradient(180deg,rgba(2,6,23,.08),rgba(2,6,23,.66))]" />
        <span className="absolute left-3 top-3 rounded-full border border-white/20 bg-black/35 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white backdrop-blur">
          Watch Video
        </span>
        <span className="absolute left-1/2 top-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/35 bg-white/18 text-white shadow-[0_0_34px_rgba(59,130,246,.38)] backdrop-blur-md transition group-hover:scale-105">
          ▶
        </span>
        <span className="absolute inset-x-3 bottom-3">
          <span className="block truncate text-[13px] font-black text-white">{videoUrl ? 'Protected lesson video' : 'No video added yet'}</span>
          <span className="block text-[11px] font-semibold text-white/75">{videoUrl ? 'Click to play securely' : 'Instructor can add a protected video'}</span>
        </span>
      </button>
      <p style={{ ...KL, fontSize:11.5, lineHeight:1.45, color:muted, margin:'9px 3px 0' }}>
        {videoUrl ? 'Video plays inside the LMS without exposing the source link.' : 'Ask your instructor to add the lesson video.'}
      </p>
    </div>
  );
}

// ── Right panel ───────────────────────────────────────────────────────────────
function RightPanel({
  onStickerAdd,
  onNoteAdd,
  note,
  isDark,
  isEditing,
  videoUrl,
  onOpenVideo,
  nativeWritingEnabled,
  drawMode,
  penColor,
  penWidth,
  strokeCount,
  onToggleDraw,
  onPenColorChange,
  onPenWidthChange,
  onUndoStroke,
  onClearStrokes,
}) {
  const [stickerOpen, setStickerOpen] = useState(false);
  const navigate = useNavigate();
  const mcq = getMCQTag(note);
  const bg  = isDark?'#12141f':'#fff', bd=isDark?'rgba(255,255,255,.09)':'#e5e7eb';
  const lbl = isDark?'rgba(200,210,255,.4)':'#9ca3af';
  const C = ch => <div style={{ background:bg, border:`1px solid ${bd}`, borderRadius:16, padding:'13px 15px', marginBottom:12 }}>{ch}</div>;
  const L = t => <div style={{ fontFamily:'sans-serif', fontSize:9, fontWeight:800, letterSpacing:'0.12em', textTransform:'uppercase', color:lbl, marginBottom:9 }}>{t}</div>;
  const btnHov = (e,on) => {
    e.currentTarget.style.borderColor = on?'#a78bfa':bd;
    e.currentTarget.style.background  = on?(isDark?'rgba(167,139,250,.1)':'#f5f3ff'):(isDark?'rgba(255,255,255,.04)':'#f9fafb');
  };
  return (
    <div style={{ position:'sticky', top:72 }}>
      <WatchVideoPanel videoUrl={videoUrl} onOpenVideo={onOpenVideo} isDark={isDark} />
      {C(<>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
          <span style={{ fontSize:18 }}>🎯</span>
          <span style={{ fontSize:11, fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase', color:isDark?'#a78bfa':'#6d28d9' }}>Practice MCQ</span>
        </div>
        <span style={{ background:isDark?`${mcq.bg}18`:mcq.bg, border:`1px solid ${mcq.c}40`, color:mcq.c, borderRadius:99, padding:'2px 9px', fontSize:10, fontWeight:700, display:'inline-block', marginBottom:10 }}>{mcq.tag}</span>
        <p style={{ ...KL, fontSize:11.5, lineHeight:1.55, color:isDark?'rgba(200,210,255,.65)':'#6b7280', marginBottom:12 }}>
          Test knowledge on <strong style={{ color:isDark?'#a78bfa':'#5b21b6' }}>{note?.title||'this topic'}</strong>.
        </p>
        <button className="w-full" onClick={() => navigate('/quizzes')}
          style={{ width:'100%', background:isDark?'rgba(167,139,250,.12)':'#f5f3ff', color:isDark?'#ddd6fe':'#6d28d9', borderRadius:11, padding:'8px 0', fontSize:11, fontWeight:800, border:`1px solid ${isDark?'rgba(167,139,250,.28)':'rgba(124,58,237,.24)'}`, cursor:'pointer' }}
          onMouseEnter={e => { e.currentTarget.style.background = isDark?'rgba(167,139,250,.18)':'#ede9fe'; }}
          onMouseLeave={e => { e.currentTarget.style.background = isDark?'rgba(167,139,250,.12)':'#f5f3ff'; }}>
          Start MCQ Session →
        </button>
      </>)}
      {C(<>
        {L('Icons')}
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:12 }}>
          {ICONS_LIB.map((ic,i) => <button key={i} className="inline-flex items-center justify-center" onClick={() => onStickerAdd(ic)} title="Pin to lesson"
            style={{ width:30, height:30, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:9, border:`1px solid ${bd}`, background:isDark?'rgba(255,255,255,.04)':'#f9fafb', fontSize:14, cursor:'pointer' }}
            onMouseEnter={e => btnHov(e,true)} onMouseLeave={e => btnHov(e,false)}>{ic}</button>)}
        </div>
        {L('Decorative Elements')}
        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
          {DECOS_LIB.map((d,i) => <button key={i} className="inline-flex items-center justify-center" onClick={() => onStickerAdd(d)} title="Pin to lesson"
            style={{ width:30, height:30, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:9, border:`1px solid ${bd}`, background:isDark?'rgba(255,255,255,.04)':'#f9fafb', fontSize:14, cursor:'pointer' }}
            onMouseEnter={e => btnHov(e,true)} onMouseLeave={e => btnHov(e,false)}>{d}</button>)}
        </div>
        <div style={{ position:'relative', marginTop:8 }}>
          <button className="mb-2 w-full" onClick={onNoteAdd}
            type="button"
            style={{ width:'100%', border:`1px dashed ${bd}`, borderRadius:9, padding:'5px 0', fontSize:10, fontWeight:700, color:isDark?'#f59e0b':'#92400e', background:isDark?'rgba(245,158,11,.08)':'#fffbeb', cursor:'pointer' }}
          >
            📝 Add sticky note
          </button>
          <button className="w-full" onClick={() => setStickerOpen(v => !v)}
            style={{ width:'100%', border:`1px dashed ${bd}`, borderRadius:9, padding:'5px 0', fontSize:10, fontWeight:600, color:lbl, background:'transparent', cursor:'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor='#a78bfa'; e.currentTarget.style.color='#7c3aed'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor=bd; e.currentTarget.style.color=lbl; }}>
            ✨ More stickers…
          </button>
          {stickerOpen && <StickerPicker onPick={onStickerAdd} onClose={() => setStickerOpen(false)} />}
        </div>
      </>)}
      {nativeWritingEnabled && C(<>
        {L('Pencil / S Pen')}
        <button
          className="mb-3 inline-flex w-full items-center justify-center gap-2"
          type="button"
          onClick={onToggleDraw}
          disabled={!isEditing}
          aria-pressed={drawMode}
          style={{
            minHeight:42,
            border:`1px solid ${drawMode ? (isDark ? 'rgba(96,165,250,.45)' : '#2563eb') : bd}`,
            borderRadius:12,
            background:drawMode ? (isDark ? 'rgba(96,165,250,.16)' : '#eff6ff') : (isDark?'rgba(255,255,255,.04)':'#f9fafb'),
            color:drawMode ? (isDark ? '#bfdbfe' : '#1d4ed8') : (isDark?'rgba(226,232,240,.86)':'#374151'),
            cursor:isEditing ? 'pointer' : 'not-allowed',
            opacity:isEditing ? 1 : 0.55,
            fontSize:12,
            fontWeight:900,
          }}
        >
          <PenIcon />
          {drawMode ? 'Pencil / S Pen On' : 'Use Pencil / S Pen'}
        </button>
        <div style={{ display:'grid', gap:10 }}>
          <div>
            <div style={{ fontFamily:'sans-serif', fontSize:10, fontWeight:800, color:lbl, marginBottom:6 }}>Pen color</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
              {DRAW_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => onPenColorChange(color)}
                  aria-label={`Use pen color ${color}`}
                  aria-pressed={penColor === color}
                  style={{
                    width:30,
                    height:30,
                    borderRadius:9,
                    border:penColor === color ? `3px solid ${isDark ? '#f8fafc' : '#111827'}` : `1px solid ${bd}`,
                    background:color,
                    cursor:'pointer',
                    boxShadow:penColor === color ? '0 0 0 2px rgba(96,165,250,.35)' : 'none',
                  }}
                />
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontFamily:'sans-serif', fontSize:10, fontWeight:800, color:lbl, marginBottom:6 }}>Pen width</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6 }}>
              {DRAW_WIDTHS.map((width) => (
                <button
                  key={width}
                  type="button"
                  onClick={() => onPenWidthChange(width)}
                  aria-pressed={penWidth === width}
                  style={{
                    minHeight:34,
                    border:`1px solid ${penWidth === width ? (isDark ? 'rgba(167,139,250,.5)' : '#7c3aed') : bd}`,
                    borderRadius:10,
                    background:penWidth === width ? (isDark ? 'rgba(167,139,250,.14)' : '#f5f3ff') : 'transparent',
                    cursor:'pointer',
                  }}
                >
                  <span style={{ display:'block', height:width, borderRadius:99, background:penColor, margin:'0 auto', width:'68%' }} />
                </button>
              ))}
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7 }}>
            <button
              type="button"
              onClick={onUndoStroke}
              disabled={!strokeCount}
              className="inline-flex items-center justify-center gap-1.5"
              style={{ minHeight:36, border:`1px solid ${bd}`, borderRadius:10, background:'transparent', color:isDark?'rgba(226,232,240,.82)':'#475569', cursor:strokeCount?'pointer':'not-allowed', opacity:strokeCount?1:.45, fontSize:11, fontWeight:800 }}
            >
              <UndoIcon /> Undo
            </button>
            <button
              type="button"
              onClick={onClearStrokes}
              disabled={!strokeCount}
              className="inline-flex items-center justify-center gap-1.5"
              style={{ minHeight:36, border:`1px solid ${strokeCount ? 'rgba(220,38,38,.32)' : bd}`, borderRadius:10, background:strokeCount ? (isDark?'rgba(220,38,38,.09)':'#fef2f2') : 'transparent', color:strokeCount ? (isDark?'#fca5a5':'#b91c1c') : lbl, cursor:strokeCount?'pointer':'not-allowed', opacity:strokeCount?1:.45, fontSize:11, fontWeight:800 }}
            >
              <TrashIcon /> Clear
            </button>
          </div>
        </div>
      </>)}
      <div style={{ borderRadius:16, border:isDark?'1px solid rgba(251,191,36,.2)':'1px solid #fde68a', background:isDark?'rgba(251,191,36,.05)':'#fffbeb', padding:'13px 15px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:5 }}>
          <span>💡</span>
          <span style={{ fontSize:9, fontWeight:800, letterSpacing:'0.12em', textTransform:'uppercase', color:isDark?'#fbbf24':'#92400e', fontFamily:'sans-serif' }}>Revision Tip</span>
        </div>
        <p style={{ ...KL, fontSize:11.5, lineHeight:1.6, color:isDark?'#fde68a':'#78350f', margin:0 }}>
          {nativeWritingEnabled
            ? (isEditing
              ? 'Personalize mode lets you move stickers, write sticky notes, and draw on the lesson with Apple Pencil or S Pen. The instructor lesson stays protected.'
              : 'Use Personalize when you want to pin icons, add notes, or write on the lesson canvas with Apple Pencil or S Pen.')
            : (isEditing
              ? 'Personalize mode lets you move stickers and write your own sticky notes. The instructor lesson stays protected.'
              : 'Use Personalize when you want to pin icons or add your own sticky notes.')}
        </p>
      </div>
    </div>
  );
}

const MemoRightPanel = memo(RightPanel);

// ── Canvas card grid (one page) ───────────────────────────────────────────────
// ── Helpers ───────────────────────────────────────────────────────────────────
function normalizeNoteData(raw) {
  if (!raw) return null;
  if (raw.pages && Array.isArray(raw.pages)) return raw;
  return { pages: [raw] };
}
function cleanCanvasLabel(value, fallback = '') {
  const text = String(value || '').trim();
  if (!text) return fallback;
  const parts = text
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !/^(lms|study|lesson|lessons|ai-notes|canvas|canvases|\d+)$/i.test(part));
  return parts.length ? parts[parts.length - 1] : text;
}
function BackIcon()     { return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M9.5 3.5l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
// ── Main page ─────────────────────────────────────────────────────────────────
export function AiNotesPage({ engineKey='gemini', headerTitle='Lesson', backLabel='Lessons' }) {
  const { id, lessonId } = useParams();
  const navigate  = useNavigate();
  const location  = useLocation();
  const isDark    = useDark();
  const platform  = useMemo(() => detectPlatform(), []);
  const pageRef   = useRef(null);
  const canvasRef = useRef(null);

  const [note,      setNote]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [localData, setLocalData] = useState(null);
  const [stickers,  setStickers]  = useState([]);
  const [strokes,   setStrokes]   = useState([]);
  const [toast,     setToast]     = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [drawMode,  setDrawMode]  = useState(false);
  const [drawTool,  setDrawTool]  = useState('pen');
  const [penColor,  setPenColor]  = useState(DRAW_COLORS[1]);
  const [penWidth,  setPenWidth]  = useState(DRAW_WIDTHS[1]);
  const [soundMode, setSoundMode] = useState(() => {
    if (typeof window === 'undefined') return 'spen';
    return normalizeDrawingSoundMode(window.localStorage?.getItem(DRAWING_SOUND_STORAGE_KEY));
  });
  const [videoUrl,  setVideoUrl]  = useState('');
  const [videoOpen, setVideoOpen] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);
  const [lessonCompleted, setLessonCompleted] = useState(false);
  const [completionBusy, setCompletionBusy] = useState(false);
  const sidRef = useRef(0);
  const saveTimerRef = useRef(null);

  const nativeWritingEnabled = true;
  const notify = msg => { setToast(msg); setTimeout(() => setToast(null), 2200); };
  const updateSoundMode = useCallback((mode) => {
    const next = normalizeDrawingSoundMode(mode);
    setSoundMode(next);
    try {
      window.localStorage?.setItem(DRAWING_SOUND_STORAGE_KEY, next);
    } catch {
      // Preference persistence is optional.
    }
  }, []);
  const toggleEditing = useCallback(() => {
    setIsEditing(v => {
      const next = !v;
      if (!next) setDrawMode(false);
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (lessonId ? getLessonAiNote(Number(lessonId),{engine:engineKey}) : getAiNote(Number(id),{engine:engineKey}))
      .then(data => { if (!cancelled) {
        const baseData = normalizeNoteData(data.noteData);
        setNote(data);
        setLocalData(baseData);
        setVideoUrl(data.videoUrl || '');
        setLessonCompleted(Boolean(
          data.lessonCompleted ||
          data.lessonProgressStatus === 'completed' ||
          Number(data.lessonProgressPercent || 0) >= 100
        ));
      }
        recordStudyActivity({ activityType:'ai_note_viewed', itemId:Number(data.id||id||lessonId) }).catch(()=>{});
      })
      .catch(e => { if (!cancelled) setError(getErrorMessage(e,'Failed to load lesson.')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [engineKey, id, lessonId]);

  useEffect(() => {
    let frame = 0;
    const getScrollCandidates = () => {
      const pageNode = pageRef.current;
      const candidates = [
        document.scrollingElement,
        document.documentElement,
        document.body,
        document.querySelector('.lms-app-scroll-root'),
        document.querySelector('.portal-content'),
        document.querySelector('.portal-content__frame'),
        document.querySelector('.app-content'),
        document.querySelector('.page-content'),
      ].filter(Boolean);

      return Array.from(new Set(candidates)).filter((element) => {
        if (element === document.body || element === document.documentElement || element === document.scrollingElement) {
          return true;
        }
        return !pageNode || element.contains(pageNode) || pageNode.contains(element);
      });
    };

    const getScrollState = () => {
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 1;
      const states = getScrollCandidates().map((element) => {
        const isDocument = element === document.body || element === document.documentElement || element === document.scrollingElement;
        const scrollTop = isDocument
          ? (window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0)
          : element.scrollTop;
        const scrollHeight = isDocument
          ? Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)
          : element.scrollHeight;
        const clientHeight = isDocument ? viewportHeight : element.clientHeight;
        return {
          element,
          scrollTop: Math.max(0, scrollTop || 0),
          scrollMax: Math.max(0, (scrollHeight || 0) - (clientHeight || 0)),
        };
      });

      return states.reduce((best, state) => (state.scrollMax > best.scrollMax ? state : best), {
        element: document.scrollingElement || document.documentElement,
        scrollTop: 0,
        scrollMax: 0,
      });
    };

    function updateProgress() {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const { scrollTop, scrollMax } = getScrollState();
        const nextProgress = scrollMax <= 0 ? 0 : Math.round((scrollTop / scrollMax) * 100);
        setReadingProgress(Math.min(100, Math.max(0, nextProgress)));
      });
    }
    updateProgress();
    const appScrollers = getScrollCandidates();
    window.addEventListener('scroll', updateProgress, { passive: true });
    window.addEventListener('resize', updateProgress);
    appScrollers.forEach((element) => element.addEventListener('scroll', updateProgress, { passive: true }));
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', updateProgress);
      window.removeEventListener('resize', updateProgress);
      appScrollers.forEach((element) => element.removeEventListener('scroll', updateProgress));
    };
  }, [note?.id, localData?.pages?.length]);

  useEffect(() => {
    const key = studentCanvasPersonalStorageKey(note?.id || id || lessonId);
    if (!key || typeof window === 'undefined') return;
    try {
      const saved = window.localStorage.getItem(key);
      const personalLayer = normalizePersonalLayer(saved ? JSON.parse(saved) : null);
      setStickers(personalLayer.stickers);
      setStrokes(personalLayer.strokes);
    } catch {
      setStickers([]);
      setStrokes([]);
    }
  }, [id, lessonId, nativeWritingEnabled, note?.id]);

  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
  }, []);

  const savePersonalItems = useCallback((nextLayer) => {
    const key = studentCanvasPersonalStorageKey(note?.id || id || lessonId);
    if (!key || typeof window === 'undefined') return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const write = () => {
        try { window.localStorage.setItem(key, JSON.stringify(nextLayer)); } catch { /* personal overlay is optional */ }
      };
      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(write, { timeout:800 });
      } else {
        write();
      }
    }, 120);
  }, [id, lessonId, note?.id]);

  function handleBack() { if (location.state?.returnToPath) { navigate(location.state.returnToPath); return; } navigate(-1); }

  const addSticker    = useCallback(emoji => {
    if (!isEditing) {
      notify('Click Personalize first');
      return;
    }
    setStickers(ss => {
      const next = [...ss, { id:`st${++sidRef.current}`, type:'emoji', emoji, x:40+Math.random()*160, y:40+Math.random()*80, r:Math.round(Math.random()*16-8) }];
      savePersonalItems({ stickers:next, strokes });
      return next;
    });
    notify(`${emoji} pinned`);
  }, [isEditing, savePersonalItems, strokes]);
  const addStickyNote = useCallback(() => {
    if (!isEditing) {
      notify('Click Personalize first to add sticky notes');
      return;
    }
    setStickers(ss => {
      const next = [...ss, { id:`st${++sidRef.current}`, type:'note', text:'My note', x:54+Math.random()*130, y:70+Math.random()*90, r:Math.round(Math.random()*8-4), w:180, h:96 }];
      savePersonalItems({ stickers:next, strokes });
      return next;
    });
    notify('Sticky note added');
  }, [isEditing, savePersonalItems, strokes]);
  const updateSticker = useCallback(upd => setStickers(ss => {
    const next = ss.map(s => s.id===upd.id?upd:s);
    savePersonalItems({ stickers:next, strokes });
    return next;
  }), [savePersonalItems, strokes]);
  const deleteSticker = useCallback(sid => setStickers(ss => {
    const next = ss.filter(s => s.id!==sid);
    savePersonalItems({ stickers:next, strokes });
    return next;
  }), [savePersonalItems, strokes]);
  const commitStroke = useCallback((stroke) => {
    if (!nativeWritingEnabled) return;
    setStrokes(current => {
      const next = [...current, stroke].slice(-250);
      savePersonalItems({ stickers, strokes:next });
      return next;
    });
  }, [nativeWritingEnabled, savePersonalItems, stickers]);
  const undoStroke = useCallback(() => {
    setStrokes(current => {
      const next = current.slice(0, -1);
      savePersonalItems({ stickers, strokes:next });
      return next;
    });
  }, [savePersonalItems, stickers]);
  const clearStrokes = useCallback(() => {
    setStrokes([]);
    savePersonalItems({ stickers, strokes:[] });
    notify('Canvas writing cleared');
  }, [savePersonalItems, stickers]);
  const toggleDrawMode = useCallback(() => {
    if (!nativeWritingEnabled) return;
    if (!isEditing) {
      notify('Click Personalize first');
      return;
    }
    setDrawMode(value => !value);
  }, [isEditing, nativeWritingEnabled]);
  const openVideo = useCallback(() => {
    setVideoOpen(true);
  }, []);
  const markLessonComplete = useCallback(async () => {
    const resolvedLessonId = Number(note?.lessonId || location.state?.lessonId || lessonId || 0);
    setCompletionBusy(true);
    try {
      if (!resolvedLessonId) {
        throw new Error('This lesson is not linked to a course lesson yet.');
      }
      await updateStudentLessonProgress(resolvedLessonId, { status: 'completed', progressPercent: 100 });
      setNote((current) => current ? {
        ...current,
        lessonCompleted: true,
        lessonProgressStatus: 'completed',
        lessonProgressPercent: 100,
      } : current);
      setLessonCompleted(true);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('lms:lesson-progress-updated', {
          detail: {
            lessonId: resolvedLessonId,
            aiNoteId: Number(note?.id || id || 0),
            status: 'completed',
            progressPercent: 100,
          },
        }));
      }
      notify('Lesson marked complete');
    } catch (completeError) {
      notify(getErrorMessage(completeError, 'Unable to mark lesson complete'));
    } finally {
      setCompletionBusy(false);
    }
  }, [id, lessonId, location.state?.lessonId, note?.id, note?.lessonId]);

  const pageBg = 'var(--sa-bg, #eff1fb)';
  const topBg  = isDark?'rgba(5,7,13,.86)':'rgba(255,255,255,.96)';
  const topBd  = isDark?'rgba(145,170,255,.16)':'#e5e7eb';
  const btnBg  = isDark?'linear-gradient(180deg,rgba(255,255,255,.09),rgba(255,255,255,.045))':'#f9fafb';
  const btnBd  = isDark?'rgba(145,170,255,.18)':'#e5e7eb';
  const btnTx  = isDark?'rgba(230,238,255,.84)':'#374151';
  const lessonButtonShadow = isDark
    ? 'inset 0 1px 0 rgba(255,255,255,.08), 0 8px 22px rgba(0,0,0,.18)'
    : 'none';
  const progressPanelStyle = {
    '--lms-ai-note-progress-border': topBd,
    '--lms-ai-note-progress-bg': isDark ? 'rgba(15,20,36,.5)' : 'rgba(255,255,255,.72)',
  };
  const progressTrackStyle = {
    height: 4,
    overflow: 'hidden',
    borderRadius: 999,
    background: isDark ? 'rgba(148,163,184,.16)' : 'rgba(148,163,184,.2)',
  };
  const markCompleteStyle = {
    minHeight: 38,
    border: `1px solid ${lessonCompleted ? '#10b98155' : '#2563eb55'}`,
    background: lessonCompleted ? '#10b98122' : (isDark ? 'rgba(96,165,250,.14)' : '#eff6ff'),
    color: lessonCompleted ? (isDark ? '#a7f3d0' : '#047857') : (isDark ? '#bfdbfe' : '#1d4ed8'),
    borderRadius: 12,
    padding: '0 12px',
    fontSize: 11,
    fontWeight: 900,
    cursor: lessonCompleted ? 'default' : 'pointer',
    opacity: completionBusy ? 0.7 : 1,
    whiteSpace: 'nowrap',
    boxShadow: lessonButtonShadow,
  };

  if (loading) return (
    <main style={{ minHeight:'100dvh', background:pageBg }}>
      <div className="mx-auto grid max-w-[1400px] grid-cols-[minmax(0,1fr)_280px] gap-5 px-6 py-5 max-[1180px]:grid-cols-1 max-[1180px]:px-4 max-[520px]:px-3">
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10, alignItems:'start' }}>
          {[1,2,3,4,5,6].map((i,j) => <div key={i} className="animate-pulse" style={{ height:[220,160,200,180,240,140][j], borderRadius:16, background:isDark?'#1a1d2e':'#e5e7eb', gridColumn:j===0?'1/-1':'span 1' }}/>)}
        </div>
        <div className="animate-pulse" style={{ height:320, borderRadius:16, background:isDark?'#1a1d2e':'#e5e7eb' }}/>
      </div>
    </main>
  );

  if (error) return (
    <main style={{ minHeight:'100dvh', background:pageBg, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:48, marginBottom:16 }}>⚠️</div>
        <p style={{ fontSize:14, color:isDark?'#94a3b8':'#6b7280', marginBottom:16 }}>{error}</p>
        <button className="inline-flex items-center justify-center" onClick={handleBack} style={{ border:`1px solid ${btnBd}`, background:btnBg, borderRadius:12, padding:'8px 18px', fontSize:12, fontWeight:600, color:btnTx, cursor:'pointer' }}>Go back</button>
      </div>
    </main>
  );

  if (!note) return null;

  const isLocked = Boolean(note.accessLocked);
  const pages    = localData?.pages || [];
  const canEdit  = isEditing && !isLocked;
  const canDraw  = nativeWritingEnabled && canEdit;
  const canvasTitle = cleanCanvasLabel(note.lessonTitle || note.title, 'Lesson');
  const canvasContext = [
    cleanCanvasLabel(note.courseTitle),
    cleanCanvasLabel(note.topicName),
    cleanCanvasLabel(note.subtopicName),
  ].filter(Boolean).join(' / ');

  return (
    <main
      ref={pageRef}
      className={cx('lms-ai-note-page select-text [-webkit-user-select:text]', drawMode && canDraw && 'is-writing-mode')}
      style={{ minHeight:'100dvh', background:pageBg }}
    >
      <SmoothCanvasMotion />
      {/* Top bar */}
      <div className="lms-ai-note-topbar" style={{ position:'relative', zIndex:40, background:topBg, borderBottom:`1px solid ${topBd}` }}>
        <div className="lms-ai-note-topbar-inner" style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr)', alignItems:'center', gap:10, maxWidth:1680, margin:'0 auto', padding:'calc(10px + env(safe-area-inset-top, 0px)) 24px 12px' }}>
          <div className="lms-ai-note-title-block" style={{ minWidth:0, overflow:'hidden' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
              <div style={{ ...KL, minWidth:0, fontSize:16, fontWeight:700, color:isDark?'#f0f4ff':'#374151', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{canvasTitle}</div>
              {note.isFree ? (
                <span style={{ flexShrink:0, border:'1px solid rgba(16,185,129,.25)', background:'rgba(16,185,129,.12)', color:isDark?'#86efac':'#047857', borderRadius:999, padding:'2px 8px', fontSize:10, fontWeight:900, textTransform:'uppercase' }}>
                  Free lesson
                </span>
              ) : null}
            </div>
            {canvasContext && <div style={{ fontSize:11, color:isDark?'rgba(200,210,255,.45)':'#9ca3af', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{canvasContext}</div>}
            <div className="lms-ai-note-control-row">
              <button className="lms-ai-note-back-button lms-smooth-action inline-flex items-center justify-center" onClick={handleBack} style={{ display:'flex', alignItems:'center', gap:6, border:`1px solid ${btnBd}`, background:btnBg, borderRadius:12, padding:'0 12px', fontSize:12, fontWeight:700, color:btnTx, cursor:'pointer', flexShrink:0, boxShadow:lessonButtonShadow }}>
                <BackIcon/> Lessons
              </button>
              <ThemeToggle />
              <button className="lms-ai-note-action-button lms-smooth-action inline-flex items-center justify-center"
                onClick={() => navigate(`/flashcards?noteId=${note.id || id || lessonId}`)}
                disabled={isLocked}
                style={{ display:'flex', alignItems:'center', gap:6, border:`1px solid ${btnBd}`, background:btnBg, borderRadius:12, padding:'0 12px', fontSize:11, fontWeight:800, color:btnTx, cursor:'pointer', opacity:isLocked ? 0.4 : 1, boxShadow:lessonButtonShadow }}>
                Flashcards
              </button>
              <button className="lms-ai-note-action-button lms-smooth-action inline-flex items-center justify-center"
                onClick={toggleEditing}
                disabled={isLocked}
                style={{
                  display:'flex',
                  alignItems:'center',
                  gap:6,
                  border:`1px solid ${isEditing ? (isDark ? 'rgba(167,139,250,.42)' : '#7c3aed') : btnBd}`,
                  background:isEditing ? (isDark ? 'linear-gradient(180deg,rgba(167,139,250,.22),rgba(96,165,250,.10))' : '#f5f3ff') : btnBg,
                  borderRadius:12,
                  padding:'0 12px',
                  fontSize:11,
                  fontWeight:800,
                  color:isEditing ? (isDark ? '#ddd6fe' : '#6d28d9') : btnTx,
                  cursor:'pointer',
                  opacity:isLocked ? 0.4 : 1,
                  boxShadow:isEditing && isDark ? '0 10px 24px rgba(88,28,135,.18), inset 0 1px 0 rgba(255,255,255,.12)' : lessonButtonShadow,
                }}
              >
                {isEditing ? 'Done' : 'Personalize'}
              </button>
              {nativeWritingEnabled && (
                <button className="lms-ai-note-action-button lms-smooth-action inline-flex items-center justify-center"
                  onClick={() => {
                    if (!isEditing) {
                      setIsEditing(true);
                      setDrawMode(true);
                      return;
                    }
                    setDrawMode(value => !value);
                  }}
                  disabled={isLocked}
                  aria-pressed={drawMode}
                  style={{
                    display:'flex',
                    alignItems:'center',
                    gap:6,
                    border:`1px solid ${drawMode ? (isDark ? 'rgba(96,165,250,.46)' : '#2563eb') : btnBd}`,
                    background:drawMode ? (isDark ? 'rgba(96,165,250,.16)' : '#eff6ff') : btnBg,
                    borderRadius:12,
                    padding:'0 12px',
                    fontSize:11,
                    fontWeight:900,
                    color:drawMode ? (isDark ? '#bfdbfe' : '#1d4ed8') : btnTx,
                    cursor:'pointer',
                    opacity:isLocked ? 0.4 : 1,
                    boxShadow:drawMode && isDark ? '0 10px 24px rgba(37,99,235,.16), inset 0 1px 0 rgba(255,255,255,.12)' : lessonButtonShadow,
                  }}
                >
                  <PenIcon /> {drawMode ? 'Stop Pen' : 'Pencil / S Pen'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {!isLocked && pages.length > 0 && typeof document !== 'undefined' ? createPortal(
        <div className="lms-ai-note-reading-dock" style={progressPanelStyle}>
          <div className="lms-ai-note-reading-dock__inner">
            <div className="lms-ai-note-progress-inline lms-ai-note-progress-inline--floating">
              <div
                aria-label={`Reading progress ${readingProgress}%`}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={readingProgress}
                role="progressbar"
                style={progressTrackStyle}
              >
                <span style={{ display:'block', width:`${readingProgress}%`, height:'100%', borderRadius:'inherit', background:'linear-gradient(90deg,#3b82f6,#6d35df)', transition:'width 120ms linear' }} />
              </div>
            </div>
            <button className="lms-ai-note-action-button lms-smooth-action inline-flex items-center justify-center" type="button" onClick={markLessonComplete} disabled={completionBusy || lessonCompleted} style={markCompleteStyle}>
              {completionBusy ? 'Saving...' : lessonCompleted ? 'Done' : 'Mark Complete'}
            </button>
          </div>
        </div>,
        document.body
      ) : null}

      {!isLocked && nativeWritingEnabled && typeof document !== 'undefined' ? createPortal(
        <FloatingWritingPalette
          isDark={isDark}
          isEditing={isEditing}
          drawMode={drawMode}
          drawTool={drawTool}
          penColor={penColor}
          penWidth={penWidth}
          soundMode={soundMode}
          strokeCount={strokes.length}
          onActivate={() => {
            if (!isEditing) setIsEditing(true);
            setDrawMode(true);
          }}
          onToolChange={(tool) => {
            setDrawTool(tool);
            if (tool === 'highlighter' && !HIGHLIGHT_COLORS.includes(penColor)) setPenColor(HIGHLIGHT_COLORS[0]);
            if (tool === 'pen' && HIGHLIGHT_COLORS.includes(penColor)) setPenColor(DRAW_COLORS[1]);
          }}
          onPenColorChange={setPenColor}
          onPenWidthChange={setPenWidth}
          onSoundModeChange={updateSoundMode}
          onUndoStroke={undoStroke}
          onClearStrokes={clearStrokes}
        />,
        document.body
      ) : null}

      {/* Body */}
      <div className="lms-ai-canvas-shell mx-auto grid max-w-[1400px] grid-cols-[minmax(0,1fr)_280px] gap-5 px-6 py-5 max-[1180px]:px-4 max-[640px]:px-0 max-[520px]:gap-3">
        <section className="lms-ai-note-main min-w-0">
          <div ref={canvasRef} style={{ position:'relative', minWidth:0, maxWidth:'100%' }}>
            {nativeWritingEnabled && (
              <PersonalDrawingLayer
                parentRef={canvasRef}
                editable={canDraw}
                drawMode={drawMode}
                drawTool={drawTool}
                strokes={strokes}
                penColor={penColor}
                penWidth={penWidth}
                soundMode={soundMode}
                stylusOnly
                onCommitStroke={commitStroke}
              />
            )}
            {stickers.map(s => <FloatingSticker key={s.id} s={s} editable={canEdit} onUpdate={updateSticker} onDelete={deleteSticker} canvasRef={canvasRef}/>)}

            {isLocked ? (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, minHeight:400, borderRadius:20, border:`1.5px dashed ${topBd}`, background:isDark?'rgba(255,255,255,.02)':'#fff', padding:48, textAlign:'center' }}>
                <span style={{ color:isDark?'#93c5fd':'#2563eb' }}><LockIcon /></span>
                <div style={{ fontSize:15, fontWeight:800, color:isDark?'#f0f4ff':'#374151' }}>{note.upgradeLabel||'Plan access needed'}</div>
                <div style={{ fontSize:13, color:isDark?'#94a3b8':'#6b7280' }}>{note.lockReason||'This lesson is included with selected subscriptions.'}</div>
                <button className="inline-flex items-center justify-center" onClick={() => navigate('/subscriptions',{state:{from:location.pathname}})}
                  style={{ background:isDark?'rgba(167,139,250,.14)':'#f5f3ff', color:isDark?'#ddd6fe':'#6d28d9', borderRadius:12, padding:'10px 20px', fontSize:12, fontWeight:800, border:`1px solid ${isDark?'rgba(167,139,250,.28)':'rgba(124,58,237,.24)'}`, cursor:'pointer' }}>View access options</button>
              </div>
            ) : pages.length > 0 ? (
              <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
                {pages.map((pageData, i) => (
                  <CanvasPage
                    key={pageData.id || pageData.title || i}
                    pageData={pageData}
                    index={i}
                    note={note}
                    topBd={topBd}
                    isDark={isDark}
                  />
                ))}
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, minHeight:400, borderRadius:20, border:`1.5px dashed ${topBd}`, background:isDark?'rgba(255,255,255,.02)':'#fff', textAlign:'center' }}>
                <span style={{ fontSize:48 }}>📋</span>
                <div style={{ fontSize:14, fontWeight:600, color:isDark?'#94a3b8':'#6b7280' }}>Lesson not yet published</div>
                <div style={{ fontSize:12, color:isDark?'#64748b':'#9ca3af' }}>This lesson is being prepared by your instructor.</div>
              </div>
            )}
          </div>
        </section>
        <aside className="lms-ai-note-right-panel min-w-0">
          <MemoRightPanel
            onStickerAdd={addSticker}
            note={note}
            isDark={isDark}
            isEditing={canEdit}
            videoUrl={videoUrl}
            onNoteAdd={addStickyNote}
            onOpenVideo={openVideo}
            nativeWritingEnabled={nativeWritingEnabled}
            drawMode={drawMode}
            penColor={penColor}
            penWidth={penWidth}
            strokeCount={strokes.length}
            onToggleDraw={toggleDrawMode}
            onPenColorChange={setPenColor}
            onPenWidthChange={setPenWidth}
            onUndoStroke={undoStroke}
            onClearStrokes={clearStrokes}
          />
        </aside>
      </div>

      <WatchVideoModal
        open={videoOpen}
        url={videoUrl}
        onClose={() => setVideoOpen(false)}
        isDark={isDark}
      />

      {toast && (
        <div className="lms-toast" style={{ position:'fixed', bottom:20, left:'50%', transform:'translateX(-50%)', zIndex:50 }}>
          <div style={{ ...KL, display:'flex', alignItems:'center', gap:8, border:`1px solid ${topBd}`, background:isDark?'#1a1d2e':'#fff', borderRadius:16, padding:'10px 20px', fontSize:13, fontWeight:600, color:isDark?'#f0f4ff':'#374151', boxShadow:'0 8px 32px rgba(0,0,0,.15)' }}>{toast}</div>
        </div>
      )}

    </main>
  );
}
