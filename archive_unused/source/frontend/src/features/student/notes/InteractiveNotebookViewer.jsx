import { useEffect, useRef, useState } from 'react';
import { cx, ui } from '../../../styles/tailwindClasses.js';

const colorOptions = ['#2563eb', '#0f9fb7', '#16a34a', '#ec4899', '#f97316'];
const DEFAULT_LINE_WIDTH = 3;
const notebookUi = {
  page:
    'relative min-h-[320px] overflow-hidden rounded-xl border border-line-soft bg-surface-1',
  content: 'grid min-h-[inherit] gap-4 px-7 py-6',
  header: 'grid gap-1',
  title: 'm-0 text-[clamp(18px,2.5vw,24px)] font-extrabold leading-tight text-ink-strong',
  subtitle: 'm-0 text-[13px] leading-normal text-ink-soft',
  body: 'relative min-h-0',
  canvas: 'pointer-events-none absolute inset-0 touch-none',
  canvasDrawing: 'pointer-events-auto cursor-crosshair',
  arcWrap: 'absolute right-4 top-4 z-10 flex flex-col items-end gap-2',
  arcButton:
    'flex size-[38px] min-h-[38px] items-center justify-center rounded-full border border-line-medium bg-[var(--card-bg)] p-0 text-lg text-ink-medium shadow-md',
  arcButtonOpen: 'border-transparent bg-brand-primary text-white',
  arcPanel:
    'grid min-w-[180px] gap-2 rounded-lg border border-line-soft bg-[var(--card-bg)] px-3.5 py-3 shadow-lg',
  arcRow:
    'flex items-center gap-2 [&_label]:min-w-9 [&_label]:shrink-0 [&_label]:flex-row [&_label]:items-center [&_label]:text-xs [&_input[type="color"]]:h-8 [&_input[type="color"]]:min-h-8 [&_input[type="color"]]:w-8 [&_input[type="color"]]:flex-none [&_input[type="color"]]:rounded-sm [&_input[type="color"]]:p-0.5 [&_input[type="range"]]:flex-1',
  toolButton:
    'min-h-8 rounded-sm px-3 text-xs',
  toolButtonActive:
    'border border-brand-primary/30 bg-brand-primary-light text-brand-primary',
};

