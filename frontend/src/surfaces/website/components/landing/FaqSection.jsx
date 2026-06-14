/*
 * FaqSection — plain-language answers to the questions students actually ask
 * before signing up. Content lives in faqData.js (shared with the FAQPage
 * JSON-LD). Native <details> so answers are real, crawlable DOM text; calm
 * in-view reveal, no pins.
 */
import { motion } from 'framer-motion';
import { FAQ_ITEMS } from './faqData.js';

function FaqItem({ item, index }) {
  return (
    <motion.details
      className="group border-b border-black/8 py-4"
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ delay: Math.min(index * 0.05, 0.25), duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-[16px] font-bold text-[#111118] md:text-[17px]">
        {item.q}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0 text-[#2563eb] transition-transform duration-300 group-open:rotate-45">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </summary>
      <p className="mt-3 max-w-2xl text-[14.5px] leading-relaxed text-[#4b5563] md:text-[15px]">{item.a}</p>
    </motion.details>
  );
}

export function FaqSection() {
  return (
    <section id="faq" className="lpv2-section bg-[#fafaf7]">
      <div className="lpv2-shell max-w-3xl">
        <motion.div
          className="mb-10 text-center"
          initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}
        >
          <span className="mb-3 inline-block rounded-full bg-[#2563eb]/8 px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.12em] text-[#2563eb]">Questions</span>
          <h2 className="font-display text-[clamp(30px,5vw,48px)] leading-tight text-[#111118]">Everything you’re wondering, answered.</h2>
        </motion.div>
        <div>
          {FAQ_ITEMS.map((item, i) => <FaqItem key={item.q} item={item} index={i} />)}
        </div>
      </div>
    </section>
  );
}

export default FaqSection;
