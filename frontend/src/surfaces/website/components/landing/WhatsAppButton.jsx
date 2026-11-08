import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// Fixed number (country code + digits, no "+"). The landing page is fully static
// and never calls the backend, so changing this means rebuilding the frontend.
const WHATSAPP_NUMBER = '375257489987';
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}`;

// How far the visitor has to scroll before the button appears, and how close to the top it
// has to come back before it hides again. The gap between the two (hysteresis) stops it
// flickering when a phone's scroll position wobbles around a single threshold (rubber-band
// bounce at the top, the address bar collapsing).
const SHOW_AFTER_SCROLL_PX = 60;
const HIDE_BELOW_SCROLL_PX = 12;

// The official WhatsApp glyph (24x24 viewBox).
const WHATSAPP_PATH = 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z';

/**
 * Floating "chat on WhatsApp" button for the landing page. It stays out of the way of the
 * hero and only fades in once the visitor starts scrolling.
 */
export function WhatsAppButton({ visible = true }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY || document.documentElement.scrollTop || 0;
      setScrolled((was) => (was ? y > HIDE_BELOW_SCROLL_PX : y > SHOW_AFTER_SCROLL_PX));
    };
    // one update per frame at most, so a fast flick doesn't churn React state
    const onScroll = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const shown = visible && scrolled;

  // Rendered straight into <body>: a `position: fixed` element inside the landing page's
  // transformed/pinned wrappers stops being fixed and jitters while scrolling on phones.
  const button = (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      title="Chat with us on WhatsApp"
      tabIndex={shown ? 0 : -1}
      aria-hidden={shown ? undefined : true}
      style={{ bottom: 'max(20px, env(safe-area-inset-bottom))', willChange: 'transform, opacity', backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: shown ? 'translate3d(0,0,0)' : 'translate3d(0,16px,0)' }}
      className={`fixed right-5 z-40 inline-flex size-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_8px_24px_rgba(37,211,102,0.45)] transition-[opacity,transform] duration-300 ease-out hover:scale-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#25D366]/40 max-[640px]:right-4 max-[640px]:size-12 ${shown ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
    >
      <svg viewBox="0 0 24 24" className="size-8 max-[640px]:size-7" fill="currentColor" aria-hidden="true" focusable="false">
        <path d={WHATSAPP_PATH} />
      </svg>
    </a>
  );

  return typeof document === 'undefined' ? null : createPortal(button, document.body);
}
