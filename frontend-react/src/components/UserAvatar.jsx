import React from 'react';
import { resolveMediaUrl } from '../lib/api';

const sizeMap = {
  xs:  { outer: 'w-8 h-8',   text: 'text-xs'  },
  sm:  { outer: 'w-10 h-10', text: 'text-sm'  },
  md:  { outer: 'w-14 h-14', text: 'text-base' },
  lg:  { outer: 'w-20 h-20', text: 'text-xl'  },
  xl:  { outer: 'w-28 h-28', text: 'text-3xl' },
};

const COLORS = [
  '#FFB7A5','#A8D5BA','#FFD89B','#B7D4FF',
  '#FFBCD1','#C5B7FF','#FFB7A5','#87DDD2',
];

function hashName(name = '') {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return Math.abs(h);
}

// `fill` is for the full-bleed hero image at the top of a roommate card, where
// the surrounding container decides the box. Without it the card passed
// `w-full h-full` through className, which won over this component's own
// `w-14 h-14` and stretched the avatar into a full-height ellipse once
// `rounded-full` was applied.
const UserAvatar = ({ src, name = '', size = 'md', fill = false, className = '' }) => {
  const { outer, text } = sizeMap[size] || sizeMap.md;
  const initial = name?.[0]?.toUpperCase() || '?';
  const color = COLORS[hashName(name) % COLORS.length];

  const resolvedSrc = src ? resolveMediaUrl(src) : null;

  const box = fill
    ? 'w-full h-full'
    : `${outer} rounded-full flex-shrink-0`;

  return (
    <div
      className={`flex items-center justify-center overflow-hidden ${box} ${className}`}
      // A full-bleed hero should not become a saturated pastel slab. It falls
      // back to the neutral surface the card already provides, with a muted
      // initial, which keeps the contrast readable at that size.
      style={!resolvedSrc && !fill ? { backgroundColor: color } : undefined}
    >
      {resolvedSrc ? (
        <img
          src={resolvedSrc}
          alt={name}
          className="w-full h-full object-cover"
          onError={e => {
            e.target.style.display = 'none';
            if (!fill) e.target.parentNode.style.backgroundColor = color;
          }}
        />
      ) : (
        <span
          className={fill
            ? 'text-5xl font-semibold text-text-muted select-none'
            : `${text} font-bold text-white select-none`}
        >
          {initial}
        </span>
      )}
    </div>
  );
};

export default UserAvatar;
