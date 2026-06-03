const MEDICAL_INLINE_RE =
  /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)|<(sub|sup)>(.*?)<\/\4>|<abbr\s+title="([^"]+)">(.*?)<\/abbr>|\[abbr:([^|\]]+)\|([^\]]+)\]|\\\((.*?)\\\)|\\\[(.*?)\\\]|\$([^$\n]+)\$|\[\^([^\]]+)\]/gis;

const medicalImageFrameStyle = {
  display: 'block',
  width: 'min(100%, 720px)',
  aspectRatio: '16 / 9',
  margin: '12px 0',
  overflow: 'hidden',
  borderRadius: 12,
  background: 'var(--surface-2)',
};

const medicalImageStyle = {
  display: 'block',
  width: '100%',
  height: '100%',
  objectFit: 'contain',
};

const medicalImageLinkStyle = {
  display: 'block',
  width: '100%',
  height: '100%',
  color: 'inherit',
  textDecoration: 'none',
};

const medicalTableFrameStyle = {
  display: 'block',
  maxWidth: '100%',
  overflowX: 'auto',
  WebkitOverflowScrolling: 'touch',
  margin: '12px 0',
};

const medicalTableStyle = {
  width: '100%',
  minWidth: 420,
  borderCollapse: 'collapse',
};

const medicalCellStyle = {
  border: '1px solid var(--line-soft)',
  padding: '8px 10px',
  textAlign: 'left',
  verticalAlign: 'top',
};

const medicalFormulaStyle = {
  display: 'inline-block',
  maxWidth: '100%',
  overflowX: 'auto',
  verticalAlign: 'baseline',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
};

