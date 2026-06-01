import { Link } from 'react-router-dom';

export function BreadcrumbTrail({ items = [], className = '' }) {
  const visibleItems = items.filter((item) => item?.label);
  if (visibleItems.length === 0) return null;

  return (
    <nav className={`lms-breadcrumb ${className}`.trim()} aria-label="Breadcrumb">
      <ol className="lms-breadcrumb__list">
        {visibleItems.map((item, index) => {
          const isLast = index === visibleItems.length - 1;
          const label = String(item.label);

          return (
            <li className="lms-breadcrumb__item" key={`${label}-${index}`}>
              {index > 0 ? <span className="lms-breadcrumb__separator" aria-hidden="true">/</span> : null}
              {item.to && !isLast ? (
                <Link className="lms-breadcrumb__link" to={item.to} title={label}>
                  {label}
                </Link>
              ) : (
                <span className="lms-breadcrumb__current" aria-current={isLast ? 'page' : undefined} title={label}>
                  {label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
