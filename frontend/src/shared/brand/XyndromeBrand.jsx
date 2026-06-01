import { cx } from '../styles/tailwindClasses.js';

const brandAssetBase = `${import.meta.env.BASE_URL.replace(/\/?$/, '/')}brand/`;
const logoMarkLightSrc = `${brandAssetBase}xyndrome-logo-mark-light.webp`;
const logoMarkDarkSrc = `${brandAssetBase}xyndrome-logo-mark-dark.webp`;

export function XyndromeLogoMark({ className = '', size = 42, decorative = true, logoVariant = 'auto', style }) {
  const resolvedSize = typeof size === 'number' ? `${size}px` : size;

  return (
    <span
      className={cx(
        'xyndrome-logo-mark',
        logoVariant === 'light' && 'xyndrome-logo-mark--light',
        logoVariant === 'dark' && 'xyndrome-logo-mark--dark',
        className,
      )}
      style={{ '--xyndrome-logo-size': resolvedSize, ...style }}
      aria-hidden={decorative ? 'true' : undefined}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : 'xyndrome logo'}
    >
      <img className="xyndrome-logo-mark__image xyndrome-logo-mark__image--light" src={logoMarkLightSrc} alt="" decoding="async" draggable="false" />
      <img className="xyndrome-logo-mark__image xyndrome-logo-mark__image--dark" src={logoMarkDarkSrc} alt="" decoding="async" draggable="false" />
    </span>
  );
}

export function XyndromeBrand({
  className = '',
  markClassName = '',
  copyClassName = '',
  textClassName = '',
  subtitleClassName = '',
  subtitle = '',
  markSize = 42,
  logoVariant = 'auto',
  style,
}) {
  const resolvedMarkSize = typeof markSize === 'number' ? `${markSize}px` : markSize;
  const hasSubtitle = Boolean(subtitle);
  const accessibleLabel = hasSubtitle ? `xyndrome, ${subtitle}` : 'xyndrome';

  return (
    <div
      className={cx('xyndrome-brand', hasSubtitle ? 'xyndrome-brand--with-subtitle' : 'xyndrome-brand--single-line', className)}
      style={{ '--xyndrome-logo-size': resolvedMarkSize, ...style }}
      role="img"
      aria-label={accessibleLabel}
    >
      <XyndromeLogoMark className={markClassName} size={markSize} logoVariant={logoVariant} />
      <div className={cx('xyndrome-brand__copy', copyClassName)} aria-hidden="true">
        <span className={cx('xyndrome-brand__word', textClassName)}>
          yndrome
        </span>
        {subtitle ? <span className={cx('xyndrome-brand__subtitle', subtitleClassName)}>{subtitle}</span> : null}
      </div>
    </div>
  );
}
