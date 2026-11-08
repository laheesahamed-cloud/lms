// html2canvas 1.4 can't read modern CSS colour functions (oklch, oklab, lab, lch, color()),
// and Tailwind 4 writes its whole palette in oklch — so every capture threw
// "unsupported color function". This runs on the CLONED document html2canvas renders from
// (its `onclone` hook) and rewrites those colours to plain rgb(a) it understands, including
// the ones on ::before / ::after. The live page is never touched.

const COLOR_PROPERTIES = [
  'color', 'background-color', 'background-image', 'border-top-color', 'border-right-color',
  'border-bottom-color', 'border-left-color', 'outline-color', 'box-shadow', 'text-shadow',
  'text-decoration-color', 'text-emphasis-color', 'caret-color', 'fill', 'stroke',
  '-webkit-text-fill-color', '-webkit-text-stroke-color',
];
const PSEUDOS = ['::before', '::after'];
const MODERN_COLOR = /(?:oklch|oklab|lab|lch|color)\((?:[^()]|\([^()]*\))*\)/;
const MODERN_COLOR_ALL = new RegExp(MODERN_COLOR.source, 'g');

export function fixUnsupportedColors(clonedDocument) {
  const view = clonedDocument?.defaultView;
  if (!view) return;
  const canvas = clonedDocument.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return;

  const cache = new Map();
  // A canvas hands an oklch() colour back as oklch() when you read fillStyle, so read the
  // painted PIXEL instead: that is always plain sRGB.
  const toRgb = (value) => {
    if (cache.has(value)) return cache.get(value);
    let result = 'rgba(0, 0, 0, 0)';
    try {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = '#000';
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data;
      result = `rgba(${red}, ${green}, ${blue}, ${Math.round((alpha / 255) * 1000) / 1000})`;
    } catch {
      // keep the transparent fallback
    }
    cache.set(value, result);
    return result;
  };
  const convert = (value) => value.replace(MODERN_COLOR_ALL, (match) => toRgb(match));

  const pseudoRules = [];
  let counter = 0;

  clonedDocument.querySelectorAll('*').forEach((element) => {
    const computed = view.getComputedStyle(element);
    COLOR_PROPERTIES.forEach((property) => {
      const value = computed.getPropertyValue(property);
      if (value && MODERN_COLOR.test(value)) {
        element.style.setProperty(property, convert(value), 'important');
      }
    });

    PSEUDOS.forEach((pseudo) => {
      const pseudoStyle = view.getComputedStyle(element, pseudo);
      const content = pseudoStyle.getPropertyValue('content');
      if (!content || content === 'none' || content === 'normal') return;
      const declarations = [];
      COLOR_PROPERTIES.forEach((property) => {
        const value = pseudoStyle.getPropertyValue(property);
        if (value && MODERN_COLOR.test(value)) declarations.push(`${property}: ${convert(value)} !important;`);
      });
      if (!declarations.length) return;
      counter += 1;
      element.setAttribute('data-h2c-fix', String(counter));
      pseudoRules.push(`[data-h2c-fix="${counter}"]${pseudo} { ${declarations.join(' ')} }`);
    });
  });

  if (pseudoRules.length) {
    const style = clonedDocument.createElement('style');
    style.textContent = pseudoRules.join('\n');
    clonedDocument.head.appendChild(style);
  }
}