function getPoint(event, element) {
  const rect = element.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function isStylusLikeTouch(event) {
  const pointerType = event.pointerType || '';
  if (pointerType !== 'touch') {
    return false;
  }

  const pressure = Number(event.pressure || 0);
  const width = Number(event.width || 0);
  const height = Number(event.height || 0);
  const tiltX = Number(event.tiltX || 0);
  const tiltY = Number(event.tiltY || 0);
  const twist = Number(event.twist || 0);
  const buttons = Number(event.buttons || 0);
  const hasTilt = typeof event.altitudeAngle === 'number' || typeof event.azimuthAngle === 'number';

  return (
    hasTilt
    || tiltX !== 0
    || tiltY !== 0
    || twist !== 0
    || (pressure >= 0.08 && width > 0 && width <= 14 && height > 0 && height <= 14)
    || (buttons === 1 && width > 0 && width <= 8 && height > 0 && height <= 8)
  );
}

function isInkPointer(event) {
  const pointerType = event.pointerType || 'mouse';
  return pointerType === 'pen' || isStylusLikeTouch(event);
}

function configureContext(context) {
  context.lineCap = 'round';
  context.lineJoin = 'round';
}

function getMidpoint(firstPoint, secondPoint) {
  return {
    x: (firstPoint.x + secondPoint.x) / 2,
    y: (firstPoint.y + secondPoint.y) / 2,
  };
}

function drawStroke(context, stroke) {
  if (!stroke.points.length) {
    return;
  }

  context.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
  context.strokeStyle = stroke.color;

  if (stroke.points.length === 1) {
    context.beginPath();
    if (stroke.tool === 'eraser') {
      context.fillStyle = '#000';
    } else {
      context.fillStyle = stroke.color;
    }
    context.arc(stroke.points[0].x, stroke.points[0].y, Math.max(1.4, stroke.points[0].width / 2), 0, Math.PI * 2);
    context.fill();
    return;
  }

  if (stroke.points.length === 2) {
    const point = stroke.points[1];
    context.beginPath();
    context.lineWidth = point.width;
    context.moveTo(stroke.points[0].x, stroke.points[0].y);
    context.lineTo(point.x, point.y);
    context.stroke();
    return;
  }

  let previousMidpoint = getMidpoint(stroke.points[0], stroke.points[1]);

  for (let index = 1; index < stroke.points.length; index += 1) {
    const point = stroke.points[index];
    context.beginPath();
    context.lineWidth = point.width;
    context.moveTo(previousMidpoint.x, previousMidpoint.y);

    if (index < stroke.points.length - 1) {
      const nextPoint = stroke.points[index + 1];
      const currentMidpoint = getMidpoint(point, nextPoint);
      context.quadraticCurveTo(point.x, point.y, currentMidpoint.x, currentMidpoint.y);
      previousMidpoint = currentMidpoint;
    } else {
      context.quadraticCurveTo(point.x, point.y, point.x, point.y);
    }

    context.stroke();
  }
}

export function InteractiveNotebookViewer({ notebookId, title, note, children }) {
  const pageRef = useRef(null);
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const strokesRef = useRef([]);
  const currentStrokeRef = useRef(null);
  const isDrawingRef = useRef(false);
  const isPenActiveRef = useRef(false);
  const activePointerIdRef = useRef(null);
  const activeInkTypeRef = useRef(null);
  const activeTouchIdRef = useRef(null);
  const frameRef = useRef(null);
  const queuedPointsRef = useRef([]);

  const [arcOpen, setArcOpen] = useState(false);
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState(colorOptions[0]);
  const [size, setSize] = useState(DEFAULT_LINE_WIDTH);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    strokesRef.current = [];
    currentStrokeRef.current = null;
    isDrawingRef.current = false;
    isPenActiveRef.current = false;
    activePointerIdRef.current = null;
    activeInkTypeRef.current = null;
    activeTouchIdRef.current = null;
    queuedPointsRef.current = [];
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    setArcOpen(false);
    setTool('pen');
    syncPenSession(false);
  }, [notebookId]);

  useEffect(() => {
    const page = pageRef.current;
    if (!page) {
      return;
    }

    function updatePageSize() {
      setPageSize({
        width: Math.ceil(page.clientWidth),
        height: Math.ceil(page.scrollHeight),
      });
    }

    updatePageSize();
    const observer = new ResizeObserver(updatePageSize);
    observer.observe(page);
    window.addEventListener('resize', updatePageSize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updatePageSize);
    };
  }, [notebookId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !pageSize.width || !pageSize.height) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    contextRef.current = context;

    const devicePixelRatio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(pageSize.width * devicePixelRatio));
    canvas.height = Math.max(1, Math.floor(pageSize.height * devicePixelRatio));
    canvas.style.width = `${pageSize.width}px`;
    canvas.style.height = `${pageSize.height}px`;

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    configureContext(context);
    redrawCanvas();
  }, [pageSize]);

  useEffect(() => () => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
    }
    syncPenSession(false);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }

    function getStylusTouch(nativeEvent) {
      const changedTouches = Array.from(nativeEvent.changedTouches || []);
      return changedTouches.find((touch) => {
        const touchType = touch.touchType || '';
        const radiusX = Number(touch.radiusX || 0);
        const radiusY = Number(touch.radiusY || 0);
        const force = Number(touch.force || 0);
        const altitudeAngle = Number(touch.altitudeAngle || 0);
        const azimuthAngle = Number(touch.azimuthAngle || 0);

        return (
          touchType === 'stylus'
          || altitudeAngle > 0
          || azimuthAngle > 0
          || force >= 0.08
          || (radiusX > 0 && radiusX <= 10 && radiusY > 0 && radiusY <= 10)
        );
      }) || null;
    }

    function makeTouchPoint(touch) {
      const pressure = Math.max(Number(touch.force || 0), 0.12);
      const width = tool === 'eraser'
        ? Math.max(8, size * 4)
        : Math.max(1.5, pressure * size * 2);

      return {
        ...getPoint(touch, canvas),
        width,
      };
    }

    function beginNativeTouchStroke(touch) {
      if (isDrawingRef.current) {
        return;
      }

      isDrawingRef.current = true;
      isPenActiveRef.current = true;
      activePointerIdRef.current = null;
      activeTouchIdRef.current = touch.identifier;
      activeInkTypeRef.current = 'pen';
      queuedPointsRef.current = [];
      syncPenSession(true);
      currentStrokeRef.current = {
        tool,
        color,
        points: [makeTouchPoint(touch)],
      };
      redrawCanvas(true);
    }

    function moveNativeTouchStroke(touch) {
      if (!isDrawingRef.current || activeTouchIdRef.current !== touch.identifier) {
        return;
      }

      queuedPointsRef.current.push(makeTouchPoint(touch));

      if (!frameRef.current) {
        frameRef.current = requestAnimationFrame(flushQueuedPoints);
      }
    }

    function finishNativeTouchStroke(touch) {
      if (!isDrawingRef.current || activeTouchIdRef.current !== touch.identifier) {
        return;
      }

      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }

      flushQueuedPoints();
      isDrawingRef.current = false;
      isPenActiveRef.current = false;
      activePointerIdRef.current = null;
      activeTouchIdRef.current = null;
      activeInkTypeRef.current = null;
      syncPenSession(false);

      if (currentStrokeRef.current && currentStrokeRef.current.points.length > 0) {
        strokesRef.current = [...strokesRef.current, currentStrokeRef.current];
      }

      currentStrokeRef.current = null;
      queuedPointsRef.current = [];
      redrawCanvas();
    }

    function handleTouchStart(nativeEvent) {
      const stylusTouch = getStylusTouch(nativeEvent);
      if (!stylusTouch) {
        if (isPenActiveRef.current) {
          nativeEvent.preventDefault();
        }
        return;
      }

      nativeEvent.preventDefault();
      beginNativeTouchStroke(stylusTouch);
    }

    function handleTouchMove(nativeEvent) {
      const stylusTouch = Array.from(nativeEvent.changedTouches || []).find(
        (touch) => touch.identifier === activeTouchIdRef.current
      );

      if (!stylusTouch) {
        if (isPenActiveRef.current) {
          nativeEvent.preventDefault();
        }
        return;
      }

      nativeEvent.preventDefault();
      moveNativeTouchStroke(stylusTouch);
    }

    function handleTouchEnd(nativeEvent) {
      const stylusTouch = Array.from(nativeEvent.changedTouches || []).find(
        (touch) => touch.identifier === activeTouchIdRef.current
      );

      if (!stylusTouch) {
        return;
      }

      nativeEvent.preventDefault();
      finishNativeTouchStroke(stylusTouch);
    }

    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      canvas.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [color, size, tool, notebookId]);

  function syncPenSession(isActive) {
    const canvas = canvasRef.current;
    const page = pageRef.current;
    const body = typeof document !== 'undefined' ? document.body : null;

    if (canvas) {
      canvas.style.touchAction = isActive ? 'none' : 'auto';
    }

    if (page) {
      page.classList.toggle('notebook-page-pen-active', isActive);
    }

    if (body) {
      body.classList.toggle('notebook-pen-active', isActive);
    }
  }

  function getInkType(event) {
    const pointerType = event.pointerType || 'mouse';
    if (pointerType === 'pen' || isStylusLikeTouch(event)) {
      return 'pen';
    }

    return null;
  }

  function redrawCanvas(includeActiveStroke = false) {
    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (!canvas || !context) {
      return;
    }

    const devicePixelRatio = window.devicePixelRatio || 1;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    configureContext(context);

    for (const stroke of strokesRef.current) {
      drawStroke(context, stroke);
    }

    if (includeActiveStroke && currentStrokeRef.current) {
      drawStroke(context, currentStrokeRef.current);
    }
  }

  function makePoint(event) {
    const canvas = canvasRef.current;
    const pressure = isInkPointer(event) ? Math.max(event.pressure || 0, 0.12) : 0.5;
    const width = tool === 'eraser'
      ? Math.max(8, size * 4)
      : Math.max(1.5, pressure * size * 2);

    return {
      ...getPoint(event, canvas),
      width,
    };
  }

  function flushQueuedPoints() {
    frameRef.current = null;
    const stroke = currentStrokeRef.current;
    if (!stroke || queuedPointsRef.current.length === 0) {
      queuedPointsRef.current = [];
      return;
    }

    for (const point of queuedPointsRef.current) {
      const previousPoint = stroke.points[stroke.points.length - 1];
      if (previousPoint && Math.hypot(point.x - previousPoint.x, point.y - previousPoint.y) < 0.35) {
        continue;
      }

      stroke.points.push(point);
    }

    queuedPointsRef.current = [];
    redrawCanvas(true);
  }

  function stopDrawing(event) {
    if (!isDrawingRef.current || activePointerIdRef.current !== event.pointerId) {
      return;
    }

    const canvas = canvasRef.current;
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    flushQueuedPoints();

    canvas?.releasePointerCapture?.(event.pointerId);
    isDrawingRef.current = false;
    isPenActiveRef.current = false;
    activePointerIdRef.current = null;
    activeInkTypeRef.current = null;
    activeTouchIdRef.current = null;
    syncPenSession(false);

    if (currentStrokeRef.current && currentStrokeRef.current.points.length > 0) {
      strokesRef.current = [...strokesRef.current, currentStrokeRef.current];
    }

    currentStrokeRef.current = null;
    queuedPointsRef.current = [];
    redrawCanvas();
  }

  function handlePointerDown(event) {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const inkType = getInkType(event);
    const isPureTouch = event.pointerType === 'touch' && inkType !== 'pen';

    if (isPureTouch) {
      if (isPenActiveRef.current) {
        event.preventDefault();
      }
      return;
    }

    if (!inkType || !isInkPointer(event)) {
      return;
    }

    if (isDrawingRef.current) {
      return;
    }

    event.preventDefault();
    canvas.setPointerCapture?.(event.pointerId);
    isDrawingRef.current = true;
    isPenActiveRef.current = inkType === 'pen';
    activePointerIdRef.current = event.pointerId;
    activeInkTypeRef.current = inkType;
    queuedPointsRef.current = [];
    syncPenSession(inkType === 'pen');
    currentStrokeRef.current = {
      tool,
      color,
      points: [makePoint(event)],
    };
    redrawCanvas(true);
  }

  function handlePointerMove(event) {
    if (event.pointerType === 'touch' && isPenActiveRef.current) {
      event.preventDefault();
      return;
    }

    if (!isDrawingRef.current || activePointerIdRef.current !== event.pointerId || !isInkPointer(event)) {
      return;
    }

    event.preventDefault();
    const coalescedEvents = typeof event.getCoalescedEvents === 'function' ? event.getCoalescedEvents() : [event];
    queuedPointsRef.current.push(...coalescedEvents.map((pointerEvent) => makePoint(pointerEvent)));

    if (!frameRef.current) {
      frameRef.current = requestAnimationFrame(flushQueuedPoints);
    }
  }

  function clearCanvas() {
    strokesRef.current = [];
    currentStrokeRef.current = null;
    queuedPointsRef.current = [];
    redrawCanvas();
  }

  function handlePointerLost(event) {
    stopDrawing(event);
  }

  function handleTouchPointerEnd(event) {
    if (event.pointerType !== 'touch') {
      stopDrawing(event);
      return;
    }

    if (!isPenActiveRef.current) {
      return;
    }

    event.preventDefault();
  }

  return (
    <div className={notebookUi.page} ref={pageRef}>
      <div className={notebookUi.content}>
        <div className={notebookUi.header}>
          <span className={ui.eyebrow}>Notebook Viewer</span>
          <h2 className={notebookUi.title}>{title}</h2>
          <p className={notebookUi.subtitle}>{note}</p>
        </div>

        <div className={notebookUi.arcWrap}>
          <button className={cx(notebookUi.arcButton, arcOpen && notebookUi.arcButtonOpen)}
           
            onClick={() => setArcOpen((current) => !current)}
            type="button"
            aria-label={arcOpen ? 'Close notebook tools' : 'Open notebook tools'}
          >
            ✎
          </button>

          {arcOpen ? (
            <div className={notebookUi.arcPanel}>
              <div className={notebookUi.arcRow}>
                <button className={cx(notebookUi.toolButton, tool === 'pen' && notebookUi.toolButtonActive)} onClick={() => setTool('pen')} type="button">
                  Pen
                </button>
                <button className={cx(notebookUi.toolButton, tool === 'eraser' && notebookUi.toolButtonActive)} onClick={() => setTool('eraser')} type="button">
                  Eraser
                </button>
                <button className={notebookUi.toolButton} onClick={clearCanvas} type="button">
                  Clear
                </button>
              </div>

              <div className={notebookUi.arcRow}>
                <label className={ui.formLabel} htmlFor="notebook-color">Color</label>
                <input className="shrink-0"
                  id="notebook-color"
                  type="color"
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                  disabled={tool === 'eraser'}
                />
              </div>

              <div className={notebookUi.arcRow}>
                <label className={ui.formLabel} htmlFor="notebook-size">Size</label>
                <input className={ui.input}
                  id="notebook-size"
                  type="range"
                  min="2"
                  max="10"
                  value={size}
                  onChange={(event) => setSize(Number(event.target.value))}
                />
              </div>
            </div>
          ) : null}
        </div>

        <div className={notebookUi.body}>
          {children}
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className={cx(notebookUi.canvas, isPenActiveRef.current && notebookUi.canvasDrawing)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handleTouchPointerEnd}
        onPointerCancel={handleTouchPointerEnd}
        onPointerLeave={handlePointerLost}
        onLostPointerCapture={handlePointerLost}
      />
    </div>
  );
}
