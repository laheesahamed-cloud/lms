import { memo, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import './ai-notes-inline.css';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getAiNoteWithFallback, getLessonAiNoteWithFallback } from '../../../../shared/api/aiNotes.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { recordStudyActivity } from '../../../../shared/api/dashboard.api.js';
import { updateStudentLessonProgress } from '../../../../shared/api/courses.api.js';
import { getVideoEmbed } from '../../../../shared/utils/videoEmbed.js';
import { detectPlatform } from '../../../../shared/platform/detect.js';
import { safeNavigateBack } from '../../../../shared/routing/safeBack.js';
import { ThemeToggle } from '../../../../shared/layout/ThemeToggle.jsx';
import { cx } from '../../../../shared/styles/tailwindClasses.js';
import { NoteCanvas } from './NoteCanvas.jsx';

let drawingAudioContext = null;
let lastDrawingSoundAt = 0;
let activeDrawingSound = null;
let spenLoopBuffers = null;
const SECRET_STUDY_EFFECTS = ['fart', 'dog', 'cat', 'boing', 'squeak'];
const EMPTY_CANVAS_PAGES = [];
const OFFLINE_NOTE_CACHE_PREFIX = 'lms.aiNotes.offline.note.';
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
    postNativeDrawingSound('modulate', soundMode, soundMode === 'secret' ? volume : volume * 1.72, true, { rate, brightness, roughness, wavePulse });
    return;
  }
  try {
    const now = sound.context.currentTime;
    const responseTime = 0.007 - veryFastWriting * 0.003;
    sound.gain.gain.setTargetAtTime(volume * (0.32 + soundVerticalStroke * 0.045), now, responseTime);
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
      const textureVolume = 0.017 * clampNumber(movement + directionChange * (0.24 - smallHandwriting * 0.08 - minimalStroke * 0.05) + slowWriting * 0.18 + smallHandwriting * 0.16 + smallAverageHandwriting * 0.18 + smallFastHandwriting * 0.2 + minimalStraightHandwriting * 0.04 + veryFastWriting * 0.22 + soundVerticalStroke * 0.3 + soundVerticalDrag * 0.38 - minimalHorizontalHandwriting * 0.04, 0, 1);
      sound.textureGain.gain.setTargetAtTime(textureVolume, now, responseTime);
      sound.textureFilter.frequency.setTargetAtTime(brightness * (1.54 + fastWriting * 0.25 + soundVerticalStroke * 0.14 + soundVerticalDrag * 0.18 - smallHandwriting * 0.12 - minimalHorizontalHandwriting * 0.05) + 220, now, responseTime);
      sound.textureFilter.Q.setTargetAtTime(0.7 + roughness * (1.56 - veryFastWriting * 0.42) + soundVerticalStroke * 0.16 + soundVerticalDrag * 0.22 - minimalHorizontalHandwriting * 0.04, now, responseTime);
      sound.textureSource.playbackRate.setTargetAtTime(0.72 + speed * 0.36 + fastWriting * 0.22 + veryFastWriting * 0.2 + soundVerticalStroke * 0.14 + soundVerticalDrag * 0.22 + compactCurve * 0.14 + wavePulse * (0.22 - minimalStroke * 0.05), now, responseTime);
      sound.textureSource.detune?.setTargetAtTime?.((segmentTexture - 0.5) * (110 - minimalStroke * 24) + directionChange * (56 + fastWriting * 52 - smallHandwriting * 16 - minimalStroke * 12) + soundVerticalStroke * 34 + soundVerticalDrag * 62, now, responseTime);
    }
    if (sound.verticalGain && sound.verticalFilter && sound.verticalSource) {
      const verticalVolume = 0.074 * clampNumber(soundVerticalDrag * (0.68 + speed * 0.46) + soundVerticalStroke * (0.14 + fastWriting * 0.18) + minimalVerticalHandwriting * 0.26 + smallFastHandwriting * verticalStroke * 0.2, 0, 1);
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
      postNativeDrawingSound('start', soundMode, soundMode === 'secret' ? 0.26 : 0.24, true);
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
    gain.gain.linearRampToValueAtTime(0.009, context.currentTime + 0.008);
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
    const ob = new MutationObserver(() => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark';
      setD((current) => (current === next ? current : next));
    });
    ob.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => ob.disconnect();
  }, []);
  return d;
}

function WebViewLayer({ enabled, children }) {
  if (!enabled || typeof document === 'undefined') return children;
  return createPortal(children, document.body);
}

const ICONS_LIB = ['☆','💡','📚','🌿','📅','🏷️','💬','✅','⚠️','❓','🔄','📌','🩺','💊','🧬','🔬'];
const DECOS_LIB = ['✦','✧','♡','☁','〰','🌿','🍃','✿','✾','❋','◆','◇'];
const DRAW_COLORS = ['#1f2937', '#2563eb', '#7c3aed', '#dc2626', '#047857', '#f59e0b'];
const DRAW_WIDTHS = [3, 5, 8];
const HIGHLIGHT_COLORS = ['#fde047', '#86efac', '#93c5fd', '#f0abfc'];

// Real sticky-note paper colors (classic Post-it palette). Each note picks one.
const STICKY_NOTE_COLORS = [
  { key:'yellow', bg:'#fff59d', bg2:'#ffe97a', edge:'#f6dd5b', ink:'#5a4a10', tape:'rgba(190,165,40,.34)' },
  { key:'pink',   bg:'#ffd0e0', bg2:'#ffb6d2', edge:'#ffa6c8', ink:'#7a2347', tape:'rgba(200,90,140,.30)' },
  { key:'blue',   bg:'#bfe3ff', bg2:'#a6d6ff', edge:'#93ccff', ink:'#1d456e', tape:'rgba(70,135,200,.30)' },
  { key:'green',  bg:'#c7f0cf', bg2:'#aae8b9', edge:'#97e1aa', ink:'#1d6638', tape:'rgba(60,165,95,.30)' },
  { key:'purple', bg:'#e0d4ff', bg2:'#cdb8ff', edge:'#c1a8ff', ink:'#472d78', tape:'rgba(135,95,205,.30)' },
  { key:'orange', bg:'#ffdcab', bg2:'#ffca85', edge:'#ffbd6e', ink:'#7a3d0f', tape:'rgba(210,120,40,.30)' },
];
const STICKY_NOTE_FONT = "'Bradley Hand','Segoe Print','Comic Sans MS','Chalkboard SE',cursive";
const getStickyColor = (key) => STICKY_NOTE_COLORS.find(c => c.key === key) || STICKY_NOTE_COLORS[0];
const TAG_STICKERS = [
  { label:'Exam trap', color:'#ef4444' },
  { label:'Must know', color:'#2563eb' },
  { label:'Review', color:'#7c3aed' },
  { label:'High yield', color:'#059669' },
  { label:'Formula', color:'#d97706' },
  { label:'Doubt', color:'#0891b2' },
];

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
  ctx.strokeStyle = '#0B1220';
  ctx.fillStyle = '#0B1220';
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
function studentCanvasPersonalStorageKey(noteId) {
  return noteId ? `lms.studentCanvas.personal.${noteId}` : '';
}

function offlineNoteCacheKeys({ id, lessonId, noteId }) {
  return [
    noteId ? `${OFFLINE_NOTE_CACHE_PREFIX}note.${noteId}` : '',
    lessonId ? `${OFFLINE_NOTE_CACHE_PREFIX}lesson.${lessonId}` : '',
    id ? `${OFFLINE_NOTE_CACHE_PREFIX}route.${id}` : '',
  ].filter(Boolean);
}

function writeOfflineNoteCache(data, { id, lessonId }) {
  if (!data || typeof window === 'undefined') return;
  const noteId = data.id || id || lessonId;
  const keys = offlineNoteCacheKeys({ id, lessonId, noteId });
  if (!keys.length) return;
  const payload = {
    cachedAt: Date.now(),
    data,
  };
  try {
    keys.forEach((key) => window.localStorage.setItem(key, JSON.stringify(payload)));
  } catch {
    // Offline note cache is a convenience; personal writing has its own storage.
  }
}

function readOfflineNoteCache({ id, lessonId }) {
  if (typeof window === 'undefined') return null;
  const keys = offlineNoteCacheKeys({ id, lessonId, noteId: id });
  for (const key of keys) {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(key) || 'null');
      if (parsed?.data) return parsed.data;
    } catch {
      // Try the next cache key.
    }
  }
  return null;
}

