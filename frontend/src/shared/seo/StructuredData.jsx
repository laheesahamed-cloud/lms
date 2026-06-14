/*
 * StructuredData — injects JSON-LD into <head> for rich results / SEO.
 * Mirrors PageMeta's upsert-and-cleanup pattern. Emits SoftwareApplication +
 * Organization, and (optionally) an FAQPage built from the passed faqs.
 * Render once on a page; pass a stable `id` so it can be swapped per route.
 */
import { useEffect } from 'react';

const SITE_URL = String(import.meta.env.VITE_PUBLIC_WEBSITE_URL || '').trim().replace(/\/+$/, '');

export function StructuredData({
  id = 'ld-default',
  name = 'xyndrome',
  description = 'A medical learning platform for Sri Lankan students — structured notes and canvas, exam-style MCQs with explanations, high-yield flashcards, AI notes, timed mock exams and subject mastery tracking, all in one place.',
  faqs = [],
}) {
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const graph = [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL || ''}/#organization`,
        name,
        url: SITE_URL || undefined,
      },
      {
        '@type': 'SoftwareApplication',
        name,
        applicationCategory: 'EducationalApplication',
        operatingSystem: 'Web, iOS, Android',
        description,
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'LKR',
          description: 'Free trial available',
        },
      },
    ];

    if (faqs.length > 0) {
      graph.push({
        '@type': 'FAQPage',
        mainEntity: faqs.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      });
    }

    const payload = { '@context': 'https://schema.org', '@graph': graph };

    const elementId = `structured-data-${id}`;
    let script = document.getElementById(elementId);
    if (!script) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      script.id = elementId;
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(payload);

    return () => {
      script?.parentNode?.removeChild(script);
    };
  }, [id, name, description, faqs]);

  return null;
}

export default StructuredData;
