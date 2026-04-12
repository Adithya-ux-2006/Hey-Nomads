import React from 'react';
import { resolveMediaUrl } from '../utils/api';

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

const UserAvatar = ({ src, name = '', size = 'md', className = '' }) => {
  const { outer, text } = sizeMap[size] || sizeMap.md;
  const initial = name?.[0]?.toUpperCase() || '?';
  const color = COLORS[hashName(name) % COLORS.length];

  const resolvedSrc = src ? resolveMediaUrl(src) : null;

  return (
    <div
      className={`${outer} rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 ${className}`}
      style={!resolvedSrc ? { backgroundColor: color } : undefined}
    >
      {resolvedSrc ? (
        <img
          src={resolvedSrc}
          alt={name}
          className="w-full h-full object-cover"
          onError={e => {
            e.target.style.display = 'none';
            e.target.parentNode.style.backgroundColor = color;
          }}
        />
      ) : (
        <span className={`${text} font-bold text-white select-none`}>{initial}</span>
      )}
    </div>
  );
};

export default UserAvatar;