function writePersonalLayerToDevice(key, nextLayer) {
  if (!key || typeof window === 'undefined') return false;
  try {
    const payload = {
      ...normalizePersonalLayer(nextLayer),
      savedAt: Date.now(),
      storage: 'device',
      sync: 'local-only',
    };
    window.localStorage.setItem(key, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
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

function PenCloseIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M8.7 1.8l3.5 3.5-6.9 6.9-3.7.6.6-3.7 6.5-7.3z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
      <path d="M7.6 3.2l3.2 3.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M1.8 1.8l10.4 10.4M12.2 1.8L1.8 12.2" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round"/>
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

function StickerIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M3.2 2.2h5.2l2.4 2.4v6.2a1 1 0 0 1-1 1H3.2a1 1 0 0 1-1-1V3.2a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
      <path d="M8.4 2.3v2.1a.7.7 0 0 0 .7.7h2.1" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
      <path d="M4.6 7.4h3.8M4.6 9.3h2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

// ── Floating sticker ──────────────────────────────────────────────────────────
function FloatingSticker({ s, editable, selected = false, autoFocus = false, onFocused, onSelect, onUpdate, onDelete, canvasRef }) {
  const dr = useRef(null), el = useRef(null);
  const taRef = useRef(null);
  const lastTapRef = useRef({ t:0, x:0, y:0 });
  // Auto-grow the note to fit its text so typing feels like writing straight on
  // the sticky paper (no fixed "text box").
  useEffect(() => {
    if (s.type !== 'note' || !editable) return;
    const ta = taRef.current;
    if (ta) { ta.style.height = 'auto'; ta.style.height = `${ta.scrollHeight}px`; }
  }, [s.text, s.type, editable, s.w]);
  useEffect(() => {
    if (!autoFocus || s.type !== 'note' || !editable) return;
    const timer = window.setTimeout(() => {
      taRef.current?.focus();
      onFocused?.();
    }, 40);
    return () => window.clearTimeout(timer);
  }, [autoFocus, editable, onFocused, s.type]);
  function onPD(e) {
    if (!editable) return;
    if (e.target?.closest?.('[data-sticker-delete]')) return;
    e.stopPropagation(); e.preventDefault();
    onSelect?.(s.id);
    const r = canvasRef.current?.getBoundingClientRect(); if (!r) return;
    const w = s.type === 'note' ? (s.w || 180) : (s.type === 'tag' ? (s.w || 122) : 40);
    const h = s.type === 'note' ? (s.h || 110) : (s.type === 'tag' ? 36 : 40);
    dr.current = { sx:e.clientX, sy:e.clientY, ox:s.x, oy:s.y, x:s.x, y:s.y, w, h, r, moved:false };
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
    d.moved = d.moved || Math.hypot(d.x - d.ox, d.y - d.oy) > 4;
    if (el.current) {
      el.current.style.transform = `translate3d(${d.x - d.ox}px, ${d.y - d.oy}px, 0) rotate(${s.type === 'note' || s.type === 'tag' ? 0 : (s.r || 0)}deg)`;
    }
  }
  function focusNoteText() {
    if (s.type !== 'note' || !editable) return;
    window.setTimeout(() => {
      taRef.current?.focus();
      const length = taRef.current?.value?.length || 0;
      taRef.current?.setSelectionRange?.(length, length);
    }, 0);
  }
  function handleNoteTap(e) {
    if (s.type !== 'note' || !editable) return;
    const now = Date.now();
    const previous = lastTapRef.current;
    const dx = (Number(e?.clientX) || 0) - previous.x;
    const dy = (Number(e?.clientY) || 0) - previous.y;
    if (now - previous.t < 380 && Math.hypot(dx, dy) < 28) {
      lastTapRef.current = { t:0, x:0, y:0 };
      focusNoteText();
      return;
    }
    lastTapRef.current = { t:now, x:Number(e?.clientX) || 0, y:Number(e?.clientY) || 0 };
  }
  function finishDrag(e) {
    const d = dr.current;
    if (!d) return;
    if (el.current) {
      el.current.style.cursor = editable ? 'grab' : 'default';
      el.current.style.willChange = '';
      el.current.style.transform = `rotate(${s.type === 'note' || s.type === 'tag' ? 0 : (s.r || 0)}deg)`;
    }
    dr.current = null;
    try { e?.currentTarget?.releasePointerCapture?.(e.pointerId); } catch { /* pointer may already be released */ }
    if (Math.abs(d.x - d.ox) > 0.5 || Math.abs(d.y - d.oy) > 0.5) {
      onUpdate({ ...s, x:d.x, y:d.y });
    } else if (s.type === 'note' && editable) {
      handleNoteTap(e);
    }
  }
  return (
    <div ref={el} onPointerDown={onPD} onPointerMove={onPM} onPointerUp={finishDrag} onPointerCancel={finishDrag}
      className="group/fs absolute select-none leading-none"
      style={{ left:s.x, top:s.y, cursor:editable?'grab':'default', zIndex:selected ? 46 : 45, transform:`rotate(${s.type === 'note' || s.type === 'tag' ? 0 : (s.r || 0)}deg)`, touchAction:editable?'none':'auto' }}>
      {s.type === 'note' ? (() => {
        const c = getStickyColor(s.color);
        const w = s.w || 194;
        return (
          <div
            className="lms-sticky-note relative overflow-hidden"
            onClick={editable ? (event) => { event.stopPropagation(); onSelect?.(s.id); } : undefined}
            onDoubleClick={editable ? (event) => { event.stopPropagation(); onSelect?.(s.id); focusNoteText(); } : undefined}
            style={{
              width: w, minHeight: 96,
              background: c.bg,
              color: c.ink,
              padding: '14px 14px 13px',
              border: `1px solid ${selected ? c.ink : c.edge}`,
              borderRadius: 10,
              boxShadow: selected ? `0 0 0 2px ${c.edge}` : '0 2px 8px rgba(15,23,42,.08)',
            }}
          >
            <span aria-hidden="true" className="absolute inset-x-3 top-2" style={{ height:2, borderRadius:99, background:c.edge, opacity:.42 }} />
            {editable ? (
              <textarea ref={taRef}
                className="block w-full resize-none overflow-hidden border-0 bg-transparent p-0 outline-none placeholder:opacity-45"
                rows={1}
                style={{ appearance:'none', WebkitAppearance:'none', background:'transparent', border:'none', boxShadow:'none', fontFamily: STICKY_NOTE_FONT, fontSize:17, fontWeight:700, lineHeight:1.36, color:c.ink, caretColor:c.ink, minHeight:54, marginTop:6 }}
                value={s.text || ''}
                onPointerDown={e => {
                  onSelect?.(s.id);
                  const pointerType = String(e.pointerType || '').toLowerCase();
                  const textIsActive = typeof document !== 'undefined' && document.activeElement === taRef.current;
                  if (pointerType === 'touch' && !textIsActive) {
                    onPD(e);
                    return;
                  }
                  e.stopPropagation();
                }}
                onChange={e => { e.currentTarget.style.height='auto'; e.currentTarget.style.height=`${e.currentTarget.scrollHeight}px`; onUpdate({ ...s, text:e.target.value }); }}
                placeholder="Tap and type…"
                aria-label="Personal sticky note text"
              />
            ) : (
              <p className="m-0 whitespace-pre-wrap" style={{ fontFamily: STICKY_NOTE_FONT, fontSize:17, fontWeight:700, lineHeight:1.36, color:c.ink, paddingTop:6 }}>{s.text}</p>
            )}
          </div>
        );
      })() : s.type === 'tag' ? (
        <span
          style={{
            display:'inline-flex',
            alignItems:'center',
            minHeight:30,
            padding:'0 10px',
            borderRadius:999,
            border:`1px solid ${selected ? s.color : `${s.color}55`}`,
            background:`color-mix(in srgb, ${s.color || '#2563eb'} 14%, white)`,
            color:s.color || '#2563eb',
            boxShadow:selected ? `0 0 0 2px color-mix(in srgb, ${s.color || '#2563eb'} 24%, transparent)` : 'none',
            fontSize:12,
            fontWeight:900,
            whiteSpace:'nowrap',
          }}
        >
          {s.label || 'Tag'}
        </span>
      ) : (
        <span className="text-2xl">{s.emoji}</span>
      )}
      {editable && <button
        data-sticker-delete="true"
        className={cx(
          'absolute size-5 items-center justify-center border-0 bg-transparent p-0',
          s.type === 'note' ? '-right-2 -top-2' : 'left-1/2 -top-4 -translate-x-1/2',
          selected ? 'flex' : 'hidden group-hover/fs:flex'
        )}
        type="button"
        aria-label="Delete note item"
        title="Delete"
        style={{ touchAction:'manipulation' }}
        onPointerDown={e => { e.stopPropagation(); e.preventDefault(); }}
        onPointerUp={e => { e.stopPropagation(); e.preventDefault(); onDelete(s.id); }}
        onClick={e => { e.stopPropagation(); e.preventDefault(); onDelete(s.id); }}
      >
        <span aria-hidden="true" className="flex size-1 items-center justify-center rounded-full bg-red-500 text-[4px] font-black leading-none text-white shadow-[0_1px_3px_rgba(15,23,42,.25)]">×</span>
      </button>}
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
  zoomScale = 1,
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
  const inkBackRef = useRef(null);
  const strokeJustCommittedRef = useRef(false);
  const [eraserCursor, setEraserCursor] = useState(null);

  const getHostLayoutSize = useCallback(() => {
    const host = parentRef.current;
    if (!host) return null;
    const width = Math.max(1, Math.round(host.offsetWidth || host.clientWidth || host.scrollWidth || 1));
    const height = Math.max(1, Math.round(host.offsetHeight || host.clientHeight || host.scrollHeight || 1));
    return { width, height };
  }, [parentRef]);

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
    const size = getHostLayoutSize();
    if (!size) return;
    const { width, height } = size;
    const baseDpr = Math.max(1, window.devicePixelRatio || 1);
    const scaleDpr = Math.max(1, Number(zoomScale) || 1);
    const maxDprByArea = Math.sqrt(48000000 / Math.max(1, width * height));
    const maxDprBySide = Math.min(16384 / width, 16384 / height);
    const dpr = Math.max(1, Math.min(baseDpr * scaleDpr, 6, maxDprByArea, maxDprBySide));
    const inkCtx = prepareCanvas(inkCanvas, width, height, dpr);
    const highlightCtx = prepareCanvas(highlightCanvas, width, height, dpr);
    if (!inkCtx || !highlightCtx) return;
    items.forEach((stroke) => {
      if (stroke?.tool === 'eraser') {
        drawEraserStroke(highlightCtx, stroke, width, height);
        drawEraserStroke(inkCtx, stroke, width, height);
        return;
      }
      drawSmoothStroke(stroke?.tool === 'highlighter' ? highlightCtx : inkCtx, stroke, width, height);
    });
  }, [getHostLayoutSize, parentRef, prepareCanvas, zoomScale]);

  function canvasMetrics() {
    return getHostLayoutSize();
  }

  function captureBackBuffer() {
    const inkCanvas = canvasEl.current;
    const hlCanvas = highlightCanvasEl.current;
    if (!inkCanvas || !hlCanvas) { inkBackRef.current = null; return; }
    let buf = inkBackRef.current;
    if (!buf?.ink || buf.ink.width !== inkCanvas.width || buf.ink.height !== inkCanvas.height) {
      const ink = document.createElement('canvas');
      const hl = document.createElement('canvas');
      ink.width = inkCanvas.width; ink.height = inkCanvas.height;
      hl.width = hlCanvas.width;   hl.height = hlCanvas.height;
      buf = { ink, hl };
    }
    const binkCtx = buf.ink.getContext('2d');
    const bhlCtx  = buf.hl.getContext('2d');
    if (!binkCtx || !bhlCtx) { inkBackRef.current = null; return; }
    binkCtx.clearRect(0, 0, buf.ink.width, buf.ink.height);
    binkCtx.drawImage(inkCanvas, 0, 0);
    bhlCtx.clearRect(0, 0, buf.hl.width, buf.hl.height);
    bhlCtx.drawImage(hlCanvas, 0, 0);
    inkBackRef.current = buf;
  }

  function drawFastLiveStroke(stroke) {
    if (!stroke || stroke.tool === 'eraser') return;
    const inkCanvas = canvasEl.current;
    const hlCanvas  = highlightCanvasEl.current;
    const buf       = inkBackRef.current;
    const host      = parentRef.current;
    if (!inkCanvas || !hlCanvas || !host) { drawAll([...strokesRef.current, stroke]); return; }
    if (!buf?.ink || buf.ink.width !== inkCanvas.width || buf.ink.height !== inkCanvas.height) {
      drawAll([...strokesRef.current, stroke]);
      return;
    }
    const size = getHostLayoutSize();
    if (!size) return;
    const { width, height } = size;
    const baseDpr      = Math.max(1, window.devicePixelRatio || 1);
    const scaleDpr     = Math.max(1, Number(zoomScale) || 1);
    const maxDprByArea = Math.sqrt(48000000 / Math.max(1, width * height));
    const maxDprBySide = Math.min(16384 / width, 16384 / height);
    const dpr          = Math.max(1, Math.min(baseDpr * scaleDpr, 6, maxDprByArea, maxDprBySide));

    const inkCtx = inkCanvas.getContext('2d');
    const hlCtx  = hlCanvas.getContext('2d');
    if (!inkCtx || !hlCtx) return;

    // Restore committed strokes via GPU blit (O(1) regardless of stroke count)
    inkCtx.setTransform(1, 0, 0, 1, 0, 0);
    hlCtx.setTransform(1, 0, 0, 1, 0, 0);
    inkCtx.clearRect(0, 0, inkCanvas.width, inkCanvas.height);
    hlCtx.clearRect(0, 0, hlCanvas.width, hlCanvas.height);
    inkCtx.drawImage(buf.ink, 0, 0);
    hlCtx.drawImage(buf.hl, 0, 0);

    // Set DPR-scaled transform for stroke rendering
    inkCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    inkCtx.imageSmoothingEnabled = true;
    inkCtx.imageSmoothingQuality = 'high';
    hlCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    hlCtx.imageSmoothingEnabled = true;
    hlCtx.imageSmoothingQuality = 'high';

    if (stroke.tool === 'highlighter') {
      drawSmoothStroke(hlCtx, stroke, width, height);
    } else {
      drawSmoothStroke(inkCtx, stroke, width, height);
    }
  }

  function stableZoomScale() {
    return Math.max(1, Math.min(3, Number(zoomScale) || 1));
  }

  function pageStableWidth(screenWidth, minimumPageWidth = 0.75) {
    return Math.max(minimumPageWidth, (Number(screenWidth) || 1) / stableZoomScale());
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
      ctx.strokeStyle = '#0B1220';
      ctx.fillStyle = '#0B1220';
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
    if (strokeJustCommittedRef.current) {
      strokeJustCommittedRef.current = false;
      return;
    }
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
    return pageStableWidth(Math.max(22, (Number(penWidth) || 5) * 7), 8);
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
        color: '#0B1220',
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
    const basePenWidth = Number(penWidth) || 5;
    const strokeWidth = isHighlighter
      ? pageStableWidth(Math.max(10, basePenWidth * 2.4), 4)
      : pageStableWidth(basePenWidth, 0.75);
    captureBackBuffer();
    currentStrokeRef.current = {
      id: `stroke-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      color: penColor,
      width: strokeWidth,
      opacity: isHighlighter ? 0.36 : 0.98,
      tool: drawTool,
      points: [point],
      smoothedSoundPoint: point,
      soundStarted: false,
    };
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
        drawFastLiveStroke(stroke);
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
    inkBackRef.current = null;
    currentStrokeRef.current = null;
    try {
      if (event?.pointerId != null) event.currentTarget?.releasePointerCapture?.(event.pointerId);
    } catch {
      /* pointer may already be released */
    }

    if (!stroke) return;
    const points = simplifyStrokePoints(stroke.points);
    if (points.length > 0) {
      strokeJustCommittedRef.current = true;
      onCommitStroke({ ...stroke, points });
    }
  }

  function hideEraserCursor() {
    setEraserCursor(null);
  }

  const eraserDiameter = `${Math.round(eraserCursor?.size || pageStableWidth(Math.max(20, (Number(penWidth) || 5) * 8), 8))}px`;

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
          touchAction:drawMode && editable && !stylusOnly ? 'none' : 'auto',
          cursor:drawMode && editable ? 'crosshair' : 'default',
          WebkitTouchCallout:'none',
          WebkitUserSelect:'none',
          userSelect:'none',
        }}
      />
    </>
  );
});

function SmoothCanvasMotion() {
  // Styles moved to ai-notes-inline.css (R3 Task 27); nothing to render.
  return null;
}

const VIDEO_RESUME_STORAGE_PREFIX = 'lms.lessonVideo.resume.';

function videoResumeStorageKey(url) {
  const normalized = String(url || '').trim();
  if (!normalized) return '';
  try {
    return `${VIDEO_RESUME_STORAGE_PREFIX}${btoa(unescape(encodeURIComponent(normalized))).slice(0, 180)}`;
  } catch {
    return `${VIDEO_RESUME_STORAGE_PREFIX}${normalized.slice(0, 180)}`;
  }
}

function readVideoResumeSeconds(url) {
  if (typeof window === 'undefined') return 0;
  const key = videoResumeStorageKey(url);
  if (!key) return 0;
  return Math.max(0, Math.floor(Number(window.localStorage.getItem(key) || 0)));
}

function writeVideoResumeSeconds(url, seconds) {
  if (typeof window === 'undefined') return;
  const key = videoResumeStorageKey(url);
  if (!key) return;
  try {
    const value = Math.max(0, Math.floor(Number(seconds || 0)));
    if (value > 2) {
      window.localStorage.setItem(key, String(value));
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Video resume is a convenience only.
  }
}

function WatchVideoModal({ open, url, captionUrl = '', onClose, isDark }) {
  if (!open || typeof document === 'undefined') return null;
  const resumeSeconds = readVideoResumeSeconds(url);
  const embed = getVideoEmbed(url, { startSeconds: resumeSeconds });
  const panelBg = isDark ? 'rgba(15,18,31,.98)' : '#fbfcff';
  const line = isDark ? 'rgba(255,255,255,.10)' : '#e5e7eb';
  const muted = isDark ? 'rgba(226,232,240,.62)' : '#64748b';
  const text = isDark ? '#f8fafc' : '#334155';
  const titleId = 'lesson-video-modal-title';
  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-lg"
      style={{ zIndex: 99999 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-4xl overflow-hidden rounded-2xl border shadow-2xl" style={{ background:panelBg, borderColor:line, animation:'lmsVideoDialogIn 220ms cubic-bezier(.16,1,.3,1) both' }}>
        <div className="flex items-center justify-between gap-3 border-b px-5 py-4" style={{ borderColor:line }}>
          <div>
            <div id={titleId} style={{ fontSize:24, fontWeight:800, color:text }}>Watch lesson video</div>
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
                  allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
            ) : embed?.type === 'video' ? (
              <video
                className="h-full w-full bg-black object-contain"
                controls
                controlsList="nodownload"
                disablePictureInPicture
                preload="metadata"
                onLoadedMetadata={(event) => {
                  const video = event.currentTarget;
                  if (resumeSeconds > 2 && Number.isFinite(video.duration) && resumeSeconds < video.duration - 2) {
                    video.currentTime = resumeSeconds;
                  }
                }}
                onTimeUpdate={(event) => writeVideoResumeSeconds(url, event.currentTarget.currentTime)}
                onEnded={() => writeVideoResumeSeconds(url, 0)}
                onContextMenu={(event) => event.preventDefault()}
                src={embed.src}
              >
                {captionUrl ? (
                  <track default kind="captions" src={captionUrl} srcLang="en" label="English captions" />
                ) : null}
              </video>
            ) : embed?.type === 'blocked' ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                <div style={{ fontSize:22, color:text }}>This lesson video cannot be played securely.</div>
                <div className="max-w-sm text-xs leading-relaxed" style={{ color:muted }}>Ask your instructor to upload an embeddable protected video instead of a public link.</div>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
                <div style={{ fontSize:40 }}>🎬</div>
                <div style={{ fontSize:20, fontWeight:800, color:text }}>No video available yet</div>
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

// ── GoodNotes-style top tool toolbar (shown in Personalize mode) ──────────────
// Horizontal, flat tool strip docked above the canvas. Pen / highlighter / eraser,
// colors / width / undo / clear + stickers + sticky notes. The canvas
// underneath keeps the exact reading-mode width — tools live on top, not beside.
function CanvasTopToolbar({
  isDark, nativeWritingEnabled,
  drawMode, drawTool, penColor, penWidth, strokeCount,
  onSelectTool, onPenColorChange, onPenWidthChange,
  onUndoStroke, onClearStrokes, onStickerAdd, onNoteAdd, onTagAdd,
}) {
  const [menu, setMenu] = useState(false);
  const [menuRect, setMenuRect] = useState(null);
  const toolbarRef = useRef(null);
  const menuRef = useRef(null);
  const stickerButtonRef = useRef(null);
  useEffect(() => {
    if (!menu) return undefined;
    const h = e => {
      if (menuRef.current?.contains(e.target)) return;
      if (toolbarRef.current?.contains(e.target)) return;
      setMenu(false);
    };
    document.addEventListener('pointerdown', h, true);
    document.addEventListener('touchstart', h, true);
    return () => {
      document.removeEventListener('pointerdown', h, true);
      document.removeEventListener('touchstart', h, true);
    };
  }, [menu]);
  const updateMenuRect = useCallback(() => {
    if (!stickerButtonRef.current || typeof window === 'undefined') return;
    const rect = stickerButtonRef.current.getBoundingClientRect();
    const menuWidth = Math.min(292, Math.max(240, window.innerWidth - 24));
    const menuHeight = Math.min(420, Math.max(260, window.innerHeight - 24));
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - menuWidth - 12));
    const belowTop = rect.bottom + 8;
    const aboveTop = Math.max(12, rect.top - menuHeight - 8);
    const top = belowTop + menuHeight > window.innerHeight - 12 ? aboveTop : belowTop;
    setMenuRect({ top: Math.round(top), left: Math.round(left), width: Math.round(menuWidth), maxHeight: Math.round(menuHeight) });
  }, []);
  const toggleStickerMenu = useCallback(() => {
    setMenu(value => {
      const next = !value;
      if (next) window.requestAnimationFrame(updateMenuRect);
      return next;
    });
  }, [updateMenuRect]);
  useEffect(() => {
    if (!menu) return undefined;
    updateMenuRect();
    let frame = 0;
    const scheduleUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        updateMenuRect();
      });
    };
    window.addEventListener('resize', scheduleUpdate, { passive: true });
    window.addEventListener('scroll', scheduleUpdate, true);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', scheduleUpdate);
      window.removeEventListener('scroll', scheduleUpdate, true);
    };
  }, [menu, updateMenuRect]);

  const bd = isDark ? 'rgba(255,255,255,.1)' : '#e8e3d8';
  const ink = isDark ? 'rgba(226,232,240,.9)' : '#3b465f';
  const muted = isDark ? 'rgba(200,210,255,.5)' : '#9ca3af';
  const colors = drawTool === 'highlighter' ? HIGHLIGHT_COLORS : DRAW_COLORS;
  const iconButton = (active, danger) => ({
    width:22, height:22, minWidth:22, minHeight:22,
    display:'inline-flex', alignItems:'center', justifyContent:'center', gap:0, padding:0,
    borderRadius:7, fontSize:10, fontWeight:800, cursor:'pointer', whiteSpace:'nowrap',
    border:`1px solid ${active ? (isDark?'rgba(96,165,250,.5)':'#2563eb') : (danger ? (isDark?'rgba(220,38,38,.32)':'rgba(220,38,38,.3)') : bd)}`,
    background: active ? (isDark?'rgba(96,165,250,.16)':'#eff6ff') : 'transparent',
    color: active ? (isDark?'#bfdbfe':'#1d4ed8') : (danger ? (isDark?'#fca5a5':'#b91c1c') : ink),
  });
  const seg = iconButton;
  const cell = { width:24, height:24, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:7, border:`1px solid ${bd}`, background:isDark?'rgba(255,255,255,.04)':'#f9fafb', fontSize:13, cursor:'pointer' };
  const Divider = () => <span style={{ width:1, height:14, background:bd, flexShrink:0 }} />;

  return (
    <div ref={toolbarRef} className="lms-ai-note-tooltop" style={{
      position:'relative', width:'fit-content', maxWidth:'100%',
      display:'flex', flexWrap:'wrap', alignItems:'center', justifyContent:'center', gap:4, padding:'3px 5px',
      borderRadius:10, border:`1px solid ${bd}`, background:isDark?'rgba(18,20,31,.6)':'rgba(255,255,255,.7)',
    }}>
      {nativeWritingEnabled && (<>
        <button type="button" aria-label="Pen" title="Pen" style={seg(drawMode && drawTool === 'pen')} onClick={() => onSelectTool('pen')}><PenIcon size={12} /></button>
        <button type="button" aria-label="Highlighter" title="Highlighter" style={seg(drawMode && drawTool === 'highlighter')} onClick={() => onSelectTool('highlighter')}>
          <HighlighterIcon size={12} />
        </button>
        <button type="button" aria-label="Eraser" title="Eraser" style={seg(drawMode && drawTool === 'eraser')} onClick={() => onSelectTool('eraser')}>
          <EraserIcon size={12} />
        </button>
        <Divider />
        <div style={{ display:'flex', gap:3 }}>
          {colors.map(c => (
            <button key={c} type="button" onClick={() => onPenColorChange(c)} aria-label={`Pen color ${c}`} aria-pressed={penColor === c}
              style={{ width:16, height:16, borderRadius:5, background:c, cursor:'pointer', border: penColor === c ? `2px solid ${isDark?'#f8fafc':'#111827'}` : `1px solid ${bd}` }} />
          ))}
        </div>
        <Divider />
        <div style={{ display:'flex', gap:3 }}>
          {DRAW_WIDTHS.map(w => (
            <button key={w} type="button" onClick={() => onPenWidthChange(w)} aria-label={`Pen width ${w}`} aria-pressed={penWidth === w}
              style={{ width:20, height:20, borderRadius:6, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                border:`1px solid ${penWidth === w ? (isDark?'rgba(167,139,250,.5)':'#7c3aed') : bd}`, background: penWidth === w ? (isDark?'rgba(167,139,250,.14)':'#f5f3ff') : 'transparent' }}>
              <span style={{ display:'block', width:'62%', height:w, borderRadius:99, background:penColor }} />
            </button>
          ))}
        </div>
        <Divider />
        <button type="button" aria-label="Undo stroke" title="Undo" onClick={onUndoStroke} disabled={!strokeCount} style={{ ...seg(false), opacity:strokeCount?1:.4, cursor:strokeCount?'pointer':'not-allowed' }}><UndoIcon size={12} /></button>
        <button type="button" aria-label="Clear writing" title="Clear writing" onClick={onClearStrokes} disabled={!strokeCount} style={{ ...seg(false, !!strokeCount), opacity:strokeCount?1:.5, cursor:strokeCount?'pointer':'not-allowed' }}><TrashIcon size={12} /></button>
        <Divider />
      </>)}
      <div style={{ position:'relative' }}>
        <button ref={stickerButtonRef} type="button" aria-label="Stickers" title="Stickers" style={seg(menu)} onClick={toggleStickerMenu}><StickerIcon size={12} /></button>
        {menu && menuRect && typeof document !== 'undefined' ? createPortal(
          <div
            ref={menuRef}
            className="lms-ai-note-sticker-menu"
            style={{
              position:'fixed',
              top:menuRect.top,
              left:menuRect.left,
              zIndex:10020,
              width:menuRect.width,
              maxHeight:menuRect.maxHeight,
              overflowY:'auto',
              WebkitOverflowScrolling:'touch',
              padding:12,
              borderRadius:14,
              border:`1px solid ${bd}`,
              background:isDark?'#12141f':'#fff',
              boxShadow:'0 18px 42px rgba(15,23,42,.22)',
            }}
          >
            <div style={{ fontSize:10.5, fontWeight:800, letterSpacing:'.1em', textTransform:'uppercase', color:muted, marginBottom:8 }}>Sticky notes</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:9, marginBottom:13 }}>
              {STICKY_NOTE_COLORS.map(sc => (
                <button key={sc.key} type="button" title={`Add ${sc.key} sticky note`} onClick={() => { onNoteAdd(sc.key); setMenu(false); }}
                  className="lms-smooth-action"
                  style={{ position:'relative', width:36, height:36, borderRadius:9, cursor:'pointer', border:`1px solid ${sc.edge}`, padding:0,
                    background:sc.bg, boxShadow:'0 1px 4px rgba(15,23,42,.08)' }}>
                  <span aria-hidden="true" style={{ position:'absolute', left:8, right:8, top:8, height:2, borderRadius:99, background:sc.edge, opacity:.5 }} />
                  <span aria-hidden="true" style={{ position:'absolute', left:8, right:11, top:15, height:2, borderRadius:99, background:sc.edge, opacity:.35 }} />
                </button>
              ))}
            </div>
            <div style={{ fontSize:10.5, fontWeight:800, letterSpacing:'.1em', textTransform:'uppercase', color:muted, marginBottom:7 }}>Tags</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:12 }}>
              {TAG_STICKERS.map(tag => (
                <button key={tag.label} type="button" onClick={() => { onTagAdd(tag); setMenu(false); }} title={`Add ${tag.label} tag`}
                  style={{
                    minHeight:28,
                    borderRadius:999,
                    border:`1px solid ${tag.color}55`,
                    background:`${tag.color}14`,
                    color:tag.color,
                    padding:'0 10px',
                    cursor:'pointer',
                    fontSize:11,
                    fontWeight:900,
                    whiteSpace:'nowrap',
                  }}>
                  {tag.label}
                </button>
              ))}
            </div>
            <div style={{ fontSize:10.5, fontWeight:800, letterSpacing:'.1em', textTransform:'uppercase', color:muted, marginBottom:7 }}>Emojis</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:12 }}>
              {ICONS_LIB.map((ic, i) => <button key={i} type="button" style={cell} onClick={() => { onStickerAdd(ic); setMenu(false); }} title="Pin to lesson">{ic}</button>)}
            </div>
            <div style={{ fontSize:10.5, fontWeight:800, letterSpacing:'.1em', textTransform:'uppercase', color:muted, marginBottom:7 }}>Decorative</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {DECOS_LIB.map((d, i) => <button key={i} type="button" style={cell} onClick={() => { onStickerAdd(d); setMenu(false); }} title="Pin to lesson">{d}</button>)}
            </div>
          </div>,
          document.body
        ) : null}
      </div>
    </div>
  );
}

// ── Native pinch-to-zoom viewport ─────────────────────────────────────────────
// On native apps only: two-finger pinch zooms the canvas (1×–3×) and two-finger
// drag pans. Single-finger / stylus is never intercepted, so page scroll and pen
// drawing keep working. On web it renders children unchanged (zero impact).
function NativeZoomViewport({ enabled, storageKey = '', onZoomChange, children }) {
  const hostRef = useRef(null);
  const innerRef = useRef(null);
  const st = useRef({ scale: 1, tx: 0, ty: 0 });
  const g = useRef(null);
  const raf = useRef(0);

  useEffect(() => {
    if (enabled) return undefined;
    onZoomChange?.(1);
    return undefined;
  }, [enabled, onZoomChange]);

  useEffect(() => {
    if (!enabled) return undefined;
    const host = hostRef.current, inner = innerRef.current;
    if (!host || !inner) return undefined;
    if (storageKey && typeof window !== 'undefined') {
      try {
        const saved = JSON.parse(window.localStorage.getItem(storageKey) || 'null');
        if (saved && Number(saved.scale) > 1) {
          st.current = {
            scale: Math.max(1, Math.min(3, Number(saved.scale) || 1)),
            tx: Number(saved.tx) || 0,
            ty: Number(saved.ty) || 0,
          };
        }
      } catch {
        // Zoom memory is optional.
      }
    }
    const apply = () => {
      raf.current = 0;
      const { scale, tx, ty } = st.current;
      inner.style.transform = `translate3d(${tx}px,${ty}px,0) scale(${scale})`;
      // Only notify React (triggers re-render) when the pinch has ended — not during
      // active gesture. This keeps the CSS transform at 60fps while React re-renders
      // happen only once per pinch, eliminating the primary source of zoom lag.
      if (!g.current) onZoomChange?.(scale);
      if (storageKey && typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(storageKey, JSON.stringify({ scale, tx, ty, savedAt: Date.now() }));
        } catch {
          // Zoom memory is optional.
        }
      }
    };
    const schedule = () => { if (!raf.current) raf.current = requestAnimationFrame(apply); };
    const D = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const M = t => ({ x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 });
    const onStart = e => {
      if (e.touches.length !== 2) return;
      const r = host.getBoundingClientRect();
      const m = M(e.touches);
      g.current = { d0: D(e.touches) || 1, s0: st.current.scale, tx0: st.current.tx, ty0: st.current.ty, ax: m.x - r.left, ay: m.y - r.top, mx: m.x, my: m.y };
    };
    const onMove = e => {
      if (!g.current || e.touches.length !== 2) return;
      e.preventDefault();
      const d = D(e.touches), m = M(e.touches);
      const scale = Math.max(1, Math.min(3, g.current.s0 * (d / g.current.d0)));
      const k = scale / g.current.s0;
      let tx = g.current.ax - (g.current.ax - g.current.tx0) * k + (m.x - g.current.mx);
      let ty = g.current.ay - (g.current.ay - g.current.ty0) * k + (m.y - g.current.my);
      if (scale <= 1.001) { tx = 0; ty = 0; }
      else {
        // Clamp pan so zoomed content never scrolls off-screen
        const r = host.getBoundingClientRect();
        tx = Math.max(r.width  * (1 - scale), Math.min(0, tx));
        ty = Math.max(r.height * (1 - scale), Math.min(0, ty));
      }
      st.current = { scale, tx, ty };
      schedule();
    };
    const onEnd = e => {
      if (e.touches.length < 2) g.current = null;
      if (st.current.scale <= 1.02 && (st.current.tx || st.current.ty || st.current.scale !== 1)) {
        st.current = { scale: 1, tx: 0, ty: 0 };
      }
      // Always schedule after touch ends so the final state is applied and
      // onZoomChange fires (g.current is null at this point).
      schedule();
    };
    host.addEventListener('touchstart', onStart, { passive: false });
    host.addEventListener('touchmove', onMove, { passive: false });
    host.addEventListener('touchend', onEnd);
    host.addEventListener('touchcancel', onEnd);
    apply();
    return () => {
      host.removeEventListener('touchstart', onStart);
      host.removeEventListener('touchmove', onMove);
      host.removeEventListener('touchend', onEnd);
      host.removeEventListener('touchcancel', onEnd);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [enabled, storageKey, onZoomChange]);

  if (!enabled) return children;
  return (
    <div ref={hostRef} className="lms-ai-zoom-host" style={{ position: 'relative', touchAction: 'pan-y' }}>
      <div ref={innerRef} className="lms-ai-zoom-inner" style={{ transformOrigin: '0 0', willChange: 'transform' }}>
        {children}
      </div>
    </div>
  );
}

// ── Canvas card grid (one page) ───────────────────────────────────────────────
// ── Helpers ───────────────────────────────────────────────────────────────────
function normalizeNoteData(raw) {
  if (!raw) return null;
  if (raw.pages && Array.isArray(raw.pages)) return raw;
  return { pages: [raw] };
}
function mergeUniqueCanvasValues(values) {
  return [...new Set(values.map(value => String(value || '').trim()).filter(Boolean))];
}
function mergeStudentCanvasPages(pages, note) {
  const safePages = Array.isArray(pages) ? pages.filter(Boolean) : [];
  const firstPage = safePages[0] || {};
  if (safePages.length <= 1) {
    return {
      ...firstPage,
      title: firstPage.title || note.title,
      subtitle: firstPage.subtitle || note.courseTitle || '',
      layout: firstPage.layout || '3col',
    };
  }

  const summaries = safePages.map(page => String(page.summary_box || '').trim()).filter(Boolean);
  const mergedTags = mergeUniqueCanvasValues(safePages.flatMap(page => Array.isArray(page.tags) ? page.tags : []));
  const mergedKeywords = mergeUniqueCanvasValues(safePages.flatMap(page => Array.isArray(page.keywords) ? page.keywords : []));
  return {
    ...firstPage,
    title: note.lessonTitle || note.title || firstPage.title,
    subtitle: firstPage.subtitle || note.courseTitle || '',
    layout: firstPage.layout || '3col',
    sections: safePages.flatMap(page => Array.isArray(page.sections) ? page.sections : []),
    key_points: safePages.flatMap(page => Array.isArray(page.key_points) ? page.key_points : []),
    summary_box: summaries.join(' · '),
    canvasStickers: safePages.flatMap(page => Array.isArray(page.canvasStickers) ? page.canvasStickers : []),
    ...(mergedTags.length ? { tags: mergedTags } : {}),
    ...(mergedKeywords.length ? { keywords: mergedKeywords } : {}),
  };
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
function getVideoCaptionUrl(note) {
  const noteData = note?.noteData && typeof note.noteData === 'object' ? note.noteData : {};
  const video = noteData.video && typeof noteData.video === 'object' ? noteData.video : {};
  const candidates = [
    note?.captionUrl,
    note?.captionsUrl,
    note?.subtitleUrl,
    note?.subtitlesUrl,
    note?.videoCaptionUrl,
    noteData.captionUrl,
    noteData.captionsUrl,
    noteData.subtitleUrl,
    noteData.subtitlesUrl,
    noteData.videoCaptionUrl,
    video.captionUrl,
    video.captionsUrl,
    video.subtitleUrl,
    video.subtitlesUrl,
  ];

  return String(candidates.find((value) => String(value || '').trim()) || '').trim();
}
function BackIcon()     { return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M9.5 3.5l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
// ── Main page ─────────────────────────────────────────────────────────────────
export function AiNotesPage({ engineKey='gemini', headerTitle: _headerTitle='Lesson', backLabel: _backLabel='Lessons' }) {
  const { id, lessonId } = useParams();
  const navigate  = useNavigate();
  const location  = useLocation();
  const isDark    = useDark();
  const platform  = useMemo(() => detectPlatform(), []);
  const pageRef   = useRef(null);
  const canvasRef = useRef(null);
  const requestedEngineKey = useMemo(() => {
    const searchEngine = new URLSearchParams(location.search || '').get('engine');
    return searchEngine || location.state?.engineKey || engineKey;
  }, [engineKey, location.search, location.state]);

  const [note,      setNote]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [localData, setLocalData] = useState(null);
  const [stickers,  setStickers]  = useState([]);
  const [focusStickerId, setFocusStickerId] = useState('');
  const [selectedStickerId, setSelectedStickerId] = useState('');
  const [strokes,   setStrokes]   = useState([]);
  const [toast,     setToast]     = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [drawMode,  setDrawMode]  = useState(false);
  const [drawTool,  setDrawTool]  = useState('pen');
  const [penColor,  setPenColor]  = useState(DRAW_COLORS[1]);
  const [penWidth,  setPenWidth]  = useState(DRAW_WIDTHS[1]);
  const soundMode = 'spen';
  const [videoUrl,  setVideoUrl]  = useState('');
  const [videoCaptionUrl, setVideoCaptionUrl] = useState('');
  const [videoOpen, setVideoOpen] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);
  const [lessonCompleted, setLessonCompleted] = useState(false);
  const [completionBusy, setCompletionBusy] = useState(false);
  const [personalSaveStatus, setPersonalSaveStatus] = useState('');
  const [nativeZoomScale, setNativeZoomScale] = useState(1);
  const [isOffline, setIsOffline] = useState(() => (typeof navigator === 'undefined' ? false : !navigator.onLine));
  const sidRef = useRef(0);
  const saveTimerRef = useRef(null);
  const personalStatusTimerRef = useRef(null);
  const pendingStrokesRef = useRef(null);
  const stickersRef = useRef(stickers);
  stickersRef.current = stickers;

  const nativeWritingEnabled = true;
  const personalStorageId = note?.id || id || lessonId;
  const personalLayerStorageKey = studentCanvasPersonalStorageKey(personalStorageId);
  const nativeZoomStorageKey = personalStorageId ? `lms.aiNotes.zoom.${personalStorageId}` : '';
  const notify = msg => { setToast(msg); setTimeout(() => setToast(null), 2200); };
  const handleNativeZoomChange = useCallback((scale) => {
    const nextScale = Math.max(1, Math.min(3, Number(scale) || 1));
    setNativeZoomScale(previous => (Math.abs(previous - nextScale) < 0.015 ? previous : nextScale));
  }, []);
  const showPersonalSaveStatus = useCallback((message, clearAfter = 0) => {
    setPersonalSaveStatus(message);
    if (personalStatusTimerRef.current) clearTimeout(personalStatusTimerRef.current);
    if (clearAfter > 0) {
      personalStatusTimerRef.current = setTimeout(() => {
        setPersonalSaveStatus('');
        personalStatusTimerRef.current = null;
      }, clearAfter);
    }
  }, []);
  const toggleEditing = useCallback(() => {
    setIsEditing(v => {
      const next = !v;
      if (next) {
        setDrawMode(nativeWritingEnabled);
        if (nativeWritingEnabled) setDrawTool('pen');
      } else {
        setDrawMode(false);
        setSelectedStickerId('');
      }
      return next;
    });
  }, [nativeWritingEnabled]);

  useEffect(() => {
    let cancelled = false;
    (lessonId ? getLessonAiNoteWithFallback(Number(lessonId),{engine:requestedEngineKey}) : getAiNoteWithFallback(Number(id),{engine:requestedEngineKey}))
      .then(data => { if (!cancelled) {
        const baseData = normalizeNoteData(data.noteData);
        writeOfflineNoteCache(data, { id, lessonId });
        setNote(data);
        setLocalData(baseData);
        setError('');
        setVideoUrl(data.videoUrl || '');
        setVideoCaptionUrl(getVideoCaptionUrl(data));
        setLessonCompleted(Boolean(
          data.lessonCompleted ||
          data.lessonProgressStatus === 'completed' ||
          Number(data.lessonProgressPercent || 0) >= 100
        ));
      }
        recordStudyActivity({ activityType:'ai_note_viewed', itemId:Number(data.id||id||lessonId) }).catch(()=>{});
      })
      .catch(e => { if (!cancelled) {
        const cached = readOfflineNoteCache({ id, lessonId });
        if (cached) {
          const baseData = normalizeNoteData(cached.noteData);
          setNote({ ...cached, offlineCached: true });
          setLocalData(baseData);
          setVideoUrl(cached.videoUrl || '');
          setVideoCaptionUrl(getVideoCaptionUrl(cached));
          setLessonCompleted(Boolean(
            cached.lessonCompleted ||
            cached.lessonProgressStatus === 'completed' ||
            Number(cached.lessonProgressPercent || 0) >= 100
          ));
          setError('');
          showPersonalSaveStatus('Offline mode - lesson and writing are saved on this device');
          return;
        }
        setError(getErrorMessage(e,'Failed to load lesson.'));
      } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, lessonId, requestedEngineKey, showPersonalSaveStatus]);

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
    if (!personalLayerStorageKey || typeof window === 'undefined') return;
    try {
      const saved = window.localStorage.getItem(personalLayerStorageKey);
      const personalLayer = normalizePersonalLayer(saved ? JSON.parse(saved) : null);
      setStickers(personalLayer.stickers);
      setStrokes(personalLayer.strokes);
    } catch {
      setStickers([]);
      setStrokes([]);
    }
  }, [nativeWritingEnabled, personalLayerStorageKey]);

  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (personalStatusTimerRef.current) clearTimeout(personalStatusTimerRef.current);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const updateConnection = () => {
      const offline = typeof navigator !== 'undefined' && !navigator.onLine;
      setIsOffline(offline);
      if (offline) {
        showPersonalSaveStatus('Offline - personal notes save on this device');
      } else if (personalSaveStatus.startsWith('Offline')) {
        showPersonalSaveStatus('Back online - personal notes are saved locally', 2200);
      }
    };
    updateConnection();
    window.addEventListener('online', updateConnection);
    window.addEventListener('offline', updateConnection);
    return () => {
      window.removeEventListener('online', updateConnection);
      window.removeEventListener('offline', updateConnection);
    };
  }, [personalSaveStatus, showPersonalSaveStatus]);

  const savePersonalItems = useCallback((nextLayer) => {
    if (!personalLayerStorageKey || typeof window === 'undefined') return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const saved = writePersonalLayerToDevice(personalLayerStorageKey, nextLayer);
    showPersonalSaveStatus(
      saved
        ? (isOffline ? 'Offline - personal notes saved on this device' : 'Personal notes saved on this device')
        : 'Save failed - device storage may be full',
      saved ? 2200 : 0
    );
  }, [isOffline, personalLayerStorageKey, showPersonalSaveStatus]);

  function handleBack() {
    if (location.state?.returnToPath) {
      navigate(location.state.returnToPath, { state: location.state.returnState || undefined });
      return;
    }
    safeNavigateBack(navigate, { fallbackPath: '/ai-notes', currentPath: location.pathname });
  }

  useEffect(() => {
    if (!platform.isNative || !platform.isAndroid || typeof window === 'undefined') {
      return undefined;
    }

    function handleAndroidBack(event) {
      const savePending = personalSaveStatus.startsWith('Saving');
      if (!isEditing && !drawMode && !savePending) return;

      event.preventDefault();
      if (drawMode) {
        setDrawMode(false);
        showPersonalSaveStatus('Drawing closed - personal notes saved locally', 1800);
        return;
      }
      if (isEditing) {
        setIsEditing(false);
        showPersonalSaveStatus('Personalize closed - notes stay on this device', 1800);
        return;
      }
      showPersonalSaveStatus('Saving personal notes - try again in a moment', 1800);
    }

    window.addEventListener('lms:android-back', handleAndroidBack);
    return () => window.removeEventListener('lms:android-back', handleAndroidBack);
  }, [drawMode, isEditing, personalSaveStatus, platform.isAndroid, platform.isNative, showPersonalSaveStatus]);

  const addSticker    = useCallback(emoji => {
    if (!isEditing) {
      notify('Click Personalize first');
      return;
    }
    setStickers(ss => {
      const id = `st${++sidRef.current}`;
      setSelectedStickerId(id);
      const next = [...ss, { id, type:'emoji', emoji, x:40+Math.random()*160, y:40+Math.random()*80, r:Math.round(Math.random()*16-8) }];
      savePersonalItems({ stickers:next, strokes });
      return next;
    });
    notify(`${emoji} pinned`);
  }, [isEditing, savePersonalItems, strokes]);
  const addTagSticker = useCallback((tag) => {
    if (!isEditing) {
      notify('Click Personalize first');
      return;
    }
    const item = tag && typeof tag === 'object' ? tag : TAG_STICKERS[0];
    setStickers(ss => {
      const id = `st${++sidRef.current}`;
      setSelectedStickerId(id);
      const next = [...ss, { id, type:'tag', label:item.label, color:item.color, x:52+Math.random()*140, y:52+Math.random()*90, r:0, w:128 }];
      savePersonalItems({ stickers:next, strokes });
      return next;
    });
    notify('Tag added');
  }, [isEditing, savePersonalItems, strokes]);
  const addStickyNote = useCallback((presetColor) => {
    if (!isEditing) {
      notify('Click Personalize first to add sticky notes');
      return;
    }
    const preset = typeof presetColor === 'string' && STICKY_NOTE_COLORS.some(c => c.key === presetColor) ? presetColor : null;
    setStickers(ss => {
      const color = preset || STICKY_NOTE_COLORS[ss.filter(s => s.type === 'note').length % STICKY_NOTE_COLORS.length].key;
      const id = `st${++sidRef.current}`;
      setFocusStickerId(id);
      setSelectedStickerId(id);
      const next = [...ss, { id, type:'note', text:'', color, x:54+Math.random()*130, y:70+Math.random()*90, r:0, w:194, h:110 }];
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
  const deleteSticker = useCallback(sid => {
    setSelectedStickerId(current => current === sid ? '' : current);
    setFocusStickerId(current => current === sid ? '' : current);
    setStickers(ss => {
      const next = ss.filter(s => s.id!==sid);
      savePersonalItems({ stickers:next, strokes });
      return next;
    });
  }, [savePersonalItems, strokes]);
  const commitStroke = useCallback((stroke) => {
    if (!nativeWritingEnabled) return;
    setStrokes(current => {
      const next = [...current, stroke].slice(-250);
      pendingStrokesRef.current = next;
      return next;
    });
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      const next = pendingStrokesRef.current;
      if (next === null) return;
      pendingStrokesRef.current = null;
      savePersonalItems({ stickers: stickersRef.current, strokes: next });
    }, 800);
  }, [nativeWritingEnabled, savePersonalItems]);
  const undoStroke = useCallback(() => {
    setStrokes(current => {
      const next = current.slice(0, -1);
      savePersonalItems({ stickers, strokes:next });
      return next;
    });
  }, [savePersonalItems, stickers]);
  const clearStrokes = useCallback(() => {
    if (strokes.length && typeof window !== 'undefined' && !window.confirm('Clear all canvas writing?')) return;
    setStrokes([]);
    savePersonalItems({ stickers, strokes:[] });
    notify('Canvas writing cleared');
  }, [savePersonalItems, stickers, strokes.length]);
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
  const pages = localData?.pages || EMPTY_CANVAS_PAGES;
  const studentCanvasData = useMemo(
    () => mergeStudentCanvasPages(pages, note || {}),
    [pages, note]
  );

  if (loading) return (
    <main style={{ minHeight:'100dvh', background:pageBg }}>
      <div className="mx-auto grid max-w-[1400px] grid-cols-[minmax(0,1fr)_280px] gap-5 px-6 py-5 max-[1180px]:grid-cols-1 max-[1180px]:px-4 max-[520px]:px-3">
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10, alignItems:'start' }}>
          {[1,2,3,4,5,6].map((i,j) => <div key={i} style={{ height:[220,160,200,180,240,140][j], borderRadius:16, background:isDark?'#1a1d2e':'#e5e7eb', gridColumn:j===0?'1/-1':'span 1' }}/>)}
        </div>
        <div style={{ height:320, borderRadius:16, background:isDark?'#1a1d2e':'#e5e7eb' }}/>
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
      <WebViewLayer enabled={platform.isNative}>
      <div className="lms-ai-note-topbar" style={{ position:'sticky', top:0, zIndex:45, background:topBg, borderBottom:`1px solid ${topBd}`, WebkitBackdropFilter:'blur(8px)', backdropFilter:'blur(8px)' }}>
        <div className="lms-ai-note-topbar-inner" style={{ display:'flex', alignItems:'center', gap:14, maxWidth:1680, margin:'0 auto', padding:'calc(8px + env(safe-area-inset-top, 0px)) 20px 8px', minWidth:0 }}>
          {/* Left — back + title + breadcrumb */}
          <button className="lms-ai-note-back-button lms-smooth-action inline-flex items-center justify-center" onClick={handleBack} style={{ display:'flex', alignItems:'center', gap:6, border:`1px solid ${btnBd}`, background:btnBg, borderRadius:12, padding:'0 12px', minHeight:38, fontSize:12, fontWeight:700, color:btnTx, cursor:'pointer', flexShrink:0, boxShadow:lessonButtonShadow }}>
            <BackIcon/> Lessons
          </button>
          <div className="lms-ai-note-title-block" style={{ minWidth:0, flex:1, overflow:'hidden' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
              <div style={{ minWidth:0, fontSize:16, fontWeight:700, color:isDark?'#f0f4ff':'#374151', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{canvasTitle}</div>
              {note.isFree ? (
                <span style={{ flexShrink:0, border:'1px solid rgba(16,185,129,.25)', background:'rgba(16,185,129,.12)', color:isDark?'#86efac':'#047857', borderRadius:999, padding:'2px 8px', fontSize:11, fontWeight:900, textTransform:'uppercase' }}>
                  Free
                </span>
              ) : null}
            </div>
            {canvasContext && <div style={{ fontSize:11, color:isDark?'rgba(200,210,255,.45)':'#9ca3af', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{canvasContext}</div>}
          </div>
          {/* Right — status + theme + actions */}
          <div className="lms-ai-note-topbar-actions" style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0, minWidth:0 }}>
            {(isEditing || personalSaveStatus || isOffline) ? (
              <span className="lms-ai-note-status-pill" aria-live="polite" role="status"
                style={{ fontSize:11, fontWeight:700, maxWidth:170, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                  color:personalSaveStatus.startsWith('Save failed') ? (isDark ? '#fca5a5' : '#b91c1c') : (isDark ? 'rgba(200,210,255,.55)' : '#6b7280') }}>
                {personalSaveStatus || 'Autosaved'}
              </span>
            ) : null}
            <ThemeToggle />
            <button className="lms-ai-note-action-button lms-smooth-action inline-flex items-center justify-center"
              onClick={openVideo}
              disabled={isLocked}
              title={videoUrl ? 'Watch the lesson video' : 'No video added yet'}
              style={{ display:'flex', alignItems:'center', gap:6, border:`1px solid ${btnBd}`, background:btnBg, borderRadius:12, padding:'0 12px', minHeight:38, fontSize:11, fontWeight:800, color:btnTx, cursor:'pointer', opacity:isLocked ? 0.4 : (videoUrl ? 1 : 0.62), boxShadow:lessonButtonShadow }}>
              <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M3 2.2v7.6a.5.5 0 0 0 .77.42l6-3.8a.5.5 0 0 0 0-.84l-6-3.8A.5.5 0 0 0 3 2.2Z"/></svg>
              Video
            </button>
            <button className="lms-ai-note-action-button lms-smooth-action inline-flex items-center justify-center"
              onClick={() => navigate('/quizzes')}
              disabled={isLocked}
              title="Practice MCQs on this topic"
              style={{ display:'flex', alignItems:'center', gap:6, border:`1px solid ${btnBd}`, background:btnBg, borderRadius:12, padding:'0 12px', minHeight:38, fontSize:11, fontWeight:800, color:btnTx, cursor:'pointer', opacity:isLocked ? 0.4 : 1, boxShadow:lessonButtonShadow }}>
              MCQ
            </button>
            <button className="lms-ai-note-action-button lms-smooth-action inline-flex items-center justify-center"
              onClick={toggleEditing}
              disabled={isLocked}
              aria-pressed={isEditing}
              title={isEditing ? 'Close Personalize mode' : 'Personalize with pen'}
              style={{
                display:'flex', alignItems:'center', gap:6, minHeight:38,
                border:`1px solid ${isEditing ? (isDark ? 'rgba(167,139,250,.42)' : '#7c3aed') : btnBd}`,
                background:isEditing ? (isDark ? 'linear-gradient(180deg,rgba(167,139,250,.22),rgba(96,165,250,.10))' : '#f5f3ff') : btnBg,
                borderRadius:12, padding:'0 13px', fontSize:11, fontWeight:800,
                color:isEditing ? (isDark ? '#ddd6fe' : '#6d28d9') : btnTx,
                cursor:'pointer', opacity:isLocked ? 0.4 : 1,
                boxShadow:isEditing && isDark ? '0 10px 24px rgba(88,28,135,.18), inset 0 1px 0 rgba(255,255,255,.12)' : lessonButtonShadow,
              }}
            >
              {isEditing ? <PenCloseIcon /> : <PenIcon />} {isEditing ? 'Done' : 'Personalize'}
            </button>
          </div>
        </div>
        {/* Personalize tool toolbar lives inside the sticky header so it stays pinned
            on screen while scrolling/drawing. (The toolbar's own position:sticky is
            broken by the global overflow-x rule, so we pin the whole header instead.) */}
        {canEdit && (
          <div className="lms-ai-note-tooltop-row" style={{ borderTop:`1px solid ${topBd}`, padding:'4px 7px', display:'flex', justifyContent:'center', background:isDark?'rgba(10,12,22,.35)':'rgba(250,250,247,.6)' }}>
            <CanvasTopToolbar
              isDark={isDark}
              nativeWritingEnabled={nativeWritingEnabled}
              drawMode={drawMode}
              drawTool={drawTool}
              penColor={penColor}
              penWidth={penWidth}
              strokeCount={strokes.length}
              onSelectTool={(tool) => {
                setDrawMode(true);
                setDrawTool(tool);
                if (tool === 'highlighter' && !HIGHLIGHT_COLORS.includes(penColor)) setPenColor(HIGHLIGHT_COLORS[0]);
                if (tool === 'pen' && HIGHLIGHT_COLORS.includes(penColor)) setPenColor(DRAW_COLORS[1]);
              }}
              onPenColorChange={setPenColor}
              onPenWidthChange={setPenWidth}
              onUndoStroke={undoStroke}
              onClearStrokes={clearStrokes}
              onStickerAdd={addSticker}
              onNoteAdd={addStickyNote}
              onTagAdd={addTagSticker}
            />
          </div>
        )}
      </div>
      </WebViewLayer>

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
                <span style={{ display:'block', width:'100%', height:'100%', borderRadius:'inherit', background:'linear-gradient(90deg,#3b82f6,#6d35df)', transform:`scaleX(${readingProgress / 100})`, transformOrigin:'left center', transition:'transform 120ms linear' }} />
              </div>
            </div>
            <button className="lms-ai-note-action-button lms-smooth-action inline-flex items-center justify-center" type="button" onClick={markLessonComplete} disabled={completionBusy || lessonCompleted} style={markCompleteStyle}>
              {completionBusy ? 'Saving...' : lessonCompleted ? 'Done' : 'Mark Complete'}
            </button>
          </div>
        </div>,
        document.body
      ) : null}

      {/* Pen tools now live in the GoodNotes-style CanvasTopToolbar above the canvas
          (Personalize mode), replacing the old floating writing palette. */}

      {/* Body — one full-width canvas column, just like reading mode. Tools live in
          the top toolbar (Personalize), never in a side panel. The two-class
          --solo selector beats the responsive grid-template !important media rules. */}
      <div className="lms-ai-canvas-shell lms-ai-canvas-shell--solo mx-auto grid !max-w-[1160px] !grid-cols-[minmax(0,1fr)] gap-0 px-6 py-5 max-[1180px]:px-4 max-[640px]:px-0 max-[520px]:px-0">
        <section className="lms-ai-note-main min-w-0">
          <NativeZoomViewport enabled={platform.isNative && !isLocked} storageKey={nativeZoomStorageKey} onZoomChange={handleNativeZoomChange}>
          <div ref={canvasRef} onPointerDown={() => { if (canEdit) setSelectedStickerId(''); }} style={{ position:'relative', minWidth:0, maxWidth:'100%' }}>
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
                zoomScale={nativeZoomScale}
                stylusOnly
                onCommitStroke={commitStroke}
              />
            )}
            {stickers.map(s => (
              <FloatingSticker
                key={s.id}
                s={s}
                editable={canEdit}
                selected={selectedStickerId === s.id}
                autoFocus={focusStickerId === s.id}
                onFocused={() => setFocusStickerId('')}
                onSelect={setSelectedStickerId}
                onUpdate={updateSticker}
                onDelete={deleteSticker}
                canvasRef={canvasRef}
              />
            ))}

            {isLocked ? (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, minHeight:400, borderRadius:20, border:`1.5px dashed ${topBd}`, background:isDark?'rgba(255,255,255,.02)':'#fbfcff', padding:48, textAlign:'center' }}>
                <span style={{ color:isDark?'#93c5fd':'#2563eb' }}><LockIcon /></span>
                <div style={{ fontSize:15, fontWeight:800, color:isDark?'#f0f4ff':'#374151' }}>{note.upgradeLabel||'Plan access needed'}</div>
                <div style={{ fontSize:13, color:isDark?'#94a3b8':'#6b7280' }}>{note.lockReason||'This lesson is included with selected subscriptions.'}</div>
                <button className="inline-flex items-center justify-center" onClick={() => navigate('/subscriptions',{state:{from:location.pathname}})}
                  style={{ background:isDark?'rgba(167,139,250,.14)':'#f5f3ff', color:isDark?'#ddd6fe':'#6d28d9', borderRadius:12, padding:'10px 20px', fontSize:12, fontWeight:800, border:`1px solid ${isDark?'rgba(167,139,250,.28)':'rgba(124,58,237,.24)'}`, cursor:'pointer' }}>View access options</button>
              </div>
            ) : pages.length > 0 ? (
              <NoteCanvas data={studentCanvasData} editable={false} />
            ) : (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, minHeight:400, borderRadius:20, border:`1.5px dashed ${topBd}`, background:isDark?'rgba(255,255,255,.02)':'#fbfcff', textAlign:'center' }}>
                <span style={{ fontSize:48 }}>📋</span>
                <div style={{ fontSize:14, fontWeight:600, color:isDark?'#94a3b8':'#6b7280' }}>Lesson not yet published</div>
                <div style={{ fontSize:12, color:isDark?'#64748b':'#9ca3af' }}>This lesson is being prepared by your instructor.</div>
              </div>
            )}
          </div>
          </NativeZoomViewport>
        </section>
      </div>

      <WatchVideoModal
        open={videoOpen}
        url={videoUrl}
        captionUrl={videoCaptionUrl}
        onClose={() => setVideoOpen(false)}
        isDark={isDark}
      />

      {toast && (
        <div className="lms-toast" style={{ position:'fixed', bottom:20, left:'50%', transform:'translateX(-50%)', zIndex:50 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, border:`1px solid ${topBd}`, background:isDark?'#1a1d2e':'#fbfcff', borderRadius:16, padding:'10px 20px', fontSize:13, fontWeight:600, color:isDark?'#f0f4ff':'#374151', boxShadow:'0 8px 32px rgba(0,0,0,.15)' }}>{toast}</div>
        </div>
      )}

    </main>
  );
}