function isSafeMedicalImageUrl(value) {
  const url = String(value || '').trim();
  if (!url) return false;
  if (/^(?:\/|\.\/|\.\.\/)/.test(url)) return true;
  if (/^data:image\/(?:png|jpe?g|gif|webp|avif|svg\+xml);/i.test(url)) return true;
  if (/^blob:/i.test(url)) return true;

  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeImageLoading(value) {
  return value === 'eager' ? 'eager' : 'lazy';
}

function normalizeFetchPriority(value) {
  return ['high', 'low', 'auto'].includes(value) ? value : undefined;
}

function medicalImageNode(src, alt, title, key, options = {}) {
  const safeSrc = String(src || '').trim();
  const providedLabel = String(alt || title || '').trim();
  const label = providedLabel || 'Question image: no description provided.';
  if (!isSafeMedicalImageUrl(safeSrc)) {
    return `[image: ${label}]`;
  }
  const image = (
    <img
      src={safeSrc}
      alt={label}
      title={title || undefined}
      width="1280"
      height="720"
      loading={normalizeImageLoading(options.imageLoading)}
      decoding="async"
      fetchPriority={normalizeFetchPriority(options.imageFetchPriority)}
      style={medicalImageStyle}
    />
  );

  return (
    <span className="lms-medical-image-frame" key={key} style={medicalImageFrameStyle}>
      {options.imageZoomable ? (
        <a
          href={safeSrc}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open full-size medical image: ${label}`}
          style={medicalImageLinkStyle}
        >
          {image}
        </a>
      ) : image}
      {!providedLabel ? (
        <span className="sr-only">
          This question contains an image, but no medical image description was provided.
        </span>
      ) : null}
    </span>
  );
}

function medicalFormulaNode(value, key) {
  const formula = String(value || '').trim();
  return (
    <span className="lms-medical-formula" key={key} role="math" aria-label={formula} style={medicalFormulaStyle}>
      {formula}
    </span>
  );
}

function medicalAbbreviationNode(label, title, key) {
  return (
    <abbr className="lms-medical-abbreviation" key={key} title={String(title || '').trim()}>
      {String(label || '').trim()}
    </abbr>
  );
}

function medicalReferenceNode(label, key) {
  const value = String(label || '').trim();
  return (
    <sup className="lms-medical-reference-cue" key={key} aria-label={`Reference ${value}`}>
      [{value}]
    </sup>
  );
}

function medicalInlineNodes(value, keyPrefix = 'inline', options = {}) {
  const text = String(value ?? '');
  const nodes = [];
  let cursor = 0;
  let match;

  MEDICAL_INLINE_RE.lastIndex = 0;
  while ((match = MEDICAL_INLINE_RE.exec(text))) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));

    if (match[2]) {
      nodes.push(medicalImageNode(match[2], match[1], match[3], `${keyPrefix}-img-${match.index}`, options));
    } else if (match[4]) {
      const Tag = match[4].toLowerCase();
      nodes.push(<Tag key={`${keyPrefix}-${Tag}-${match.index}`}>{match[5]}</Tag>);
    } else if (match[6]) {
      nodes.push(medicalAbbreviationNode(match[7], match[6], `${keyPrefix}-abbr-${match.index}`));
    } else if (match[8]) {
      nodes.push(medicalAbbreviationNode(match[8], match[9], `${keyPrefix}-abbr-short-${match.index}`));
    } else if (match[10] || match[11] || match[12]) {
      nodes.push(medicalFormulaNode(match[10] || match[11] || match[12], `${keyPrefix}-formula-${match.index}`));
    } else if (match[13]) {
      nodes.push(medicalReferenceNode(match[13], `${keyPrefix}-ref-${match.index}`));
    }

    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

function splitTableRow(line) {
  return String(line || '')
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function isTableSeparator(line) {
  const cells = splitTableRow(line);
  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function isTableStart(lines, index) {
  return (
    String(lines[index] || '').includes('|') &&
    String(lines[index + 1] || '').includes('|') &&
    isTableSeparator(lines[index + 1])
  );
}

function medicalTableNode(lines, startIndex, key, options = {}) {
  const header = splitTableRow(lines[startIndex]);
  const rows = [];
  let index = startIndex + 2;

  while (index < lines.length && String(lines[index] || '').includes('|') && String(lines[index]).trim()) {
    rows.push(splitTableRow(lines[index]));
    index++;
  }

  return {
    nextIndex: index,
    node: (
      <span className="lms-medical-table-frame" key={key} style={medicalTableFrameStyle} role="group" aria-label="Medical reference table">
        <table className="lms-medical-table" style={medicalTableStyle}>
          <thead>
            <tr>
              {header.map((cell, cellIndex) => (
                <th key={`h-${cellIndex}`} scope="col" style={medicalCellStyle}>
                  {medicalInlineNodes(cell, `${key}-h-${cellIndex}`, options)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={`r-${rowIndex}`}>
                {header.map((_, cellIndex) => (
                  <td key={`c-${rowIndex}-${cellIndex}`} style={medicalCellStyle}>
                    {medicalInlineNodes(row[cellIndex] || '', `${key}-r-${rowIndex}-c-${cellIndex}`, options)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </span>
    ),
  };
}

function extractReferenceDefinitions(lines) {
  const references = [];
  const bodyLines = [];

  for (const line of lines) {
    const match = String(line || '').match(/^\s*\[\^([^\]]+)\]:\s*(.+)\s*$/);
    if (match) {
      references.push({ label: match[1].trim(), text: match[2].trim() });
    } else {
      bodyLines.push(line);
    }
  }

  return { bodyLines, references };
}

function medicalReferenceListNode(references, key, options = {}) {
  if (!references.length) return null;
  return (
    <span className="lms-medical-reference-list" key={key} role="list" aria-label="References">
      {references.map((reference) => (
        <span key={reference.label} role="listitem">
          <sup>[{reference.label}]</sup> {medicalInlineNodes(reference.text, `${key}-${reference.label}`, options)}
        </span>
      ))}
    </span>
  );
}

function medicalBlockNodes(value, options = {}) {
  const lines = String(value ?? '').split(/\r?\n/);
  const { bodyLines, references } = extractReferenceDefinitions(lines);
  const nodes = [];
  let paragraph = [];

  const flushParagraph = (index) => {
    if (!paragraph.length) return;
    nodes.push(
      <span className="lms-medical-paragraph" key={`p-${index}`}>
        {medicalInlineNodes(paragraph.join('\n'), `p-${index}`, options)}
      </span>
    );
    paragraph = [];
  };

  for (let index = 0; index < bodyLines.length; index++) {
    const line = bodyLines[index];
    if (isTableStart(bodyLines, index)) {
      flushParagraph(index);
      const table = medicalTableNode(bodyLines, index, `table-${index}`, options);
      nodes.push(table.node);
      index = table.nextIndex - 1;
      continue;
    }

    if (!String(line || '').trim()) {
      flushParagraph(index);
      nodes.push('\n');
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph(bodyLines.length);
  const referenceList = medicalReferenceListNode(references, 'refs', options);
  if (referenceList) nodes.push(referenceList);
  return nodes;
}

function hasBlockMedicalContent(value) {
  const lines = String(value ?? '').split(/\r?\n/);
  return lines.some((line, index) => isTableStart(lines, index)) || lines.some((line) => /^\s*\[\^[^\]]+\]:/.test(line));
}

export function MedicalText({
  as: Component = 'span',
  text,
  children,
  imageLoading = 'lazy',
  imageFetchPriority,
  imageZoomable = false,
  ...props
}) {
  const value = children ?? text;
  const blockContent = hasBlockMedicalContent(value);
  const RenderComponent = blockContent && (Component === 'p' || Component === 'span') ? 'div' : Component;
  const imageOptions = { imageLoading, imageFetchPriority, imageZoomable };
  return (
    <RenderComponent {...props}>
      {blockContent ? medicalBlockNodes(value, imageOptions) : medicalInlineNodes(value, 'inline', imageOptions)}
    </RenderComponent>
  );
}
