import { useCallback, useRef, useState } from 'react';

/**
 * Place hotspots on a scene image. Coordinates are stored as 0–1 fractions of
 * the image box, never pixels, so the same case renders correctly on a phone,
 * a tablet and a zoomed-in view without re-authoring.
 *
 * "Add point" drops a new point in the middle; drag a point to move it; pick
 * what it does from the row beneath. Clicking the picture does nothing, so a
 * stray click never adds a point. Generated positions are only a guess — this is where
 * they're made right.
 */
export function SceneHotspotEditor({ scene, imageUrl, signs, scenes, onChange }) {
  const boxRef = useRef(null);
  const imgRef = useRef(null);
  const [selected, setSelected] = useState(null);
  const dragging = useRef(null);
  // Where inside the dot the pointer grabbed it. Without this the dot snaps its
  // centre to the cursor the moment you touch it, which reads as a jump.
  const grabOffset = useRef({ dx: 0, dy: 0 });
  // A click wobbles a pixel or two; only treat it as a drag once the pointer has
  // travelled far enough FROM WHERE IT WENT DOWN — measuring per-event movement
  // means a slow drag never accumulates past the threshold.
  const movedEnough = useRef(false);
  const startPoint = useRef({ x: 0, y: 0 });
  // The position being dragged is held HERE, not pushed to the parent on every
  // move. Sending each move up meant the parent recomputed from a `doc` captured
  // at its last render, so fast drags dropped intermediate positions and the dot
  // snapped back to a stale one on release. Local while dragging, commit once.
  const [dragPos, setDragPos] = useState(null);

  const hotspots = scene.hotspots || [];

  const patch = useCallback((next) => {
    onChange({ ...scene, hotspots: next });
  }, [scene, onChange]);

  /** Measure against the IMAGE, not the container — the box can be taller. */
  const imageRect = useCallback(
    () => (imgRef.current || boxRef.current)?.getBoundingClientRect() || null,
    []
  );

  const pointFromEvent = useCallback((event, offset = { dx: 0, dy: 0 }) => {
    const rect = imageRect();
    if (!rect || !rect.width || !rect.height) return null;
    return {
      x: Math.min(1, Math.max(0, (event.clientX - offset.dx - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - offset.dy - rect.top) / rect.height)),
    };
  }, [imageRect]);

  const addHotspot = useCallback(() => {
    const next = [...hotspots, { x: 0.5, y: 0.5, label: 'New point', action: { type: 'label' } }];
    patch(next);
    setSelected(next.length - 1);
  }, [hotspots, patch]);

  const onPointerDown = (index) => (event) => {
    event.stopPropagation();
    // The dot's centre goes exactly where the pointer is — no grab offset — so
    // a point lands where it's dropped.
    grabOffset.current = { dx: 0, dy: 0 };
    dragging.current = index;
    movedEnough.current = false;
    startPoint.current = { x: event.clientX, y: event.clientY };
    setSelected(index);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event) => {
    if (dragging.current === null) return;
    if (!movedEnough.current) {
      const travelled = Math.hypot(
        event.clientX - startPoint.current.x,
        event.clientY - startPoint.current.y
      );
      if (travelled < 3) return;
      movedEnough.current = true;
    }
    const point = pointFromEvent(event, grabOffset.current);
    if (!point) return;
    setDragPos({
      index: dragging.current,
      x: Number(point.x.toFixed(4)),
      y: Number(point.y.toFixed(4)),
    });
  };

  const endDrag = () => {
    const index = dragging.current;
    const pos = dragPos;
    dragging.current = null;

    // Commit exactly once, from the final position.
    if (index !== null && pos && pos.index === index) {
      patch(hotspots.map((h, i) => (i === index ? { ...h, x: pos.x, y: pos.y } : h)));
    }
    setDragPos(null);
    // Suppressed until the click that follows this release has been swallowed,
    // so finishing a drag never also drops a new point.
    requestAnimationFrame(() => { movedEnough.current = false; });
  };

  /** Arrow keys nudge the selected point — mouse precision isn't enough at 0.001. */
  const nudge = useCallback((dx, dy) => {
    if (selected === null) return;
    patch(hotspots.map((h, i) => (
      i === selected
        ? {
            ...h,
            x: Number(Math.min(1, Math.max(0, h.x + dx)).toFixed(4)),
            y: Number(Math.min(1, Math.max(0, h.y + dy)).toFixed(4)),
          }
        : h
    )));
  }, [selected, hotspots, patch]);

  const onKeyDown = (event) => {
    if (selected === null) return;
    const step = event.shiftKey ? 0.001 : 0.01;
    const moves = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0],
      ArrowUp: [0, -step], ArrowDown: [0, step],
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    nudge(move[0], move[1]);
  };

  const updateSelected = (changes) => {
    if (selected === null) return;
    patch(hotspots.map((h, i) => (i === selected ? { ...h, ...changes } : h)));
  };

  const commitAxis = (axis, raw) => {
    const n = Number(raw);
    if (selected === null || raw === '' || !Number.isFinite(n)) return;
    const next = Number((Math.min(100, Math.max(0, n)) / 100).toFixed(4));
    if (next === hotspots[selected]?.[axis]) return;
    patch(hotspots.map((h, i) => (i === selected ? { ...h, [axis]: next } : h)));
  };

  const removeSelected = () => {
    if (selected === null) return;
    patch(hotspots.filter((_, i) => i !== selected));
    setSelected(null);
  };

  const current = selected === null ? null : hotspots[selected];

  return (
    <div className="osce-hotspot">
      <div>
        <button type="button" className="osce-add osce-add--sm" onClick={addHotspot} disabled={!imageUrl}>
          + Add point
        </button>
      </div>
      <div
        ref={boxRef}
        className={`osce-hotspot-stage ${imageUrl ? '' : 'is-empty'}`}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onKeyDown={onKeyDown}
        tabIndex={0}
      >
        {imageUrl
          ? <img ref={imgRef} src={imageUrl} alt="" draggable={false} />
          : <p className="osce-hotspot-empty">Upload this scene&rsquo;s image first — points are placed on the picture.</p>}

        {hotspots.map((h, i) => {
          const live = dragPos && dragPos.index === i ? dragPos : h;
          return (
          <button
            key={i}
            type="button"
            className={`osce-hs ${selected === i ? 'is-sel' : ''} ${dragPos?.index === i ? 'is-dragging' : ''} osce-hs--${h.action?.type || 'label'}`}
            style={{ left: `${live.x * 100}%`, top: `${live.y * 100}%` }}
            onPointerDown={onPointerDown(i)}
            onClick={(e) => { e.stopPropagation(); setSelected(i); }}
            title={h.label}
          >
            <span className="osce-hs-dot" />
            <span className="osce-hs-label">{h.label}</span>
          </button>
          );
        })}
      </div>

      <p className="osce-hint">
        Use “Add point” to add one · drag a dot to move it · arrow keys nudge
        (hold Shift for fine) · {hotspots.length} placed
      </p>

      {current ? (
        <div className="osce-hs-form">
          <label>
            <span>Label</span>
            <input
              value={current.label || ''}
              onChange={(e) => updateSelected({ label: e.target.value })}
              placeholder="Malar flush"
            />
          </label>

          <label>
            <span>On tap</span>
            <select
              value={
                current.action?.type === 'sign' ? `sign:${current.action.id}`
                : current.action?.type === 'scene' ? `scene:${current.action.id}`
                : 'label'
              }
              onChange={(e) => {
                const value = e.target.value;
                if (value === 'label') return updateSelected({ action: { type: 'label' } });
                const [type, ...rest] = value.split(':');
                updateSelected({ action: { type, id: rest.join(':') } });
              }}
            >
              <option value="label">Just label it (no navigation)</option>
              <optgroup label="Open a finding">
                {signs.map((s) => (
                  <option key={s.id} value={`sign:${s.id}`}>{s.name}</option>
                ))}
              </optgroup>
              <optgroup label="Zoom to a scene">
                {scenes.filter((s) => s.id !== scene.id).map((s) => (
                  <option key={s.id} value={`scene:${s.id}`}>{s.title || s.id}</option>
                ))}
              </optgroup>
            </select>
          </label>

          <div className="osce-hs-coords">
            {['x', 'y'].map((axis) => {
              const value = dragPos?.index === selected ? dragPos[axis] : current[axis];
              return (
                <label key={axis} className="osce-hs-axis">
                  <span>{axis.toUpperCase()} %</span>
                  {/* Uncontrolled and committed on blur / Enter, so typing "42.5"
                      isn't reformatted under the cursor. The key re-seeds it when
                      a drag or an arrow-key nudge moves the point. */}
                  <input
                    key={`${selected}-${axis}-${value}`}
                    className="osce-input"
                    type="number" min="0" max="100" step="0.01"
                    defaultValue={(value * 100).toFixed(2)}
                    onBlur={(e) => commitAxis(axis, e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                  />
                </label>
              );
            })}
            <button type="button" className="osce-btn-danger" onClick={removeSelected}>
              Remove point
            </button>
          </div>
        </div>
      ) : (
        <p className="osce-hint osce-hint--muted">Select a point to edit it.</p>
      )}
    </div>
  );
}

export default SceneHotspotEditor;
