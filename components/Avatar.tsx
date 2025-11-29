import React from 'react';

interface AvatarProps {
  src?: string;
  alt?: string;
  className?: string;
  size?: number; // optional override in px
}

const DefaultPersonSVG: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    className={className}
  >
    <path d="M12 12c2.761 0 5-2.686 5-6s-2.239-5-5-5-5 2.239-5 5 2.239 6 5 6zm0 2c-4.418 0-8 2.91-8 6.5V23h16v-2.5c0-3.59-3.582-6.5-8-6.5z" />
  </svg>
);

export const Avatar: React.FC<AvatarProps> = ({ src, alt = 'User', className, size }) => {
  const [broken, setBroken] = React.useState(false);
  const showImage = !!src && !broken;

  if (showImage) {
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        style={size ? { width: size, height: size, borderRadius: '50%' } : {}}
        onError={() => setBroken(true)}
      />
    );
  }

  return (
    <div
      className={className}
      aria-label={alt}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#e5e7eb', // slate-200
        color: '#94a3b8', // slate-400
        borderRadius: '50%',
        overflow: 'hidden',
        width: size ? size : undefined,
        height: size ? size : undefined,
      }}
    >
      <DefaultPersonSVG className="w-full h-full" />
    </div>
  );
};

export default Avatar;
