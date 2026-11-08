// Fixed number (country code + digits, no "+"). The landing page is fully static
// and never calls the backend, so changing this means rebuilding the frontend.
const WHATSAPP_NUMBER = '375257489987';
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}`;

/** Floating "chat on WhatsApp" button for the landing page. */
export function WhatsAppButton({ visible = true }) {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      title="Chat with us on WhatsApp"
      className={`fixed bottom-[max(20px,env(safe-area-inset-bottom))] right-5 z-40 inline-flex size-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_8px_24px_rgba(37,211,102,0.45)] transition duration-300 hover:scale-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#25D366]/40 max-[640px]:right-4 max-[640px]:size-12 ${visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'}`}
    >
      <svg viewBox="0 0 32 32" className="size-7 max-[640px]:size-6" fill="currentColor" aria-hidden="true">
        <path d="M16.04 3C9.4 3 4 8.4 4 15.04c0 2.12.55 4.19 1.6 6.01L4 29l8.12-1.57a12.03 12.03 0 0 0 3.92.66C22.68 28.09 28 22.69 28 16.04 28 9.4 22.68 3 16.04 3Zm0 22.03c-1.2 0-2.38-.32-3.4-.93l-.24-.15-4.82.93.97-4.7-.16-.25a9.97 9.97 0 0 1-1.54-5.33c0-5.5 4.48-9.98 9.99-9.98 5.5 0 9.98 4.48 9.98 9.98 0 5.5-4.47 10.43-9.78 10.43Zm5.47-7.45c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.14-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.22 3.08.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.23 1.36.2 1.88.12.57-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35Z" />
      </svg>
    </a>
  );
}
