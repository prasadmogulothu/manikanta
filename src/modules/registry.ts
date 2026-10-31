import type { ComponentType } from 'react';
import type { ModuleProps } from '../lib/types';
import Hero, { fields as heroFields } from './Hero';
import Intro, { fields as introFields } from './Intro';
import Services, { fields as servicesFields } from './Services';
import Gallery, { fields as galleryFields } from './Gallery';
import Contact, { fields as contactFields } from './Contact';

// One entry per section type, and the only place to change when a module is added.
// Tracking, Reviews and Events are ported in Phase 8.
export const MODULES: Record<string, { label: string; Component: ComponentType<ModuleProps>; fields: unknown[] }> = {
  hero: { label: 'Hero banner', Component: Hero, fields: heroFields },
  intro: { label: 'Intro / about', Component: Intro, fields: introFields },
  services: { label: 'Services grid', Component: Services, fields: servicesFields },
  gallery: { label: 'Gallery', Component: Gallery, fields: galleryFields },
  contact: { label: 'Contact & hours', Component: Contact, fields: contactFields },
};
