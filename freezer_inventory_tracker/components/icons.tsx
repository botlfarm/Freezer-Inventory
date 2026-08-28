import React from 'react';

const iconProps = {
  className: "w-5 h-5",
  viewBox: "0 0 20 20",
  fill: "currentColor"
};

export const FreezerIcon: React.FC<{className?: string}> = ({className}) => (
  <svg {...iconProps} className={className || iconProps.className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path fillRule="evenodd" d="M2.25 3.75A1.5 1.5 0 0 1 3.75 2.25h16.5a1.5 1.5 0 0 1 1.5 1.5v16.5a1.5 1.5 0 0 1-1.5 1.5H3.75a1.5 1.5 0 0 1-1.5-1.5V3.75ZM3.75 6H20.25v14.25H3.75V6ZM4.5 3.75a.75.75 0 0 0-.75.75V5.25h16.5V4.5a.75.75 0 0 0-.75-.75H4.5Z" clipRule="evenodd" />
  </svg>
);

export const BoxIcon: React.FC<{className?: string}> = ({className}) => (
  <svg {...iconProps} className={className || iconProps.className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.378 1.602a.75.75 0 0 0-.756 0L3 6.632l9 5.25 9-5.25-8.622-5.03ZM21.75 7.93l-9 5.25v9.32l9-5.25V7.93ZM2.25 7.93v9.32l9 5.25v-9.32l-9-5.25Z" />
  </svg>
);

export const PackageIcon: React.FC<{className?: string}> = ({className}) => (
    <svg {...iconProps} className={className || iconProps.className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M8.25 2.25A.75.75 0 0 1 9 3v.529a9.75 9.75 0 0 1 7.234 8.98c.022.213.048.423.078.632a.75.75 0 0 1-1.49.158 8.25 8.25 0 0 0-6.07-7.58A.75.75 0 0 1 9 5.25V3.75h-.75A.75.75 0 0 1 8.25 2.25Z" clipRule="evenodd" />
      <path fillRule="evenodd" d="M3.75 6A2.25 2.25 0 0 0 1.5 8.25v9A2.25 2.25 0 0 0 3.75 19.5h16.5A2.25 2.25 0 0 0 22.5 17.25v-9A2.25 2.25 0 0 0 20.25 6H3.75ZM3 8.25A1.5 1.5 0 0 1 4.5 6.75h15A1.5 1.5 0 0 1 21 8.25v9A1.5 1.5 0 0 1 19.5 18.75h-15A1.5 1.5 0 0 1 3 17.25v-9Z" clipRule="evenodd" />
    </svg>
);


export const BinIcon: React.FC<{className?: string}> = ({className}) => (
    <svg {...iconProps} className={className || iconProps.className}  xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3.375 4.5C2.339 4.5 1.5 5.34 1.5 6.375V13.5h12V6.375c0-1.036-.84-1.875-1.875-1.875h-8.25ZM22.5 13.5v-7.125c0-1.036-.84-1.875-1.875-1.875h-8.25C11.34 4.5 10.5 5.34 10.5 6.375V13.5h12ZM13.5 15h9.75v5.625c0 1.035-.84 1.875-1.875 1.875h-8.25c-1.035 0-1.875-.84-1.875-1.875V15h2.25Z" />
        <path d="M1.5 15h9.75v5.625c0 1.035-.84 1.875-1.875 1.875h-8.25C.339 22.5 0 21.66 0 20.625V15h1.5Z" />
    </svg>
);

export const PillowcaseIcon: React.FC<{className?: string}> = ({className}) => (
    <svg {...iconProps} className={className || iconProps.className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path fillRule="evenodd" d="M8.25 2.25A.75.75 0 0 1 9 3v.529a9.75 9.75 0 0 1 7.234 8.98c.022.213.048.423.078.632a.75.75 0 0 1-1.49.158 8.25 8.25 0 0 0-6.07-7.58A.75.75 0 0 1 9 5.25V3.75h-.75A.75.75 0 0 1 8.25 2.25Z" clipRule="evenodd" />
        <path fillRule="evenodd" d="M3.75 6A2.25 2.25 0 0 0 1.5 8.25v9A2.25 2.25 0 0 0 3.75 19.5h16.5A2.25 2.25 0 0 0 22.5 17.25v-9A2.25 2.25 0 0 0 20.25 6H3.75ZM3 8.25A1.5 1.5 0 0 1 4.5 6.75h15A1.5 1.5 0 0 1 21 8.25v9A1.5 1.5 0 0 1 19.5 18.75h-15A1.5 1.5 0 0 1 3 17.25v-9Z" clipRule="evenodd" />
    </svg>
);

export const MeatIcon: React.FC<{className?: string}> = ({className}) => (
    <svg {...iconProps} className={className || iconProps.className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.378 1.602a.75.75 0 0 0-.756 0L3 6.632l9 5.25 9-5.25-8.622-5.03Z" />
        <path d="M12 13.25a1.125 1.125 0 1 0 0 2.25 1.125 1.125 0 0 0 0-2.25ZM12 7.5a1.125 1.125 0 1 0 0 2.25A1.125 1.125 0 0 0 12 7.5ZM12.012 17.38a1.125 1.125 0 1 0-.024 2.25 1.125 1.125 0 0 0 .024-2.25Z" />
    </svg>
);

export const PlusIcon: React.FC<{className?: string}> = ({className}) => (
  <svg {...iconProps} className={className || iconProps.className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
    <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
  </svg>
);

export const MinusIcon: React.FC<{className?: string}> = ({className}) => (
  <svg {...iconProps} className={className || iconProps.className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M4 10a.75.75 0 01.75-.75h10.5a.75.75 0 010 1.5H4.75A.75.75 0 014 10z" clipRule="evenodd" />
  </svg>
);

export const HistoryIcon: React.FC<{className?: string}> = ({className}) => (
  <svg {...iconProps} className={className || iconProps.className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
  </svg>
);

export const MoveIcon: React.FC<{className?: string}> = ({className}) => (
  <svg {...iconProps} className={className || iconProps.className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
    <path d="M3.5 4.5a2.5 2.5 0 015 0v2.5a.5.5 0 001 0V4.5a2.5 2.5 0 015 0V15a2.5 2.5 0 01-5 0v-2.5a.5.5 0 00-1 0V15a2.5 2.5 0 01-5 0V4.5z" />
    <path d="M17 6.5a1.5 1.5 0 011.5 1.5v4a1.5 1.5 0 01-1.5 1.5h-1.67l-2.022 2.31a.5.5 0 01-.76 0L8.67 13.5H7a1.5 1.5 0 01-1.5-1.5v-4A1.5 1.5 0 017 6.5h10z" />
  </svg>
);

export const RetireIcon: React.FC<{className?: string}> = ({className}) => (
  <svg {...iconProps} className={className || iconProps.className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-1.157.26-2.128.8-2.9 1.584C1.93 6.822 1 8.362 1 10c0 1.638.93 3.178 2.1 4.218 1.17 1.04 2.607 1.632 4.125 1.772a.75.75 0 00.775-.717V15a.75.75 0 00-.75-.75h-.188A5.002 5.002 0 016.5 11c0-1.52.923-2.844 2.25-3.415a.75.75 0 00.5-1.348V3.75A1.25 1.25 0 0110.5 2.5h2.75a.75.75 0 000-1.5H10.5A2.75 2.75 0 008.75 1zM14.5 9a.75.75 0 000 1.5h.063c.27.026.533.064.792.115l.383.076c.394.078.78.204 1.144.372l.142.066.082.04c.264.128.514.28.748.452l.11.082a5.499 5.499 0 011.83 2.919.75.75 0 101.4-.418A6.991 6.991 0 0015.3 10.1l-.11-.082-.142-.066a7.003 7.003 0 00-1.145-.372l-.383-.076a8.55 8.55 0 00-.792-.115H14.5z" clipRule="evenodd" />
  </svg>
);

export const XIcon: React.FC<{className?: string}> = ({className}) => (
  <svg {...iconProps} className={className || iconProps.className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
  </svg>
);

export const EditIcon: React.FC<{className?: string}> = ({className}) => (
  <svg {...iconProps} className={className || iconProps.className}  xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
    <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
    <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
  </svg>
);

export const SearchIcon: React.FC<{className?: string}> = ({className}) => (
  <svg {...iconProps} className={className || iconProps.className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
  </svg>
);

export const ImageIcon: React.FC<{className?: string}> = ({className}) => (
    <svg {...iconProps} className={className || iconProps.className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M1 5.25A2.25 2.25 0 013.25 3h13.5A2.25 2.25 0 0119 5.25v9.5A2.25 2.25 0 0116.75 17H3.25A2.25 2.25 0 011 14.75v-9.5zm1.5 5.81v3.69c0 .414.336.75.75.75h13.5a.75.75 0 00.75-.75v-2.69l-2.22-2.219a.75.75 0 00-1.06 0l-1.91 1.909-.48- .48a.75.75 0 00-1.06 0l-5.18 5.181zM4.5 7.5a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
);

export const LibraryIcon: React.FC<{className?: string}> = ({className}) => (
    <svg {...iconProps} className={className || iconProps.className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
        <path d="M10 2a.75.75 0 01.75.75v.518a4.503 4.503 0 012.384 3.203l1.834.458a.75.75 0 01.53 1.026l-.587 1.468a.75.75 0 01-1.025.53l-1.834-.458a4.503 4.503 0 01-4.636 0l-1.834.458a.75.75 0 01-1.026-.53l-.586-1.468a.75.75 0 01.53-1.026l1.834-.458A4.503 4.503 0 019.25 3.268V2.75A.75.75 0 0110 2z" />
        <path d="M6.22 10.025a.75.75 0 01-.198 1.05l-1.008.672a.75.75 0 00.198 1.05l1.008.672a.75.75 0 01-.198 1.05l-.001.002a7.5 7.5 0 01-1.984 1.237.75.75 0 01-.86-.967l.38-1.521a.75.75 0 00-.332-.822l-1.33-1.034a.75.75 0 01.564-1.25l1.583-.167a.75.75 0 00.67-.478l.49-1.47a.75.75 0 011.375.458L6.22 10.025z" />
        <path d="M13.78 10.025a.75.75 0 00.198 1.05l1.008.672a.75.75 0 01-.198 1.05l-1.008.672a.75.75 0 00.198 1.05l.001.002a7.5 7.5 0 001.984 1.237.75.75 0 00.86-.967l-.38-1.521a.75.75 0 01.332-.822l1.33-1.034a.75.75 0 00-.564-1.25l-1.583-.167a.75.75 0 01-.67-.478l-.49-1.47a.75.75 0 00-1.375.458L13.78 10.025z" />
    </svg>
);

export const GridViewIcon: React.FC<{className?: string}> = ({className}) => (
    <svg {...iconProps} className={className || iconProps.className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M8.25 3.75A1.5 1.5 0 019.75 2.25h.5A1.5 1.5 0 0111.75 3.75v.5A1.5 1.5 0 0110.25 5.75h-.5A1.5 1.5 0 018.25 4.25v-.5zM6 3.75A1.5 1.5 0 017.5 2.25h.5A1.5 1.5 0 019.5 3.75v.5A1.5 1.5 0 018 5.75h-.5A1.5 1.5 0 016 4.25v-.5zM3.75 6A1.5 1.5 0 002.25 7.5v.5A1.5 1.5 0 003.75 9.5h.5A1.5 1.5 0 005.75 8V7.5A1.5 1.5 0 004.25 6h-.5zM3.75 11.75A1.5 1.5 0 002.25 13.25v.5A1.5 1.5 0 003.75 15.25h.5A1.5 1.5 0 005.75 13.75v-.5A1.5 1.5 0 004.25 11.75h-.5zM6 11.75A1.5 1.5 0 017.5 10.25h.5A1.5 1.5 0 019.5 11.75v.5A1.5 1.5 0 018 13.75h-.5A1.5 1.5 0 016 12.25v-.5zM8.25 11.75A1.5 1.5 0 019.75 10.25h.5A1.5 1.5 0 0111.75 11.75v.5A1.5 1.5 0 0110.25 13.75h-.5A1.5 1.5 0 018.25 12.25v-.5zM11.75 6A1.5 1.5 0 0010.25 7.5v.5A1.5 1.5 0 0011.75 9.5h.5A1.5 1.5 0 0013.75 8V7.5A1.5 1.5 0 0012.25 6h-.5zM14.25 3.75A1.5 1.5 0 0115.75 2.25h.5A1.5 1.5 0 0117.75 3.75v.5A1.5 1.5 0 0116.25 5.75h-.5A1.5 1.5 0 0114.25 4.25v-.5zM11.75 11.75A1.5 1.5 0 0010.25 13.25v.5A1.5 1.5 0 0011.75 15.25h.5A1.5 1.5 0 0013.75 13.75v-.5A1.5 1.5 0 0012.25 11.75h-.5zM14.25 11.75A1.5 1.5 0 0115.75 10.25h.5A1.5 1.5 0 0117.75 11.75v.5A1.5 1.5 0 0116.25 13.75h-.5A1.5 1.5 0 0114.25 12.25v-.5z" clipRule="evenodd" />
    </svg>
);

export const ListViewIcon: React.FC<{className?: string}> = ({className}) => (
    <svg {...iconProps} className={className || iconProps.className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10zm0 5.25a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 01-.75-.75z" clipRule="evenodd" />
    </svg>
);
