/**
 * The summary block: key points, OSCE tips, and Summary & Connect.
 *
 * Connect is the one that earns the screen. It ties each finding back to the
 * step of the pathophysiology that causes it, which is what turns a list of
 * signs into an explanation — and it's the step an examiner actually tests.
 * Both ends are dropdowns of things that exist in this case, so an edge can't
 * be authored dangling the way the generator's own output sometimes is.
 */
export function SummaryEditor({ doc, patchDoc }) {
  const summary = doc.summary || {};
  const signs = Array.isArray(doc.signs) ? doc.signs : [];
  const chain = Array.isArray(doc.chain) ? doc.chain : [];
  const edges = Array.isArray(summary.connect) ? summary.connect : [];

  const patchSummary = (changes) => patchDoc({ summary: { ...summary, ...changes } });

  const signName = (id) => signs.find((s) => s.id === id)?.name || '';
  const stepTitle = (step) => chain.find((c) => Number(c.step) === Number(step))?.title || '';

  const setEdges = (next) => patchSummary({ connect: next });
  const patchEdge = (i, changes) =>
    setEdges(edges.map((e, j) => (j === i ? { ...e, ...changes } : e)));

  // A finding with no mechanism attached is the gap worth surfacing — that sign
  // will never appear in the student's Summary & Connect.
  const unexplained = signs.filter((s) => !edges.some((e) => e.from === s.id));
  const broken = edges.filter(
    (e) => !signs.some((s) => s.id === e.from) || !chain.some((c) => Number(c.step) === Number(e.to))
  ).length;

  return (
    <div className="osce-summaryed">
      <StringList
        title="Key points"
        hint="The few sentences a student should leave with."
        items={summary.keyPoints || []}
        onChange={(keyPoints) => patchSummary({ keyPoints })}
        placeholder="Mitral stenosis is rheumatic until proven otherwise"
      />

      <StringList
        title="OSCE tips"
        hint="What the examiner is watching for."
        items={summary.osceTips || []}
        onChange={(osceTips) => patchSummary({ osceTips })}
        placeholder="Time the murmur before naming it"
      />

      <div className="osce-card">
        <div className="osce-card-head">
          <b className="osce-long-h">Summary &amp; Connect</b>
          <span className="osce-hint">
            {edges.length} link{edges.length === 1 ? '' : 's'}
            {broken ? ` · ${broken} broken` : ''}
          </span>
        </div>
        <p className="osce-hint">
          Each finding, and the step of the mechanism that causes it. Steps with no
          findings attached are hidden from students, so nothing here shows up empty.
        </p>

        {!signs.length || !chain.length ? (
          <p className="osce-hint osce-hint--muted">
            Add findings and pathophysiology steps first — this screen links the two.
          </p>
        ) : null}

        {broken ? (
          <p className="osce-warn">
            {broken} link{broken === 1 ? '' : 's'} reference a finding or step that no longer
            exists (usually because it was renamed or removed). Students never see these.
          </p>
        ) : null}

        {edges.map((edge, i) => {
          const fromOk = signs.some((s) => s.id === edge.from);
          const toOk = chain.some((c) => Number(c.step) === Number(edge.to));
          return (
            <div key={i} className={`osce-relrow ${fromOk && toOk ? '' : 'is-broken'}`}>
              <span className="osce-step">{i + 1}</span>
              <div className="osce-relrow-body">
                <label>
                  <span>Finding</span>
                  <select className="osce-input" value={fromOk ? edge.from : ''}
                          onChange={(e) => patchEdge(i, { from: e.target.value })}>
                    <option value="">
                      {edge.from ? `— ${edge.from} (gone) —` : '— pick a finding —'}
                    </option>
                    {signs.map((s) => (
                      <option key={s.id} value={s.id}>{s.name || s.id}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Explained by step</span>
                  <select className="osce-input" value={toOk ? String(edge.to) : ''}
                          onChange={(e) => patchEdge(i, { to: Number(e.target.value) })}>
                    <option value="">
                      {edge.to ? `— step ${edge.to} (gone) —` : '— pick a step —'}
                    </option>
                    {chain.map((c) => (
                      <option key={c.step} value={c.step}>
                        {c.step}. {c.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button type="button" className="osce-btn-danger"
                      onClick={() => setEdges(edges.filter((_, j) => j !== i))}>Remove</button>
            </div>
          );
        })}

        <div className="osce-summaryed-add">
          <button type="button" className="osce-add"
                  disabled={!signs.length || !chain.length}
                  onClick={() => setEdges([...edges, { from: '', to: chain[0]?.step ?? 1 }])}>
            + Link a finding
          </button>
          {broken ? (
            <button type="button" className="osce-btn-danger" onClick={() => setEdges(
              edges.filter((e) => signs.some((s) => s.id === e.from)
                && chain.some((c) => Number(c.step) === Number(e.to))))}>
              Remove {broken} broken
            </button>
          ) : null}
        </div>

        {unexplained.length && chain.length ? (
          <div className="osce-summaryed-gap">
            <b>Not yet explained</b>
            <p className="osce-hint">
              These findings won&rsquo;t appear in the student&rsquo;s Summary &amp; Connect.
              Click one to attach it to a step.
            </p>
            <div className="osce-summaryed-chips">
              {unexplained.map((s) => (
                <button key={s.id} type="button"
                        onClick={() => setEdges([...edges, { from: s.id, to: chain[0].step }])}>
                  {s.name || s.id}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* A read-only look at what the student will see, so the shape is obvious. */}
      {chain.length ? (
        <div className="osce-card">
          <div className="osce-card-head"><b className="osce-long-h">What the student sees</b></div>
          {chain
            .map((step) => ({
              step,
              attached: edges
                .filter((e) => Number(e.to) === Number(step.step))
                .map((e) => signName(e.from))
                .filter(Boolean),
            }))
            .filter((row) => row.attached.length)
            .map((row) => (
              <div key={row.step.step} className="osce-summaryed-prev">
                <b>{row.step.step}. {row.step.title}</b>
                <span>so you find: {row.attached.join(', ')}</span>
              </div>
            ))}
          {!edges.length ? (
            <p className="osce-hint osce-hint--muted">
              Nothing linked yet, so this section is hidden in the app.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function StringList({ title, hint, items, onChange, placeholder }) {
  return (
    <div className="osce-card">
      <div className="osce-card-head"><b className="osce-long-h">{title}</b></div>
      <p className="osce-hint">{hint}</p>
      {items.map((item, i) => (
        <div key={i} className="osce-textrow">
          <input className="osce-input" value={item} placeholder={placeholder}
                 onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} />
          <button type="button" className="osce-btn-danger"
                  onClick={() => onChange(items.filter((_, j) => j !== i))}>×</button>
        </div>
      ))}
      <button type="button" className="osce-add osce-add--sm"
              onClick={() => onChange([...items, ''])}>+ Add</button>
    </div>
  );
}

export default SummaryEditor;
