/* Inline SVG icon set, ported from site/sections.js.
 *
 * Inline rather than an icon font or a sprite sheet: they inherit
 * currentColor, so a template restyles them by setting a token and nothing
 * here needs to know. No CSS of its own, like every module (R12). */

const STAR =
  'M12 3.5l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 10l6.1-.9z';

const ICONS: Record<string, string[]> = {
  box: ['M3 8l9-4 9 4v8l-9 4-9-4z', 'M3 8l9 4 9-4', 'M12 12v8'],
  wrench: ['M15 3a5 5 0 00-4.5 7.2L3 17.7 6.3 21l7.5-7.5A5 5 0 1015 3z'],
  check: ['M4 12.5l5 5L20 6.5'],
  bell: ['M6 9a6 6 0 0112 0c0 5 2 6 2 6H4s2-1 2-6z', 'M10 20h4'],
  clock: ['M3 12a9 9 0 1018 0a9 9 0 10-18 0', 'M12 7v5.5l3.5 2'],
  pin: ['M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z', 'M9 10a3 3 0 1 0 6 0a3 3 0 1 0-6 0'],
  phone: ['M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z'],
  tv: ['M3 6h18v11H3z', 'M8 21h8', 'M12 17v4'],
  bolt: ['M13 2L4 14h7l-1 8 9-12h-7z'],
  scissors: [
    'M6 4l12 12',
    'M18 4L6 16',
    'M4 18a2 2 0 104 0a2 2 0 10-4 0',
    'M16 18a2 2 0 104 0a2 2 0 10-4 0'
  ],
  cart: ['M3 4h2l2.5 11h10L20 7H6', 'M9 20a1 1 0 102 0a1 1 0 10-2 0', 'M16 20a1 1 0 102 0a1 1 0 10-2 0'],
  heart: ['M12 20s-7-4.5-7-9.5A3.5 3.5 0 0112 8a3.5 3.5 0 017 2.5c0 5-7 9.5-7 9.5z'],
  star: [STAR],
  tool: ['M14.7 6.3a4 4 0 01-5 5L5 16v3h3l4.7-4.7a4 4 0 015-5z'],
  message: ['M7.9 20A9 9 0 1 0 4 16.1L2 22Z'],
  leaf: ['M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z',
         'M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12'],
  scale: ['m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z', 'm2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z',
          'M7 21h10', 'M12 3v18', 'M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2'],
  'heart-pulse': ['M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z',
                  'M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27'],
  shield: ['M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z',
           'M9 12h6', 'M12 9v6'],
  sprout: ['M7 20h10', 'M10 20c5.5-2.5.8-6.4 3-10',
           'M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z',
           'M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z']
};

export const ICON_NAMES = Object.keys(ICONS);

export function Icon({ name, size = 22 }: { name: string; size?: number }) {
  const paths = ICONS[name] || ICONS.tool;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={size >= 40 ? 1.6 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

