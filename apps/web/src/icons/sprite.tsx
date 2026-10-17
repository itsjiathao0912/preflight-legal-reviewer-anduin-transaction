// Icon sprite copied from design/mockups/app.html (bespoke icons, one stroke weight).
// The logo check mark keeps its mockup color literal; this file sits outside the source-guarded dirs.
export type IconName =
  | 'logo'
  | 'stop'
  | 'warn'
  | 'info'
  | 'check'
  | 'tick'
  | 'ring'
  | 'todo'
  | 'skip'
  | 'chev'
  | 'chevd'
  | 'x'
  | 'eye'
  | 'eyeoff'
  | 'spark'
  | 'rule'
  | 'memory'
  | 'counsel'
  | 'lock'
  | 'unlock'
  | 'undo'
  | 'list'
  | 'tree'
  | 'compare'
  | 'doc'
  | 'panel'
  | 'filter'
  | 'jump'
  | 'plus'
  | 'upload'
  | 'file'
  | 'scan'
  | 'shield'
  | 'folder'
  | 'clock'
  | 'edit'
  | 'pin'
  | 'down';

export function IconSprite() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <symbol id="logo" viewBox="0 0 28 28">
        <rect x="2" y="2" width="24" height="24" rx="5" fill="var(--ink)" />
        <path
          d="M8 9.5h7M8 14h4.5M8 18.5h5"
          stroke="var(--ground)"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M15.5 17l2.6 2.6L22 14.6"
          stroke="#8FD0C6"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </symbol>
      <symbol id="stop" viewBox="0 0 24 24">
        <path d="M8.2 3h7.6L21 8.2v7.6L15.8 21H8.2L3 15.8V8.2z" />
        <path d="M12 7.5v5.2M12 16h.01" />
      </symbol>
      <symbol id="warn" viewBox="0 0 24 24">
        <path d="M12 3.5l9.2 16H2.8z" />
        <path d="M12 10v4.4M12 17.2h.01" />
      </symbol>
      <symbol id="info" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5.2M12 7.8h.01" />
      </symbol>
      <symbol id="check" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" />
        <path d="M7.8 12.4l2.9 2.9 5.6-6" />
      </symbol>
      <symbol id="tick" viewBox="0 0 24 24">
        <path d="M5.500 12.500l4.200 4.200 8.800-9.200" />
      </symbol>
      <symbol id="ring" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" strokeDasharray="14 8" />
      </symbol>
      <symbol id="todo" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" strokeDasharray="1.5 4.5" />
      </symbol>
      <symbol id="skip" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12h8" />
      </symbol>
      <symbol id="chev" viewBox="0 0 24 24">
        <path d="M9 6l6 6-6 6" />
      </symbol>
      <symbol id="chevd" viewBox="0 0 24 24">
        <path d="M6 9l6 6 6-6" />
      </symbol>
      <symbol id="x" viewBox="0 0 24 24">
        <path d="M6 6l12 12M18 6L6 18" />
      </symbol>
      <symbol id="eye" viewBox="0 0 24 24">
        <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
        <circle cx="12" cy="12" r="2.8" />
      </symbol>
      <symbol id="eyeoff" viewBox="0 0 24 24">
        <path d="M3 3l18 18" />
        <path d="M10 6a9 9 0 012-.5c6 0 9.500 6.500 9.500 6.500a15 15 0 01-3 3.800M6.200 7.600A15 15 0 002.500 12S6 18.500 12 18.500c1.200 0 2.300-.3 3.300-.7" />
      </symbol>
      <symbol id="spark" viewBox="0 0 24 24">
        <path d="M12 3c.6 4.800 2.200 6.400 7 7-4.800.6-6.400 2.200-7 7-.6-4.800-2.200-6.400-7-7 4.800-.6 6.400-2.200 7-7z" />
      </symbol>
      <symbol id="rule" viewBox="0 0 24 24">
        <path d="M8 4H6.500A1.500 1.500 0 005 5.500v13A1.500 1.500 0 006.500 20H8M16 4h1.500A1.500 1.500 0 0119 5.500v13a1.500 1.500 0 01-1.500 1.500H16" />
        <path d="M9.500 12h5" />
      </symbol>
      <symbol id="memory" viewBox="0 0 24 24">
        <path d="M4 12a8 8 0 108-8 8 8 0 00-6 2.700" />
        <path d="M4 4v3.500h3.500M12 8v4.200l2.800 1.700" />
      </symbol>
      <symbol id="counsel" viewBox="0 0 24 24">
        <path d="M4 5.500A1.500 1.500 0 015.500 4h13A1.500 1.500 0 0120 5.500v9a1.500 1.500 0 01-1.500 1.500H11l-4.500 4v-4h-1A1.500 1.500 0 014 14.500z" />
        <path d="M10.200 8.800a1.900 1.900 0 113 1.500c-.7.500-1.200.8-1.200 1.600M12 13.700h.01" />
      </symbol>
      <symbol id="lock" viewBox="0 0 24 24">
        <rect x="5" y="10.500" width="14" height="9.500" rx="2" />
        <path d="M8.500 10.500V8a3.500 3.500 0 017 0v2.500M12 14.500v2" />
      </symbol>
      <symbol id="unlock" viewBox="0 0 24 24">
        <rect x="5" y="10.500" width="14" height="9.500" rx="2" />
        <path d="M8.500 10.500V8a3.500 3.500 0 016.700-1.400M12 14.500v2" />
      </symbol>
      <symbol id="undo" viewBox="0 0 24 24">
        <path d="M9 7L4.500 11.500 9 16" />
        <path d="M5 11.500h8.500A5.500 5.500 0 0119 17v1" />
      </symbol>
      <symbol id="list" viewBox="0 0 24 24">
        <path d="M4 7h2M9 7h11M4 12h2M9 12h11M4 17h2M9 17h7" />
      </symbol>
      <symbol id="tree" viewBox="0 0 24 24">
        <rect x="4" y="3.500" width="7" height="5" rx="1.200" />
        <rect x="13" y="10" width="7" height="4.500" rx="1.200" />
        <rect x="13" y="16.500" width="7" height="4.500" rx="1.200" />
        <path d="M7.500 8.500v9.200a1 1 0 001 1H13M7.500 12.200H13" />
      </symbol>
      <symbol id="compare" viewBox="0 0 24 24">
        <rect x="3.500" y="4.500" width="7" height="15" rx="1.500" />
        <rect x="13.500" y="4.500" width="7" height="15" rx="1.500" />
        <path d="M6 9.500h2M16 9.500h2M16 13h2" />
      </symbol>
      <symbol id="doc" viewBox="0 0 24 24">
        <path d="M7 3.500h6.500L19 9v10.500a1 1 0 01-1 1H7a1 1 0 01-1-1v-15a1 1 0 011-1z" />
        <path d="M13.500 3.500V9H19M9 13h6M9 16.500h6" />
      </symbol>
      <symbol id="panel" viewBox="0 0 24 24">
        <rect x="3.500" y="4.500" width="17" height="15" rx="2" />
        <path d="M9.500 4.500v15" />
      </symbol>
      <symbol id="filter" viewBox="0 0 24 24">
        <path d="M4 7h9M19 7h1M4 17h1M11 17h9" />
        <circle cx="16" cy="7" r="2.200" />
        <circle cx="8" cy="17" r="2.200" />
      </symbol>
      <symbol id="jump" viewBox="0 0 24 24">
        <path d="M5 5h9M5 10h14M5 15h9M5 20h14" />
      </symbol>
      <symbol id="plus" viewBox="0 0 24 24">
        <path d="M12 5v14M5 12h14" />
      </symbol>
      <symbol id="clock" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5.300l3.200 2" />
      </symbol>
      <symbol id="upload" viewBox="0 0 24 24">
        <path d="M12 15.500V4.500M7.500 9L12 4.500 16.500 9" />
        <path d="M4.500 15.500V18a1.500 1.500 0 001.500 1.500h12a1.500 1.500 0 001.500-1.500v-2.500" />
      </symbol>
      <symbol id="file" viewBox="0 0 24 24">
        <path d="M7 3.500h6.500L18.500 8.500v10A1.500 1.500 0 0117 20H7a1.500 1.500 0 01-1.500-1.500v-13A1.500 1.500 0 017 3.500z" />
        <path d="M13.500 3.500v5h5M8.500 13h7M8.500 16.500h5" />
      </symbol>
      <symbol id="scan" viewBox="0 0 24 24">
        <path d="M4 8V5.500A1.500 1.500 0 015.500 4H8M16 4h2.500A1.500 1.500 0 0120 5.500V8M20 16v2.500a1.500 1.500 0 01-1.500 1.500H16M8 20H5.500A1.500 1.500 0 014 18.500V16" />
        <path d="M4 12h16" />
      </symbol>
      <symbol id="shield" viewBox="0 0 24 24">
        <path d="M12 3.500l7 2.500v5.500c0 4.200-3 7.500-7 9-4-1.500-7-4.800-7-9V6z" />
        <path d="M9 12l2.200 2.200L15.200 10" />
      </symbol>
      <symbol id="folder" viewBox="0 0 24 24">
        <path d="M3.500 7A1.500 1.500 0 015 5.500h4l2 2.500h8A1.500 1.500 0 0120.500 9.500v8A1.500 1.500 0 0119 19H5a1.500 1.500 0 01-1.500-1.500z" />
      </symbol>
      <symbol id="edit" viewBox="0 0 24 24">
        <path d="M4 20h4L19 9a2.100 2.100 0 00-3-3L5 17z" />
        <path d="M14 8l3 3" />
      </symbol>
      <symbol id="pin" viewBox="0 0 24 24">
        <path d="M12 21s6.500-5.800 6.500-11A6.500 6.500 0 005.500 10c0 5.200 6.500 11 6.500 11z" />
        <circle cx="12" cy="10" r="2.200" />
      </symbol>
      <symbol id="down" viewBox="0 0 24 24">
        <path d="M12 4v11M7.500 11l4.500 4.500 4.500-4.500M5 20h14" />
      </symbol>
    </svg>
  );
}
