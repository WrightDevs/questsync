import React from 'react';

const svgProps = (size = 14) => ({
  width: size,
  height: size,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: '1.6',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  className: 'ui-icon',
});

export function IconBack({ size = 14 }) {
  return (
    <svg {...svgProps(size)}>
      <path d="M10.5 3.5L6 8l4.5 4.5" />
    </svg>
  );
}

export function IconReload({ size = 14 }) {
  return (
    <svg {...svgProps(size)}>
      <path d="M13 8a5 5 0 1 1-1.35-3.42" />
      <path d="M13 2.5v2.8h-2.8" />
    </svg>
  );
}

export function IconMonitor({ size = 14 }) {
  return (
    <svg {...svgProps(size)}>
      <rect x="2" y="2.5" width="12" height="11" rx="1.6" />
      <path d="M10 2.5v11" />
    </svg>
  );
}

export function IconAccounts({ size = 14 }) {
  return (
    <svg {...svgProps(size)}>
      <circle cx="6" cy="5.5" r="2.2" />
      <path d="M2 13c0-2 1.7-3.3 4-3.3s4 1.3 4 3.3" />
      <circle cx="11.5" cy="6" r="1.7" />
      <path d="M11 9.9c1.7.2 3 1.3 3 3.1" />
    </svg>
  );
}

export function IconSettings({ size = 14 }) {
  return (
    <svg {...svgProps(size)}>
      <line x1="2.5" y1="4.5" x2="13.5" y2="4.5" />
      <circle cx="6" cy="4.5" r="1.4" fill="var(--bg)" />
      <line x1="2.5" y1="8" x2="13.5" y2="8" />
      <circle cx="10.5" cy="8" r="1.4" fill="var(--bg)" />
      <line x1="2.5" y1="11.5" x2="13.5" y2="11.5" />
      <circle cx="5.5" cy="11.5" r="1.4" fill="var(--bg)" />
    </svg>
  );
}

export function IconCheck({ size = 13 }) {
  return (
    <svg {...svgProps(size)}>
      <path d="M3.2 8.4l3 3 6.6-6.8" />
    </svg>
  );
}

export function IconClose({ size = 13 }) {
  return (
    <svg {...svgProps(size)}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

export function IconMinus({ size = 12 }) {
  return (
    <svg {...svgProps(size)}>
      <path d="M3.5 8h9" />
    </svg>
  );
}

export function IconPlus({ size = 12 }) {
  return (
    <svg {...svgProps(size)}>
      <path d="M8 3.5v9M3.5 8h9" />
    </svg>
  );
}

export function IconPick({ size = 13 }) {
  return (
    <svg {...svgProps(size)}>
      <circle cx="8" cy="8" r="4.5" />
      <circle cx="8" cy="8" r="1.2" fill="currentColor" stroke="none" />
      <path d="M8 1.8v1.7M8 12.5v1.7M1.8 8h1.7M12.5 8h1.7" />
    </svg>
  );
}

export function IconSync({ size = 13 }) {
  return (
    <svg {...svgProps(size)}>
      <path d="M3 6h9.5l-2.3-2.3" />
      <path d="M13 10H3.5l2.3 2.3" />
    </svg>
  );
}

export function IconLogIn({ size = 13 }) {
  return (
    <svg {...svgProps(size)}>
      <path d="M6.5 3H12a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 12 13H6.5" />
      <path d="M2.5 8h7.5M7.5 5.5L10 8l-2.5 2.5" />
    </svg>
  );
}

export function IconArrowRight({ size = 12 }) {
  return (
    <svg {...svgProps(size)}>
      <path d="M3 8h9.5M9.5 4.8L13 8l-3.5 3.2" />
    </svg>
  );
}

export function IconHome({ size = 13 }) {
  return (
    <svg {...svgProps(size)}>
      <path d="M2.5 6.5L8 2l5.5 4.5V13a1 1 0 0 1-1 1h-3v-3.5h-3V14h-3a1 1 0 0 1-1-1V6.5z" />
    </svg>
  );
}

export function IconLogs({ size = 13 }) {
  return (
    <svg {...svgProps(size)}>
      <path d="M3 3.5h10M3 7h10M3 10.5h6" />
      <circle cx="12" cy="11" r="1.5" />
    </svg>
  );
}


