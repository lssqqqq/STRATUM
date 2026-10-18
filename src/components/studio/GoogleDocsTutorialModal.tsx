import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, BookOpen, HelpCircle, Info } from 'lucide-react';

interface GoogleDocsTutorialModalProps {
  onClose: () => void;
}

export const GoogleDocsTutorialModal: React.FC<GoogleDocsTutorialModalProps> = ({
  onClose
}) => {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Prevent background body scrolling when modal is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-modal-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 md:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Modal Dialog Card: Compact, strictly centered, fits cleanly within site viewport */}
      <div className="relative w-[94vw] max-w-[620px] max-h-[82vh] flex flex-col bg-[#0d0d11] border border-neutral-800 rounded-3xl shadow-2xl text-neutral-100 overflow-hidden font-sans my-auto">
        
        {/* SVG Definition Library for Symbols used across steps */}
        <svg width="0" height="0" className="absolute pointer-events-none" aria-hidden="true">
          <defs>
            <symbol id="gdoc-menu" viewBox="0 0 520 70">
              <g fontFamily="Arial, sans-serif" fontSize="13" fill="#444">
                <text x="20" y="57">File</text>
                <text x="60" y="57">Edit</text>
                <text x="100" y="57">View</text>
                <text x="144" y="57">Insert</text>
                <text x="196" y="57">Format</text>
                <text x="252" y="57">Tools</text>
                <text x="300" y="57">Help</text>
              </g>
            </symbol>
            <symbol id="gdoc-drop" viewBox="0 0 520 260">
              <rect x="12" y="62" width="230" height="186" rx="6" fill="#fff" stroke="#c9cdd6" />
              <g fontFamily="Arial, sans-serif" fontSize="13" fill="#222">
                <text x="28" y="84">Share</text>
                <text x="28" y="105">Make a copy</text>
                <text x="28" y="126">Download</text>
                <text x="28" y="147">Rename</text>
                <text x="28" y="168">Save as Google document</text>
                <text x="28" y="189">Version history</text>
                <text x="28" y="210">Page setup</text>
                <text x="28" y="231">Print</text>
              </g>
            </symbol>
          </defs>
        </svg>

        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-5 sm:px-7 py-4 border-b border-neutral-800 bg-[#0d0d11]/95 backdrop-blur sticky top-0 z-20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-300">
              <BookOpen className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block">
                STRATUM Tutorial
              </span>
              <span className="text-sm font-bold text-white tracking-tight">
                Google Docs &amp; Pageless Guide
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body (Full, complete, unabridged content) */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-5 space-y-6 text-neutral-200 scroll-smooth overscroll-contain">
          
          {/* Main Title & Lead Intro */}
          <div className="space-y-1.5">
            <h1 id="tutorial-modal-title" className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Open your strategy in Google Docs
            </h1>
            <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
              Your download is a <b className="text-neutral-200 font-mono">.docx</b> file. Two quick changes make it a normal Google Doc with no page breaks. The <span className="text-[#ff4d6d] font-bold">red frames</span> show where to click.
            </p>
          </div>

          {/* ================= PART 1 ================= */}
          <div className="space-y-5 pt-1">
            <h2 className="text-lg sm:text-xl font-extrabold text-purple-400 tracking-tight border-b border-neutral-800 pb-2">
              Part 1. Turn the .docx into a Google Doc
            </h2>

            {/* Part 1 — Step 1 */}
            <section className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-4 sm:p-5 space-y-3.5">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>1. Click &ldquo;File&rdquo;, then &ldquo;Save as Google document&rdquo;</span>
              </h3>
              <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                Upload the downloaded file to Google Drive and open it. A <b className="text-white">.DOCX</b> badge next to the name means it is still a Word file. Click <b className="text-white">File</b> in the top menu, then choose <b className="text-white">Save as Google document</b>.
              </p>

              {/* Step 1 Visual Drawing — Complete Google Docs File Menu with Red Highlight Frame */}
              <div className="flex justify-center pt-1">
                <svg
                  className="w-full max-w-[320px] rounded-xl border border-neutral-700/60 shadow-xl overflow-hidden bg-white"
                  viewBox="0 0 366 713"
                  role="img"
                  aria-label="Google Docs File menu with Save as Google document highlighted"
                >
                  <defs>
                    <filter id="p1-shadow" x="-5%" y="-2%" width="115%" height="106%">
                      <feDropShadow dx="0" dy="3" stdDeviation="6" floodColor="#000" floodOpacity="0.18" />
                    </filter>
                  </defs>

                  {/* Top Bar Background */}
                  <rect width="366" height="713" fill="#f9fbfd" />
                  <rect width="366" height="66" fill="#edf2fa" />

                  {/* Left Rail Icons (Search icon & List icon) */}
                  <g transform="translate(14, 108)">
                    <circle cx="12" cy="12" r="7" fill="none" stroke="#444746" strokeWidth="1.8" />
                    <line x1="17" y1="17" x2="22" y2="22" stroke="#444746" strokeWidth="2" strokeLinecap="round" />
                  </g>
                  <g transform="translate(14, 212)">
                    <circle cx="12" cy="12" r="12" fill="#d3e3fd" />
                    <line x1="7" y1="9" x2="17" y2="9" stroke="#041e49" strokeWidth="1.5" strokeLinecap="round" />
                    <line x1="7" y1="12" x2="17" y2="12" stroke="#041e49" strokeWidth="1.5" strokeLinecap="round" />
                    <line x1="7" y1="15" x2="17" y2="15" stroke="#041e49" strokeWidth="1.5" strokeLinecap="round" />
                  </g>

                  {/* Top Bar: Icon, Title, .DOCX badge, Star, Folder, Cloud */}
                  <g transform="translate(8, 10)">
                    {/* Blue Google Docs Document Icon */}
                    <path d="M2 0 L15 0 L21 6 L21 24 C21 25.1 20.1 26 19 26 L2 26 C0.9 26 0 25.1 0 24 L0 2 C0 0.9 0.9 0 2 0 Z" fill="#2684fc" />
                    <path d="M15 0 L21 6 L15 6 Z" fill="#a8c7fa" />
                    <rect x="4" y="9" width="13" height="2" rx="1" fill="#ffffff" />
                    <rect x="4" y="13" width="13" height="2" rx="1" fill="#ffffff" />
                    <rect x="4" y="17" width="8" height="2" rx="1" fill="#ffffff" />

                    {/* Title */}
                    <text x="29" y="18" fontFamily="Arial, sans-serif" fontSize="16" fontWeight="500" fill="#1f1f1f">My STRATEGY</text>

                    {/* .DOCX Badge */}
                    <rect x="154" y="5" width="46" height="18" rx="3" fill="#0b57d0" />
                    <text x="159" y="18" fontFamily="Arial, sans-serif" fontSize="10.5" fontWeight="700" fill="#ffffff">.DOCX</text>

                    {/* Star Icon */}
                    <path d="M216 14 L218 8 L220 14 L226 15 L221 19 L223 25 L218 21 L213 25 L215 19 L210 15 Z" transform="scale(0.6) translate(145, -2)" fill="none" stroke="#444746" strokeWidth="1.5" strokeLinejoin="round" />
                    
                    {/* Move folder */}
                    <path d="M242 8 L247 8 L249 10 L256 10 C257 10 258 11 258 12 L258 20 C258 21 257 22 256 22 L242 22 C241 22 240 21 240 20 L240 10 C240 9 241 8 242 8 Z" fill="none" stroke="#444746" strokeWidth="1.3" />
                    <path d="M245 15 L252 15 M250 12 L253 15 L250 18" fill="none" stroke="#444746" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />

                    {/* Cloud Icon */}
                    <path d="M272 17 C270.5 17 269 16 269 14.5 C269 13 270.5 11.5 272 11.5 C272.5 9.8 274.5 8.5 276.5 8.5 C279.5 8.5 281 10.2 281 12.5 C282.5 13 283.5 14.2 283.5 15.5 C283.5 17 282 17 281 17 Z" fill="none" stroke="#444746" strokeWidth="1.3" />
                  </g>

                  {/* Menu Bar Row */}
                  <g transform="translate(34, 40)">
                    {/* Active File Tab with subtle gray fill */}
                    <rect x="0" y="0" width="36" height="24" rx="4" fill="#e8eaed" />
                    <text x="8" y="16" fontFamily="Arial, sans-serif" fontSize="13" fontWeight="500" fill="#1f1f1f">File</text>
                    
                    <text x="44" y="16" fontFamily="Arial, sans-serif" fontSize="13" fill="#444746">Edit</text>
                    <text x="84" y="16" fontFamily="Arial, sans-serif" fontSize="13" fill="#444746">View</text>
                    <text x="126" y="16" fontFamily="Arial, sans-serif" fontSize="13" fill="#444746">Insert</text>
                    <text x="176" y="16" fontFamily="Arial, sans-serif" fontSize="13" fill="#444746">Format</text>
                    <text x="234" y="16" fontFamily="Arial, sans-serif" fontSize="13" fill="#444746">Tools</text>
                    <text x="280" y="16" fontFamily="Arial, sans-serif" fontSize="13" fill="#444746">Help</text>
                  </g>

                  {/* Open Dropdown Menu Container */}
                  <g transform="translate(34, 66)" filter="url(#p1-shadow)">
                    <rect width="316" height="638" rx="8" fill="#ffffff" stroke="#dadce0" strokeWidth="1" />

                    {/* 1. Create */}
                    <g transform="translate(14, 25)">
                      <rect x="0" y="-12" width="14" height="15" rx="1.5" fill="none" stroke="#444746" strokeWidth="1.4" />
                      <line x1="4" y1="-5" x2="10" y2="-5" stroke="#444746" strokeWidth="1.4" />
                      <text x="24" y="0" fontFamily="Arial, sans-serif" fontSize="13" fill="#1f1f1f">Create</text>
                      <path d="M280 -4 L285 0 L280 4" fill="#444746" />
                    </g>

                    {/* 2. Open */}
                    <g transform="translate(14, 56)">
                      <path d="M0 -11 L5 -11 L7 -9 L13 -9 C14 -9 14.5 -8.5 14.5 -8 L14.5 -2 C14.5 -1.5 14 -1 13 -1 L1 -1 C0.5 -1 0 -1.5 0 -2 Z" fill="none" stroke="#444746" strokeWidth="1.4" />
                      <text x="24" y="0" fontFamily="Arial, sans-serif" fontSize="13" fill="#1f1f1f">Open</text>
                      <text x="248" y="-1" fontFamily="Arial, sans-serif" fontSize="11" fill="#747775">Ctrl+O</text>
                    </g>

                    {/* 3. Create a copy */}
                    <g transform="translate(14, 87)">
                      <rect x="3" y="-12" width="12" height="14" rx="1" fill="none" stroke="#444746" strokeWidth="1.4" />
                      <path d="M0 -8 L0 4 L11 4" fill="none" stroke="#444746" strokeWidth="1.4" />
                      <text x="24" y="0" fontFamily="Arial, sans-serif" fontSize="13" fill="#1f1f1f">Create a copy</text>
                    </g>

                    {/* 4. Save as Google document */}
                    <g transform="translate(14, 118)">
                      <rect x="1" y="-12" width="13" height="14" rx="1" fill="none" stroke="#444746" strokeWidth="1.4" />
                      <path d="M7 -9 L7 0 M4 -3 L7 0 L10 -3" fill="none" stroke="#444746" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                      <text x="24" y="0" fontFamily="Arial, sans-serif" fontSize="13" fontWeight="600" fill="#1f1f1f">Save as Google document</text>
                    </g>

                    {/* Divider 1 */}
                    <line x1="0" y1="138" x2="316" y2="138" stroke="#e1e3e1" strokeWidth="1" />

                    {/* 5. Share */}
                    <g transform="translate(14, 163)">
                      <circle cx="5" cy="-8" r="3.5" fill="none" stroke="#444746" strokeWidth="1.4" />
                      <path d="M0 1 C0 -2 2 -3.5 5 -3.5 C8 -3.5 10 -2 10 1" fill="none" stroke="#444746" strokeWidth="1.4" />
                      <line x1="12" y1="-5" x2="16" y2="-5" stroke="#444746" strokeWidth="1.4" />
                      <line x1="14" y1="-7" x2="14" y2="-3" stroke="#444746" strokeWidth="1.4" />
                      <text x="24" y="0" fontFamily="Arial, sans-serif" fontSize="13" fill="#1f1f1f">Share</text>
                      <path d="M280 -4 L285 0 L280 4" fill="#444746" />
                    </g>

                    {/* 6. Email */}
                    <g transform="translate(14, 194)">
                      <rect x="0" y="-10" width="15" height="11" rx="1" fill="none" stroke="#444746" strokeWidth="1.4" />
                      <path d="M0 -9 L7.5 -4 L15 -9" fill="none" stroke="#444746" strokeWidth="1.4" strokeLinejoin="round" />
                      <text x="24" y="0" fontFamily="Arial, sans-serif" fontSize="13" fill="#1f1f1f">Email</text>
                      <path d="M280 -4 L285 0 L280 4" fill="#444746" />
                    </g>

                    {/* 7. Download */}
                    <g transform="translate(14, 225)">
                      <path d="M7.5 -11 L7.5 0 M4 -3.5 L7.5 0 L11 -3.5" fill="none" stroke="#444746" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                      <line x1="1" y1="2" x2="14" y2="2" stroke="#444746" strokeWidth="1.4" strokeLinecap="round" />
                      <text x="24" y="0" fontFamily="Arial, sans-serif" fontSize="13" fill="#1f1f1f">Download</text>
                      <path d="M280 -4 L285 0 L280 4" fill="#444746" />
                    </g>

                    {/* 8. Record video */}
                    <g transform="translate(14, 256)">
                      <circle cx="7.5" cy="-4.5" r="6.5" fill="none" stroke="#444746" strokeWidth="1.4" />
                      <circle cx="7.5" cy="-4.5" r="2.5" fill="#444746" />
                      <text x="24" y="0" fontFamily="Arial, sans-serif" fontSize="13" fill="#1f1f1f">Record video</text>
                      <rect x="254" y="-11" width="32" height="16" rx="8" fill="#0b57d0" />
                      <text x="261" y="1" fontFamily="Arial, sans-serif" fontSize="9.5" fontWeight="700" fill="#ffffff">New</text>
                    </g>

                    {/* Divider 2 */}
                    <line x1="0" y1="276" x2="316" y2="276" stroke="#e1e3e1" strokeWidth="1" />

                    {/* 9. Rename */}
                    <g transform="translate(14, 301)">
                      <path d="M1 -1 L4 0 L11 -8 L8 -11 L1 -3 Z" fill="none" stroke="#444746" strokeWidth="1.4" strokeLinejoin="round" />
                      <line x1="0" y1="2" x2="13" y2="2" stroke="#444746" strokeWidth="1.2" />
                      <text x="24" y="0" fontFamily="Arial, sans-serif" fontSize="13" fill="#1f1f1f">Rename</text>
                    </g>

                    {/* 10. Move */}
                    <g transform="translate(14, 332)">
                      <path d="M0 -11 L5 -11 L7 -9 L13 -9 C14 -9 14.5 -8.5 14.5 -8 L14.5 -2 C14.5 -1.5 14 -1 13 -1 L1 -1 C0.5 -1 0 -1.5 0 -2 Z" fill="none" stroke="#444746" strokeWidth="1.4" />
                      <path d="M4 -5 L9 -5 M7 -7 L9 -5 L7 -3" fill="none" stroke="#444746" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      <text x="24" y="0" fontFamily="Arial, sans-serif" fontSize="13" fill="#1f1f1f">Move</text>
                    </g>

                    {/* 11. Add shortcut to */}
                    <g transform="translate(14, 363)">
                      <path d="M0 -11 L5 -11 L7 -9 L13 -9 C14 -9 14.5 -8.5 14.5 -8 L14.5 -2 C14.5 -1.5 14 -1 13 -1 L1 -1 C0.5 -1 0 -1.5 0 -2 Z" fill="none" stroke="#444746" strokeWidth="1.4" />
                      <path d="M4 -3 L7 -7 L10 -7 L10 -4" fill="none" stroke="#444746" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      <text x="24" y="0" fontFamily="Arial, sans-serif" fontSize="13" fill="#1f1f1f">Add shortcut to</text>
                    </g>

                    {/* 12. Remove */}
                    <g transform="translate(14, 394)">
                      <path d="M1 -9 L13 -9 M3 -9 L3 2 C3 2.5 3.5 3 4 3 L10 3 C10.5 3 11 2.5 11 2 L11 -9 M5 -9 L5 -11 L9 -11 L9 -9" fill="none" stroke="#444746" strokeWidth="1.4" />
                      <text x="24" y="0" fontFamily="Arial, sans-serif" fontSize="13" fill="#1f1f1f">Remove</text>
                    </g>

                    {/* Divider 3 */}
                    <line x1="0" y1="414" x2="316" y2="414" stroke="#e1e3e1" strokeWidth="1" />

                    {/* 13. Version history */}
                    <g transform="translate(14, 439)">
                      <circle cx="7.5" cy="-4.5" r="6.5" fill="none" stroke="#444746" strokeWidth="1.4" />
                      <path d="M7.5 -7.5 L7.5 -4.5 L9.5 -3" fill="none" stroke="#444746" strokeWidth="1.4" strokeLinecap="round" />
                      <text x="24" y="0" fontFamily="Arial, sans-serif" fontSize="13" fill="#1f1f1f">Version history</text>
                      <path d="M280 -4 L285 0 L280 4" fill="#444746" />
                    </g>

                    {/* Divider 4 */}
                    <line x1="0" y1="459" x2="316" y2="459" stroke="#e1e3e1" strokeWidth="1" />

                    {/* 14. Information */}
                    <g transform="translate(14, 484)">
                      <circle cx="7.5" cy="-4.5" r="6.5" fill="none" stroke="#444746" strokeWidth="1.4" />
                      <circle cx="7.5" cy="-7.5" r="0.8" fill="#444746" />
                      <line x1="7.5" y1="-5.5" x2="7.5" y2="-2" stroke="#444746" strokeWidth="1.4" strokeLinecap="round" />
                      <text x="24" y="0" fontFamily="Arial, sans-serif" fontSize="13" fill="#1f1f1f">Information</text>
                    </g>

                    {/* 15. Security-related restrictions */}
                    <g transform="translate(14, 515)">
                      <path d="M7.5 -12 L1 -9 L1 -4 C1 0 7.5 3.5 7.5 3.5 C7.5 3.5 14 0 14 -4 L14 -9 Z" fill="none" stroke="#444746" strokeWidth="1.4" />
                      <circle cx="7.5" cy="-4.5" r="2" fill="none" stroke="#444746" strokeWidth="1.2" />
                      <text x="24" y="0" fontFamily="Arial, sans-serif" fontSize="13" fill="#1f1f1f">Security-related restrictions</text>
                    </g>

                    {/* 16. Language */}
                    <g transform="translate(14, 546)">
                      <circle cx="7.5" cy="-4.5" r="6.5" fill="none" stroke="#444746" strokeWidth="1.4" />
                      <ellipse cx="7.5" cy="-4.5" rx="3" ry="6.5" fill="none" stroke="#444746" strokeWidth="1.2" />
                      <line x1="1" y1="-4.5" x2="14" y2="-4.5" stroke="#444746" strokeWidth="1.2" />
                      <text x="24" y="0" fontFamily="Arial, sans-serif" fontSize="13" fill="#1f1f1f">Language</text>
                      <path d="M280 -4 L285 0 L280 4" fill="#444746" />
                    </g>

                    {/* 17. Page Settings */}
                    <g transform="translate(14, 577)">
                      <rect x="1" y="-11" width="11" height="14" rx="1" fill="none" stroke="#444746" strokeWidth="1.4" />
                      <circle cx="11" cy="0" r="3" fill="none" stroke="#444746" strokeWidth="1.4" />
                      <text x="24" y="0" fontFamily="Arial, sans-serif" fontSize="13" fill="#1f1f1f">Page Settings</text>
                    </g>

                    {/* 18. Print */}
                    <g transform="translate(14, 608)">
                      <path d="M2 -7 L12 -7 L12 -2 L2 -2 Z M1 -2 L13 -2 C13.5 -2 14 -1.5 14 -1 L14 3 C14 3.5 13.5 4 13 4 L1 4 C0.5 4 0 3.5 0 3 L0 -1 C0 -1.5 0.5 -2 1 -2 Z M2 2 L12 2 L12 5 L2 5 Z" fill="none" stroke="#444746" strokeWidth="1.2" />
                      <text x="24" y="0" fontFamily="Arial, sans-serif" fontSize="13" fill="#1f1f1f">Print</text>
                      <text x="248" y="-1" fontFamily="Arial, sans-serif" fontSize="11" fill="#747775">Ctrl+P</text>
                    </g>
                  </g>

                  {/* ================= EXACT RED HIGHLIGHT FRAME & NUMBER 1 ================= */}
                  {/* Surrounding 'Save as Google document' lowered slightly to center evenly */}
                  <rect x="42" y="165" width="216" height="30" rx="5" fill="none" stroke="#ff4d6d" strokeWidth="3" />
                  <circle cx="268" cy="168" r="11" fill="#ff4d6d" />
                  <text x="264" y="173" fontFamily="Arial, sans-serif" fontSize="13" fontWeight="700" fill="#ffffff">1</text>
                </svg>
              </div>
            </section>

            {/* Part 1 — Step 2 */}
            <section className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-4 sm:p-5 space-y-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>2. Continue in the new tab</span>
              </h3>
              <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                Google opens a copy in a new browser tab. This copy has <b className="text-white">no .DOCX badge</b>, so it is a real Google Doc. Work only in this tab and close the old one.
              </p>

              {/* Step 2 Visual Drawing */}
              <div className="flex justify-center pt-1">
                <svg
                  className="w-full max-w-[460px] rounded-xl border border-neutral-700/60 shadow-lg bg-white"
                  viewBox="0 0 520 130"
                  role="img"
                  aria-label="Top bar of the new document without the .DOCX badge"
                >
                  <rect width="520" height="130" fill="#f9fbfd" />
                  <rect width="520" height="70" fill="#edf2fa" />
                  <text x="20" y="27" fontFamily="Arial, sans-serif" fontSize="15" fill="#222">My Strategy</text>
                  <use href="#gdoc-menu" width="520" height="70" />
                  
                  {/* Red highlight frame around title without .DOCX badge */}
                  <rect x="14" y="10" width="98" height="24" rx="5" fill="none" stroke="#ff4d6d" strokeWidth="3" />
                  <circle cx="124" cy="10" r="11" fill="#ff4d6d" />
                  <text x="120" y="15" fontFamily="Arial, sans-serif" fontSize="13" fontWeight="700" fill="#fff">2</text>
                  
                  <text x="20" y="104" fontFamily="Arial, sans-serif" fontSize="13" fill="#555">
                    No .DOCX badge next to the title = ready to edit.
                  </text>
                </svg>
              </div>
            </section>

            {/* Part 1 Tip */}
            <div className="border-l-4 border-purple-500 bg-neutral-900/90 rounded-r-2xl p-3.5 sm:p-4 flex items-start gap-3 text-xs sm:text-sm text-neutral-300">
              <HelpCircle className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <div>
                <b className="text-white">Can’t see &ldquo;Save as Google document&rdquo;?</b> Go to Google Drive, right-click the file, choose <b className="text-white">Open with</b>, then <b className="text-white">Google Docs</b>. Then continue with step 2 in the new tab.
              </div>
            </div>
          </div>

          {/* ================= PART 2 ================= */}
          <div className="space-y-5 pt-2">
            <div className="border-b border-neutral-800 pb-2">
              <h2 className="text-lg sm:text-xl font-extrabold text-purple-400 tracking-tight">
                Part 2. Remove page breaks (Pageless mode)
              </h2>
              <p className="text-xs sm:text-sm text-neutral-400 mt-1">
                Do this in the Google Doc from Part 1, not in the .docx tab. Pageless mode only exists in real Google Docs.
              </p>
            </div>

            {/* Part 2 — Step 1 */}
            <section className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-4 sm:p-5 space-y-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>1. Open File → Page setup</span>
              </h3>
              <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                Click <b className="text-white">File</b>, then <b className="text-white">Page setup</b> near the bottom of the menu.
              </p>

              {/* Part 2 Step 1 Visual Drawing */}
              <div className="flex justify-center pt-2">
                <svg
                  className="w-full max-w-[520px] rounded-xl border border-neutral-700/60 shadow-lg bg-white"
                  viewBox="0 0 520 260"
                  role="img"
                  aria-label="File menu open with Page setup highlighted"
                >
                  <rect width="520" height="260" fill="#f9fbfd" />
                  <rect width="520" height="70" fill="#edf2fa" />
                  <text x="20" y="27" fontFamily="Arial, sans-serif" fontSize="15" fill="#222">My Strategy</text>
                  <use href="#gdoc-menu" width="520" height="70" />
                  <use href="#gdoc-drop" width="520" height="260" />
                  
                  {/* Red highlight frame around Page setup */}
                  <rect x="16" y="195" width="222" height="24" rx="4" fill="none" stroke="#ff4d6d" strokeWidth="3" />
                  <circle cx="256" cy="207" r="11" fill="#ff4d6d" />
                  <text x="252" y="212" fontFamily="Arial, sans-serif" fontSize="13" fontWeight="700" fill="#fff">1</text>
                </svg>
              </div>
            </section>

            {/* Part 2 — Step 2 */}
            <section className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-4 sm:p-5 space-y-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>2. Click the &ldquo;Pageless&rdquo; tab</span>
              </h3>
              <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                At the top of the window you will see two tabs: <b className="text-white">Pages</b> and <b className="text-white">Pageless</b>. Click <b className="text-white">Pageless</b>.
              </p>

              {/* Part 2 Step 2 Visual Drawing */}
              <div className="flex justify-center pt-1">
                <svg
                  className="w-full max-w-[460px] rounded-xl border border-neutral-700/60 shadow-lg bg-white"
                  viewBox="0 0 520 260"
                  role="img"
                  aria-label="Page setup dialog with the Pageless tab highlighted"
                >
                  <rect width="520" height="260" fill="#8a8f99" />
                  <rect x="100" y="16" width="320" height="228" rx="10" fill="#fff" />
                  <text x="124" y="46" fontFamily="Arial, sans-serif" fontSize="17" fill="#222">Page setup</text>
                  <text x="132" y="78" fontFamily="Arial, sans-serif" fontSize="13" fontWeight="700" fill="#0b57d0">Pages</text>
                  <rect x="124" y="86" width="50" height="3" fill="#0b57d0" />
                  <text x="238" y="78" fontFamily="Arial, sans-serif" fontSize="13" fill="#555">Pageless</text>
                  <rect x="116" y="92" width="288" height="1" fill="#dde1e8" />
                  <rect x="124" y="108" width="150" height="10" rx="3" fill="#e5e8ee" />
                  <rect x="124" y="130" width="230" height="10" rx="3" fill="#e5e8ee" />
                  <rect x="124" y="152" width="190" height="10" rx="3" fill="#e5e8ee" />
                  <rect x="352" y="198" width="52" height="28" rx="14" fill="#0b57d0" />
                  <text x="367" y="216" fontFamily="Arial, sans-serif" fontSize="13" fill="#fff">OK</text>
                  
                  {/* Red highlight frame around Pageless tab */}
                  <rect x="224" y="58" width="80" height="30" rx="5" fill="none" stroke="#ff4d6d" strokeWidth="3" />
                  <circle cx="314" cy="58" r="11" fill="#ff4d6d" />
                  <text x="310" y="63" fontFamily="Arial, sans-serif" fontSize="13" fontWeight="700" fill="#fff">2</text>
                </svg>
              </div>
            </section>

            {/* Part 2 — Step 3 */}
            <section className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-4 sm:p-5 space-y-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>3. Click OK</span>
              </h3>
              <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                The text under the tabs changes to a short Pageless description. Click <b className="text-white">OK</b>. The white gaps between pages disappear and the document scrolls as one long page.
              </p>

              {/* Part 2 Step 3 Visual Drawing */}
              <div className="flex justify-center pt-1">
                <svg
                  className="w-full max-w-[460px] rounded-xl border border-neutral-700/60 shadow-lg bg-white"
                  viewBox="0 0 520 260"
                  role="img"
                  aria-label="Page setup dialog with Pageless selected and the OK button highlighted"
                >
                  <rect width="520" height="260" fill="#8a8f99" />
                  <rect x="100" y="16" width="320" height="228" rx="10" fill="#fff" />
                  <text x="124" y="46" fontFamily="Arial, sans-serif" fontSize="17" fill="#222">Page setup</text>
                  <text x="132" y="78" fontFamily="Arial, sans-serif" fontSize="13" fill="#555">Pages</text>
                  <text x="238" y="78" fontFamily="Arial, sans-serif" fontSize="13" fontWeight="700" fill="#0b57d0">Pageless</text>
                  <rect x="228" y="86" width="64" height="3" fill="#0b57d0" />
                  <rect x="116" y="92" width="288" height="1" fill="#dde1e8" />
                  <text x="124" y="124" fontFamily="Arial, sans-serif" fontSize="13" fill="#444">
                    Pageless: content flows without page breaks.
                  </text>
                  <rect x="124" y="140" width="190" height="10" rx="3" fill="#e5e8ee" />
                  
                  {/* OK button */}
                  <rect x="352" y="198" width="52" height="28" rx="14" fill="#0b57d0" />
                  <text x="367" y="216" fontFamily="Arial, sans-serif" fontSize="13" fill="#fff">OK</text>
                  
                  {/* Red highlight frame around OK button */}
                  <rect x="346" y="192" width="64" height="40" rx="8" fill="none" stroke="#ff4d6d" strokeWidth="3" />
                  <circle cx="418" cy="192" r="11" fill="#ff4d6d" />
                  <text x="414" y="197" fontFamily="Arial, sans-serif" fontSize="13" fontWeight="700" fill="#fff">3</text>
                </svg>
              </div>
            </section>

            {/* Part 2 Tip */}
            <div className="border-l-4 border-purple-500 bg-neutral-900/90 rounded-r-2xl p-3.5 sm:p-4 flex items-start gap-3 text-xs sm:text-sm text-neutral-300">
              <HelpCircle className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <div>
                <b className="text-white">No &ldquo;Pageless&rdquo; tab?</b> You are still in the .docx version. Go back to Part 1 and use <b className="text-white">Save as Google document</b> first.
              </div>
            </div>
          </div>

          {/* Footer Note */}
          <div className="pt-3 border-t border-neutral-800 flex items-start gap-2.5 text-xs text-neutral-400">
            <Info className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
            <p>
              The pictures are simplified drawings of the Google Docs menus. Menu names and positions can change slightly between versions of Google Docs.
            </p>
          </div>
        </div>

        {/* Modal Bottom Bar */}
        <div className="px-5 sm:px-7 py-3.5 border-t border-neutral-800 bg-[#0d0d11]/95 flex items-center justify-between gap-3">
          <span className="text-xs text-neutral-500 hidden sm:inline">
            STRATUM • Google Docs Strategy Compatibility
          </span>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-white hover:bg-neutral-200 text-black font-bold text-xs transition-colors cursor-pointer"
          >
            Got it, close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
