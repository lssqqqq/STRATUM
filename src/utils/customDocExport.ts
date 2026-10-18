import { saveAs } from 'file-saver';
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  ImageRun,
  HeadingLevel,
  WidthType,
  AlignmentType,
  BorderStyle,
  ShadingType,
  TableLayoutType,
  PageOrientation
} from 'docx';
import { CustomDocTemplate, TableRowItem } from '../types/customDoc';
import { getExportPageGeometry, normalizeTableWidth, tableWidthTwips } from './tableWidth';
import { loadImage, rasterizeImageToPng, renderCustomMapToImage } from './mapRenderHelper';

/**
 * Shared typography & styling constants for Word (.docx) export
 */
export const WATERMARK_TEXT = 'STRATUM STUDIO';
export const HEADING_COLOR = 'FFFFFF'; // Universal color for all headings (change here in one place)
export const DOC_TITLE_SIZE_PT = 36;   // 36 pt (72 half-points in docx)
export const SECTION_HEADING_SIZE_PT = 26; // 26 pt (52 half-points in docx)
export const SUB_HEADING_SIZE_PT = 20;     // 20 pt (40 half-points in docx)
export const BADGE_SUBTITLE_SIZE_PT = 14;  // 14 pt (28 half-points in docx)
export const TABLE_TEXT_MIN_SIZE_PT = 11;  // 11 pt (22 half-points in docx)

/** Tower icon scaling factor for all tower images exported to DOCX (1.5x) */
export const TOWER_ICON_SCALE = 1.5;
export const TOWER_ICON_BASE_PX = 38;
export const TOWER_ICON_DOCX_SIZE = Math.round(TOWER_ICON_BASE_PX * TOWER_ICON_SCALE); // 57 px
export const TOWER_ICON_RASTER_SIZE = Math.round(48 * TOWER_ICON_SCALE * 2); // 144 px (sharp 2x rasterization)

export const FONT_PRIMARY = 'Montserrat';
export const FONT_FALLBACK = 'Arial';
export const FONT_SPEC = {
  name: FONT_PRIMARY,
  ascii: FONT_PRIMARY,
  hAnsi: FONT_PRIMARY,
  cs: FONT_FALLBACK
};

const headingSpacing = { before: 240, after: 120 }; // ~12 pt before, ~6 pt after

/**
 * Decodes and rasterizes cover image with full EXIF orientation support,
 * preserves original aspect ratio, limits max height to 40% of page height,
 * and maintains high resolution (up to 2400px on the longest dimension).
 */
/**
 * Decodes and rasterizes cover image with full EXIF orientation support,
 * preserves original aspect ratio, fits strictly to available content width,
 * and maintains high resolution (up to 3840px for 4K / print crispness).
 */
export async function prepareDocxCoverImage(
  src: string | undefined,
  availableWidthPx: number,
  availableHeightPx: number
): Promise<{ dataUrl: string; width: number; height: number; type: 'png' | 'jpg' } | null> {
  if (!src || !src.trim()) return null;

  try {
    let naturalW = 0;
    let naturalH = 0;
    let drawable: ImageBitmap | HTMLImageElement | null = null;

    // 1. Decode with EXIF orientation via createImageBitmap
    if (typeof fetch !== 'undefined' && typeof createImageBitmap === 'function') {
      try {
        const res = await fetch(src);
        const blob = await res.blob();
        const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
        if (bitmap && bitmap.width > 0 && bitmap.height > 0) {
          drawable = bitmap;
          naturalW = bitmap.width;
          naturalH = bitmap.height;
        }
      } catch {
        // Fallback to Image loading
      }
    }

    // 2. Fallback to standard Image loading
    if (!drawable) {
      const img = await loadImage(src);
      if (img) {
        drawable = img;
        naturalW = img.naturalWidth || 1200;
        naturalH = img.naturalHeight || 600;
      }
    }

    if (!drawable || naturalW <= 0 || naturalH <= 0) return null;

    const aspectRatio = naturalW / naturalH;

    // Preserve high resolution buffer (up to 3840px for pristine quality, no blur)
    const MAX_BUFFER_DIM = 3840;
    let bufferW = naturalW;
    let bufferH = naturalH;
    if (bufferW > MAX_BUFFER_DIM || bufferH > MAX_BUFFER_DIM) {
      if (bufferW >= bufferH) {
        bufferH = Math.max(1, Math.round((bufferH * MAX_BUFFER_DIM) / bufferW));
        bufferW = MAX_BUFFER_DIM;
      } else {
        bufferW = Math.max(1, Math.round((bufferW * MAX_BUFFER_DIM) / bufferH));
        bufferH = MAX_BUFFER_DIM;
      }
    }

    if (typeof document === 'undefined') return null;

    const canvas = document.createElement('canvas');
    canvas.width = bufferW;
    canvas.height = bufferH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(drawable, 0, 0, bufferW, bufferH);

    // Use JPEG 94% for photos / data URLs without transparency, PNG for transparent or SVG
    const isJpeg =
      src.startsWith('data:image/jpeg') ||
      (!src.startsWith('data:image/svg') && !src.startsWith('data:image/png'));
    const dataUrl = canvas.toDataURL(isJpeg ? 'image/jpeg' : 'image/png', 0.94);

    // Calculate DOCX display size ("fit to width" rule)
    // Width equals available width (printable content area), height = width / aspect ratio
    let docW = availableWidthPx;
    let docH = Math.round(docW / aspectRatio);

    // If an extreme vertical cover would exceed the printable page height,
    // scale down proportionally to fit the physical page without distortion
    if (docH > availableHeightPx && availableHeightPx > 100) {
      docH = availableHeightPx;
      docW = Math.round(docH * aspectRatio);
    }

    return {
      dataUrl,
      width: Math.max(10, docW),
      height: Math.max(10, docH),
      type: isJpeg ? 'jpg' : 'png'
    };
  } catch (err) {
    console.warn('prepareDocxCoverImage error:', err);
    return null;
  }
}

/**
 * Downloads a high-fidelity Microsoft Word (.docx) file that matches the website's
 * exact design, colors, typography, tables, loadout slots, and includes the final
 * rendered maps with all placed towers, tokens, and zones.
 */
export async function downloadCustomDocx(docData: CustomDocTemplate): Promise<void> {
  const canvasSettings = docData.canvasSettings;
  const geometry = getExportPageGeometry(canvasSettings);

  // Compute printable content dimensions in pixels (at 96 DPI, 1 px = 15 twips)
  // Accommodates the player table (Placement Map + Notes + Waves) or the standard content width
  const playerTableTotalTwips = 2850 + 840 * 15 + 340; // 15790 twips
  const widestTableTwips = Math.max(geometry.contentWidthTwips, playerTableTotalTwips);
  const printableWidthPx = Math.round(widestTableTwips / 15);
  const printableHeightTwips =
    (geometry.landscape ? geometry.portraitWidthTwips : geometry.portraitHeightTwips) -
    2 * geometry.marginTwips;
  const printableHeightPx = Math.round(printableHeightTwips / 15);

  // Determine theme colors to match website styling
  const theme = canvasSettings?.theme || 'black';
  let pageBg = '000000';
  let headerBg = '18181B';
  let contentBg = '0F0F11';
  let cardBorder = '27272A';
  let textPrimary = 'FFFFFF';
  let textSecondary = 'A1A1AA';
  let accentGreen = '4ADE80';
  let accentPurple = 'C084FC';

  if (theme === 'dark') {
    pageBg = '0F0F11';
    headerBg = '1E1E24';
    contentBg = '141418';
    cardBorder = '2E2E38';
    textPrimary = 'FFFFFF';
    textSecondary = 'A1A1AA';
  } else if (theme === 'midnight') {
    pageBg = '0D0714';
    headerBg = '201235';
    contentBg = '150B24';
    cardBorder = '3B1D66';
    textPrimary = 'FFFFFF';
    textSecondary = 'C4B5FD';
    accentPurple = 'D8B4FE';
  } else if (theme === 'white') {
    pageBg = 'FFFFFF';
    headerBg = 'F4F4F5';
    contentBg = 'FFFFFF';
    cardBorder = 'E4E4E7';
    textPrimary = '09090B';
    textSecondary = '71717A';
    accentGreen = '16A34A';
    accentPurple = '9333EA';
  } else if (theme === 'paper') {
    pageBg = 'F8FAFC';
    headerBg = 'E2E8F0';
    contentBg = 'FFFFFF';
    cardBorder = 'CBD5E1';
    textPrimary = '0F172A';
    textSecondary = '64748B';
    accentGreen = '16A34A';
    accentPurple = '7C3AED';
  } else if (theme === 'custom' && canvasSettings?.customBgColor) {
    pageBg = canvasSettings.customBgColor.replace('#', '');
  }

  const thinBorder = {
    top: { style: BorderStyle.SINGLE, size: 4, color: cardBorder },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: cardBorder },
    left: { style: BorderStyle.SINGLE, size: 4, color: cardBorder },
    right: { style: BorderStyle.SINGLE, size: 4, color: cardBorder }
  };

  const cellPadding = {
    top: 130,
    bottom: 130,
    left: 170,
    right: 170
  };

  /**
   * Helper to build a styled two-column table matching the website's note and instruction tables
   */
  const buildTwoColumnTable = (
    rows: { left: string; right: string }[],
    widthPct: number | undefined,
    leftFraction = 0.28,
    header?: [string, string]
  ): Table => {
    const total = tableWidthTwips(widthPct, geometry);
    const leftW = Math.round(total * leftFraction);
    const columnWidths = [leftW, total - leftW];

    const makeCell = (text: string, index: 0 | 1, isHeader = false) =>
      new TableCell({
        width: { size: columnWidths[index], type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: index === 0 || isHeader ? headerBg : contentBg },
        borders: thinBorder,
        margins: cellPadding,
        children: (text || ' ').split('\n').map(
          line =>
            new Paragraph({
              spacing: { before: 20, after: 20 },
              children: [
                new TextRun({
                  text: line,
                  font: FONT_SPEC,
                  bold: index === 0 || isHeader,
                  italics: false,
                  color: index === 0 || isHeader ? textPrimary : textSecondary,
                  size: TABLE_TEXT_MIN_SIZE_PT * 2
                })
              ]
            })
        )
      });

    const tableRows = [
      ...(header
        ? [new TableRow({ tableHeader: true, children: [makeCell(header[0], 0, true), makeCell(header[1], 1, true)] })]
        : []),
      ...rows.map(r => new TableRow({ children: [makeCell(r.left, 0), makeCell(r.right, 1)] }))
    ];

    if (tableRows.length === 0) {
      tableRows.push(new TableRow({ children: [makeCell(' ', 0), makeCell(' ', 1)] }));
    }

    return new Table({
      width: { size: total, type: WidthType.DXA },
      columnWidths,
      layout: TableLayoutType.FIXED,
      alignment: AlignmentType.CENTER,
      rows: tableRows
    });
  };

  /**
   * Helper to build a single-column table (full width cell, e.g. when Titles column is deleted).
   */
  const buildSingleColumnTable = (
    rows: string[],
    widthPct: number | undefined,
    headerTitle?: string
  ): Table => {
    const total = tableWidthTwips(widthPct, geometry);
    const columnWidths = [total];

    const makeCell = (text: string, isHeader = false) =>
      new TableCell({
        width: { size: total, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: isHeader ? headerBg : contentBg },
        borders: thinBorder,
        margins: cellPadding,
        children: (text || ' ').split('\n').map(
          line =>
            new Paragraph({
              spacing: { before: 20, after: 20 },
              children: [
                new TextRun({
                  text: line,
                  font: FONT_SPEC,
                  bold: isHeader,
                  italics: false,
                  color: isHeader ? textPrimary : textSecondary,
                  size: TABLE_TEXT_MIN_SIZE_PT * 2
                })
              ]
            })
        )
      });

    const tableRows = [
      ...(headerTitle
        ? [new TableRow({ tableHeader: true, children: [makeCell(headerTitle, true)] })]
        : []),
      ...rows.map(r => new TableRow({ children: [makeCell(r)] }))
    ];

    if (tableRows.length === 0) {
      tableRows.push(new TableRow({ children: [makeCell(' ')] }));
    }

    return new Table({
      width: { size: total, type: WidthType.DXA },
      columnWidths,
      layout: TableLayoutType.FIXED,
      alignment: AlignmentType.CENTER,
      rows: tableRows
    });
  };

  /**
   * Helper to build a styled bulleted notes block (single cell across full width, without Title column).
   * Generates a real Word bullet list with • bullets. Empty items are skipped.
   */
  const buildBulletNotesTable = (
    rows: TableRowItem[] | undefined,
    widthPct: number | undefined
  ): Table | null => {
    if (!rows || rows.length === 0) return null;

    const validItems: string[] = [];
    for (const r of rows) {
      if (!r) continue;
      let text = (r.text ?? '').trim();
      if (!text) {
        const lbl = (r.label ?? '').trim();
        const cnt = (r.content ?? '').trim();
        const validLbl = lbl && lbl.toLowerCase() !== 'title' ? lbl : '';
        const validCnt = cnt && cnt !== '-' && cnt.toLowerCase() !== 'write here...' ? cnt : '';
        if (validLbl && validCnt) text = `${validLbl}: ${validCnt}`;
        else if (validCnt) text = validCnt;
        else if (validLbl) text = validLbl;
      }
      if (text && text !== '-') {
        validItems.push(text);
      }
    }

    if (validItems.length === 0) return null;

    const total = tableWidthTwips(widthPct, geometry);

    const bulletParagraphs = validItems.map(
      itemText =>
        new Paragraph({
          bullet: { level: 0 },
          spacing: { before: 50, after: 50 },
          children: [
            new TextRun({
              text: itemText,
              font: FONT_SPEC,
              color: textPrimary,
              size: TABLE_TEXT_MIN_SIZE_PT * 2
            })
          ]
        })
    );

    return new Table({
      width: { size: total, type: WidthType.DXA },
      columnWidths: [total],
      layout: TableLayoutType.FIXED,
      alignment: AlignmentType.CENTER,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: total, type: WidthType.DXA },
              shading: { type: ShadingType.CLEAR, fill: contentBg },
              borders: thinBorder,
              margins: {
                top: 140,
                bottom: 140,
                left: 200,
                right: 200
              },
              children: bulletParagraphs
            })
          ]
        })
      ]
    });
  };

  const hiddenSections = docData.hiddenSections || {};

  // ================= TAB 1: COVER & NOTES =================
  const tab1Children: (Paragraph | Table)[] = [];

  // 1. Cover Banner Image (preserves original aspect ratio and resolution, fitted to width)
  if (!hiddenSections['banner'] && docData.tab1.bannerImage) {
    try {
      const cover = await prepareDocxCoverImage(
        docData.tab1.bannerImage,
        printableWidthPx,
        printableHeightPx
      );
      if (cover) {
        tab1Children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 180 },
            children: [
              new ImageRun({
                type: cover.type,
                data: cover.dataUrl,
                transformation: {
                  width: cover.width,
                  height: cover.height
                }
              })
            ]
          })
        );
      }
    } catch (e) {
      console.warn('Failed to prepare cover banner for DOCX:', e);
    }
  }

  // 2. Document Title & Sub-banner
  tab1Children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: headingSpacing,
      children: [
        new TextRun({
          text: 'TDS STRATEGY DOCUMENT',
          font: FONT_SPEC,
          bold: true,
          size: DOC_TITLE_SIZE_PT * 2,
          color: HEADING_COLOR
        })
      ]
    })
  );

  if (docData.tab1.subBannerText) {
    tab1Children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 160 },
        children: [
          new TextRun({
            text: docData.tab1.subBannerText,
            font: FONT_SPEC,
            italics: false,
            size: BADGE_SUBTITLE_SIZE_PT * 2,
            color: textSecondary
          })
        ]
      })
    );
  }

  // 3. Avatar Categories (CREATORS, PLACEMENT MAP MAKER, TESTERS, etc.)
  if (docData.tab1.categories && docData.tab1.categories.length > 0) {
    for (const cat of docData.tab1.categories) {
      if (!cat.members || cat.members.length === 0) continue;

      tab1Children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: headingSpacing,
          children: [
            new TextRun({
              text: (cat.title || 'CATEGORY').toUpperCase(),
              font: FONT_SPEC,
              bold: true,
              size: SECTION_HEADING_SIZE_PT * 2,
              color: HEADING_COLOR
            })
          ]
        })
      );

      // Render cards in rows of up to 4 or 5 members
      const cardsPerRow = Math.min(cat.members.length, 5);
      const totalWidth = tableWidthTwips(100, geometry);
      const colWidth = Math.floor(totalWidth / cardsPerRow);
      const colWidths = Array(cardsPerRow).fill(colWidth);

      const rows: TableRow[] = [];
      for (let i = 0; i < cat.members.length; i += cardsPerRow) {
        const rowMembers = cat.members.slice(i, i + cardsPerRow);
        const cells: TableCell[] = await Promise.all(
          rowMembers.map(async m => {
            const cellChildren: Paragraph[] = [];
            // Avatar Image
            if (m.image) {
              const avatarPng = await rasterizeImageToPng(m.image, 56, 56);
              if (avatarPng) {
                cellChildren.push(
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 60, after: 40 },
                    children: [
                      new ImageRun({
                        type: 'png',
                        data: avatarPng.dataUrl,
                        transformation: { width: 44, height: 44 }
                      })
                    ]
                  })
                );
              }
            }

            // Member Name
            cellChildren.push(
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 20, after: 60 },
                children: [
                  new TextRun({
                    text: m.name || 'Name',
                    font: FONT_SPEC,
                    bold: true,
                    italics: false,
                    size: TABLE_TEXT_MIN_SIZE_PT * 2,
                    color: textPrimary
                  })
                ]
              })
            );

            return new TableCell({
              width: { size: colWidth, type: WidthType.DXA },
              shading: { type: ShadingType.CLEAR, fill: contentBg },
              borders: thinBorder,
              margins: cellPadding,
              children: cellChildren
            });
          })
        );

        // Fill remaining columns if last row has fewer members
        while (cells.length < cardsPerRow) {
          cells.push(
            new TableCell({
              width: { size: colWidth, type: WidthType.DXA },
              shading: { type: ShadingType.CLEAR, fill: contentBg },
              borders: thinBorder,
              children: [new Paragraph({ children: [] })]
            })
          );
        }

        rows.push(new TableRow({ children: cells }));
      }

      tab1Children.push(
        new Table({
          width: { size: totalWidth, type: WidthType.DXA },
          columnWidths: colWidths,
          layout: TableLayoutType.FIXED,
          alignment: AlignmentType.CENTER,
          rows
        })
      );

      tab1Children.push(new Paragraph({ spacing: { before: 80, after: 80 }, children: [] }));
    }
  }

  // 4. Tab 1 Notes Table
  if (!hiddenSections['tab1Notes'] && docData.tab1.notesRows && docData.tab1.notesRows.length > 0) {
    tab1Children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: headingSpacing,
        children: [
          new TextRun({
            text: (docData.tab1.notesTitle || 'NOTES').toUpperCase(),
            font: FONT_SPEC,
            bold: true,
            size: SECTION_HEADING_SIZE_PT * 2,
            color: HEADING_COLOR
          })
        ]
      })
    );

    const notesTable = buildBulletNotesTable(
      docData.tab1.notesRows,
      docData.tab1.notesTableWidth
    );
    if (notesTable) {
      tab1Children.push(notesTable);
    }
  }

  // ================= TAB 2: LOADOUTS & STRATEGY =================
  const tab2Children: (Paragraph | Table)[] = [];

  // Page Break between Tab 1 and Tab 2 (standard multi-page A4 structure)
  tab2Children.push(
    new Paragraph({
      pageBreakBefore: true,
      children: []
    })
  );

  // 5. Tab 2 Top Notes Table (if present)
  if (docData.tab2.topNotesRows && docData.tab2.topNotesRows.length > 0) {
    const topNotesTable = buildBulletNotesTable(
      docData.tab2.topNotesRows,
      docData.tab2.topNotesTableWidth
    );
    if (topNotesTable) {
      tab2Children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: headingSpacing,
          children: [
            new TextRun({
              text: (docData.tab2.topNotesTitle || 'NOTES').toUpperCase(),
              font: FONT_SPEC,
              bold: true,
              size: SECTION_HEADING_SIZE_PT * 2,
              color: HEADING_COLOR
            })
          ]
        })
      );
      tab2Children.push(topNotesTable);
      tab2Children.push(new Paragraph({ spacing: { before: 100, after: 100 }, children: [] }));
    }
  }

  // 6. Tab 2 Loadouts Table (with actual tower photos in 5 slot columns)
  if (!hiddenSections['loadouts'] && docData.tab2.loadoutRows && docData.tab2.loadoutRows.length > 0) {
    tab2Children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: headingSpacing,
        children: [
          new TextRun({
            text: (docData.tab2.loadoutsTitle || 'LOADOUTS').toUpperCase(),
            font: FONT_SPEC,
            bold: true,
            size: SECTION_HEADING_SIZE_PT * 2,
            color: HEADING_COLOR
          })
        ]
      })
    );

    const totalWidth = Math.max(tableWidthTwips(docData.tab2.loadoutsTableWidth, geometry), 9600);
    const playerColW = Math.round(totalWidth * 0.18);
    const slotColW = Math.floor((totalWidth - playerColW) / 5);
    const colWidths = [playerColW, slotColW, slotColW, slotColW, slotColW, totalWidth - playerColW - slotColW * 4];

    const loadoutTableRows: TableRow[] = [];

    // Header row
    loadoutTableRows.push(
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            width: { size: colWidths[0], type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: headerBg },
            borders: thinBorder,
            margins: cellPadding,
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [
                  new TextRun({
                    text: 'Player',
                    font: FONT_SPEC,
                    bold: true,
                    color: textPrimary,
                    size: TABLE_TEXT_MIN_SIZE_PT * 2
                  })
                ]
              })
            ]
          }),
          ...[1, 2, 3, 4, 5].map(
            slotNum =>
              new TableCell({
                width: { size: colWidths[slotNum], type: WidthType.DXA },
                shading: { type: ShadingType.CLEAR, fill: headerBg },
                borders: thinBorder,
                margins: cellPadding,
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({
                        text: `Slot ${slotNum}`,
                        font: FONT_SPEC,
                        bold: true,
                        color: textSecondary,
                        size: TABLE_TEXT_MIN_SIZE_PT * 2
                      })
                    ]
                  })
                ]
              })
          )
        ]
      })
    );

    // Player loadout rows
    for (const row of docData.tab2.loadoutRows) {
      const slotCells: TableCell[] = await Promise.all(
        row.slots.slice(0, 5).map(async slot => {
          const slotChildren: Paragraph[] = [];

          if (slot.image) {
            const towerPng = await rasterizeImageToPng(slot.image, TOWER_ICON_RASTER_SIZE, TOWER_ICON_RASTER_SIZE);
            if (towerPng) {
              slotChildren.push(
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 20, after: 20 },
                  children: [
                    new ImageRun({
                      type: 'png',
                      data: towerPng.dataUrl,
                      transformation: { width: TOWER_ICON_DOCX_SIZE, height: TOWER_ICON_DOCX_SIZE }
                    })
                  ]
                })
              );
            }
          }

          if (slot.name) {
            slotChildren.push(
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 20, after: 20 },
                children: [
                  new TextRun({
                    text: slot.name,
                    font: FONT_SPEC,
                    bold: true,
                    size: TABLE_TEXT_MIN_SIZE_PT * 2,
                    color: textPrimary
                  })
                ]
              })
            );
          }

          if (slotChildren.length === 0) {
            slotChildren.push(
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: '-',
                    font: FONT_SPEC,
                    color: '52525B',
                    size: TABLE_TEXT_MIN_SIZE_PT * 2
                  })
                ]
              })
            );
          }

          return new TableCell({
            width: { size: slotColW, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: contentBg },
            borders: thinBorder,
            margins: cellPadding,
            children: slotChildren
          });
        })
      );

      loadoutTableRows.push(
        new TableRow({
          children: [
            new TableCell({
              width: { size: colWidths[0], type: WidthType.DXA },
              shading: { type: ShadingType.CLEAR, fill: headerBg },
              borders: thinBorder,
              margins: cellPadding,
              children: [
                new Paragraph({
                  alignment: AlignmentType.LEFT,
                  children: [
                    new TextRun({
                      text: row.playerTitle || 'Player',
                      font: FONT_SPEC,
                      bold: true,
                      color: textPrimary,
                      size: TABLE_TEXT_MIN_SIZE_PT * 2
                    })
                  ]
                })
              ]
            }),
            ...slotCells
          ]
        })
      );
    }

    tab2Children.push(
      new Table({
        width: { size: totalWidth, type: WidthType.DXA },
        columnWidths: colWidths,
        layout: TableLayoutType.FIXED,
        alignment: AlignmentType.CENTER,
        rows: loadoutTableRows
      })
    );

    tab2Children.push(new Paragraph({ spacing: { before: 100, after: 100 }, children: [] }));
  }

  // 7. Strategy Header Title
  if (!hiddenSections['strategy']) {
    tab2Children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: headingSpacing,
        children: [
          new TextRun({
            text: (docData.tab2.strategyTitle || 'STRATEGY').toUpperCase(),
            font: FONT_SPEC,
            bold: true,
            size: SECTION_HEADING_SIZE_PT * 2,
            color: HEADING_COLOR
          })
        ]
      })
    );

    // 8. Player Strategy Blocks
    for (const player of docData.tab2.players) {
      // Player Header Title & Difficulty Badge
      tab2Children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          alignment: AlignmentType.CENTER,
          spacing: headingSpacing,
          children: [
            new TextRun({
              text: `${player.playerTitle || 'PLAYER'}`.toUpperCase(),
              font: FONT_SPEC,
              bold: true,
              size: SUB_HEADING_SIZE_PT * 2,
              color: HEADING_COLOR
            }),
            new TextRun({
              text: `  —  ${player.difficultyBadge || 'Difficulty: Normal'}`,
              font: FONT_SPEC,
              italics: false,
              bold: false,
              size: BADGE_SUBTITLE_SIZE_PT * 2,
              color: textSecondary
            })
          ]
        })
      );

      // Player 5-Tower Deck Cards Table
      if (player.towers && player.towers.length > 0) {
        const deckCols = Math.min(player.towers.length, 5);
        const deckTotalW = Math.max(tableWidthTwips(player.tableWidth, geometry), 9600);
        const deckColW = Math.floor(deckTotalW / deckCols);
        const deckColWidths = Array(deckCols).fill(deckColW);

        const deckCells: TableCell[] = await Promise.all(
          player.towers.slice(0, 5).map(async t => {
            const children: Paragraph[] = [];
            if (t.image) {
              const twrPng = await rasterizeImageToPng(t.image, TOWER_ICON_RASTER_SIZE, TOWER_ICON_RASTER_SIZE);
              if (twrPng) {
                children.push(
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 20, after: 20 },
                    children: [
                      new ImageRun({
                        type: 'png',
                        data: twrPng.dataUrl,
                        transformation: { width: TOWER_ICON_DOCX_SIZE, height: TOWER_ICON_DOCX_SIZE }
                      })
                    ]
                  })
                );
              }
            }

            if (t.name) {
              children.push(
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 20, after: 20 },
                  children: [
                    new TextRun({
                      text: t.name,
                      font: FONT_SPEC,
                      bold: true,
                      size: TABLE_TEXT_MIN_SIZE_PT * 2,
                      color: textPrimary
                    })
                  ]
                })
              );
            }

            if (children.length === 0) {
              children.push(
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: '-',
                      font: FONT_SPEC,
                      color: '52525B',
                      size: TABLE_TEXT_MIN_SIZE_PT * 2
                    })
                  ]
                })
              );
            }

            return new TableCell({
              width: { size: deckColW, type: WidthType.DXA },
              shading: { type: ShadingType.CLEAR, fill: contentBg },
              borders: thinBorder,
              margins: cellPadding,
              children
            });
          })
        );

        tab2Children.push(
          new Table({
            width: { size: deckTotalW, type: WidthType.DXA },
            columnWidths: deckColWidths,
            layout: TableLayoutType.FIXED,
            alignment: AlignmentType.CENTER,
            rows: [new TableRow({ children: deckCells })]
          })
        );

        tab2Children.push(new Paragraph({ spacing: { before: 60, after: 60 }, children: [] }));
      }

      // Player Table: Map, Notes, Waves
      // Left column width for "Placement Map" / "Notes" / "Wave" (increased to 2850 twips / ~190pt so "Placement Map" fits completely without squeezing)
      const playerLeftW = 2850;
      // Map in 2x size: cell width expanded to fit 2x map (840px / 12600 twips + 340 twips cell padding)
      const targetMapW_px = 840;
      const targetMapW_twips = targetMapW_px * 15; // 12600 twips
      const playerRightW = targetMapW_twips + (cellPadding.left + cellPadding.right); // 12940 twips
      const playerTotalW = playerLeftW + playerRightW; // 15790 twips
      const playerColWidths = [playerLeftW, playerRightW];

      const playerRows: TableRow[] = [];

      // Row 1: Placement Map (RENDERED IMAGE WITH ALL TOWERS, EDITS, AND CUSTOMIZATIONS)
      if (!player.hideMap) {
        const rightChildren: Paragraph[] = [];

        try {
          // Render the customized map canvas directly to a high-res (2400px) JPEG image!
          const renderedMap = await renderCustomMapToImage(
            player.mapPhoto,
            player.tokens || [],
            player.zones || [],
            1.6,
            !player.hideMapLabels
          );

          if (renderedMap && renderedMap.dataUrl) {
            // Sized exactly by the real cell content width: EMU = twips * 635 (15 * 635 = 9525 EMU = 1 px)
            const availableTwips = playerRightW - (cellPadding.left + cellPadding.right);
            const mapW = Math.round(availableTwips / 15);
            const mapAr = renderedMap.width / renderedMap.height || 1.6;
            const mapH = Math.round(mapW / mapAr);

            rightChildren.push(
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 40, after: 40 },
                children: [
                  new ImageRun({
                    type: (renderedMap.type || 'jpg') as 'jpg' | 'png',
                    data: renderedMap.dataUrl,
                    transformation: {
                      width: mapW,
                      height: mapH
                    }
                  })
                ]
              })
            );
          }
        } catch (err) {
          console.error('Failed to render map for player:', err);
        }

        if (rightChildren.length === 0) {
          rightChildren.push(new Paragraph({ children: [] }));
        }

        playerRows.push(
          new TableRow({
            children: [
              new TableCell({
                width: { size: playerLeftW, type: WidthType.DXA },
                shading: { type: ShadingType.CLEAR, fill: headerBg },
                borders: thinBorder,
                margins: cellPadding,
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({
                        text: player.mapTitle || 'Placement Map',
                        font: FONT_SPEC,
                        bold: true,
                        size: TABLE_TEXT_MIN_SIZE_PT * 2,
                        color: textPrimary
                      })
                    ]
                  })
                ]
              }),
              new TableCell({
                width: { size: playerColWidths[1], type: WidthType.DXA },
                shading: { type: ShadingType.CLEAR, fill: contentBg },
                borders: thinBorder,
                margins: cellPadding,
                children: rightChildren
              })
            ]
          })
        );
      }

      // Row 2: Notes
      if (!player.hideNotes && player.notes) {
        playerRows.push(
          new TableRow({
            children: [
              new TableCell({
                width: { size: playerLeftW, type: WidthType.DXA },
                shading: { type: ShadingType.CLEAR, fill: headerBg },
                borders: thinBorder,
                margins: cellPadding,
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: player.notesTitle || 'Notes',
                        font: FONT_SPEC,
                        bold: true,
                        size: TABLE_TEXT_MIN_SIZE_PT * 2,
                        color: textPrimary
                      })
                    ]
                  })
                ]
              }),
              new TableCell({
                width: { size: playerColWidths[1], type: WidthType.DXA },
                shading: { type: ShadingType.CLEAR, fill: contentBg },
                borders: thinBorder,
                margins: cellPadding,
                children: (player.notes || '-').split('\n').map(
                  line =>
                    new Paragraph({
                      spacing: { before: 20, after: 20 },
                      children: [
                        new TextRun({
                          text: line,
                          font: FONT_SPEC,
                          italics: false,
                          size: TABLE_TEXT_MIN_SIZE_PT * 2,
                          color: textSecondary
                        })
                      ]
                    })
                )
              })
            ]
          })
        );
      }

      // Rows 3+: Wave Rows
      (player.waveRows || []).forEach(w => {
        playerRows.push(
          new TableRow({
            children: [
              new TableCell({
                width: { size: playerLeftW, type: WidthType.DXA },
                shading: { type: ShadingType.CLEAR, fill: headerBg },
                borders: thinBorder,
                margins: cellPadding,
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: w.wave || 'Wave ?',
                        font: FONT_SPEC,
                        bold: true,
                        size: TABLE_TEXT_MIN_SIZE_PT * 2,
                        color: textPrimary
                      })
                    ]
                  })
                ]
              }),
              new TableCell({
                width: { size: playerColWidths[1], type: WidthType.DXA },
                shading: { type: ShadingType.CLEAR, fill: contentBg },
                borders: thinBorder,
                margins: cellPadding,
                children: (w.instructions || '-').split('\n').map(
                  line =>
                    new Paragraph({
                      spacing: { before: 20, after: 20 },
                      children: [
                        new TextRun({
                          text: line,
                          font: FONT_SPEC,
                          italics: false,
                          size: TABLE_TEXT_MIN_SIZE_PT * 2,
                          color: textSecondary
                        })
                      ]
                    })
                )
              })
            ]
          })
        );
      });

      if (playerRows.length > 0) {
        tab2Children.push(
          new Table({
            width: { size: playerTotalW, type: WidthType.DXA },
            columnWidths: playerColWidths,
            layout: TableLayoutType.FIXED,
            alignment: AlignmentType.CENTER,
            rows: playerRows
          })
        );

        tab2Children.push(new Paragraph({ spacing: { before: 120, after: 120 }, children: [] }));
      }
    }
  }

  // 9. Common Issues Table
  if (!hiddenSections['commonIssues'] && docData.tab2.commonIssuesRows && docData.tab2.commonIssuesRows.length > 0) {
    tab2Children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: headingSpacing,
        children: [
          new TextRun({
            text: (docData.tab2.commonIssuesTitle || 'COMMON ISSUES').toUpperCase(),
            font: FONT_SPEC,
            bold: true,
            size: SECTION_HEADING_SIZE_PT * 2,
            color: HEADING_COLOR
          })
        ]
      })
    );

    if (docData.tab2.hideCommonIssuesTitles) {
      tab2Children.push(
        buildSingleColumnTable(
          docData.tab2.commonIssuesRows.map(issue => issue.reason || '-'),
          docData.tab2.commonIssuesTableWidth,
          docData.tab2.commonIssuesReasonHeader || 'Reason'
        )
      );
    } else {
      tab2Children.push(
        buildTwoColumnTable(
          docData.tab2.commonIssuesRows.map(issue => ({
            left: issue.wave || 'Title',
            right: issue.reason || '-'
          })),
          docData.tab2.commonIssuesTableWidth,
          0.28,
          [
            docData.tab2.commonIssuesTitlesHeader || 'Titles',
            docData.tab2.commonIssuesReasonHeader || 'Reason'
          ]
        )
      );
    }
  }

  // ================= EXTRA CUSTOM PAGES (if any) =================
  const extraPagesChildren: (Paragraph | Table)[] = [];
  if (docData.extraPages && docData.extraPages.length > 0) {
    for (const ep of docData.extraPages) {
      extraPagesChildren.push(
        new Paragraph({
          pageBreakBefore: true,
          children: []
        })
      );

      extraPagesChildren.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: headingSpacing,
          children: [
            new TextRun({
              text: (ep.title || 'EXTRA SECTION').toUpperCase(),
              font: FONT_SPEC,
              bold: true,
              size: SECTION_HEADING_SIZE_PT * 2,
              color: HEADING_COLOR
            })
          ]
        })
      );

      if (ep.content) {
        extraPagesChildren.push(
          new Paragraph({
            spacing: { before: 60, after: 120 },
            children: [
              new TextRun({
                text: ep.content,
                font: FONT_SPEC,
                italics: false,
                size: TABLE_TEXT_MIN_SIZE_PT * 2,
                color: textSecondary
              })
            ]
          })
        );
      }

      if (ep.tableRows && ep.tableRows.length > 0) {
        extraPagesChildren.push(
          buildTwoColumnTable(
            ep.tableRows.map(r => ({ left: r.label || 'Note', right: r.content || '-' })),
            100,
            0.28
          )
        );
      }
    }
  }

  // End watermark paragraph (regular body paragraph, not header/footer)
  const watermarkParagraph = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 720, after: 120 }, // ~36 pt margin before the watermark
    children: [
      new TextRun({
        text: WATERMARK_TEXT,
        font: FONT_SPEC,
        bold: false,
        italics: false,
        color: 'FFFFFF',
        size: 26, // 13 pt (26 half-points)
        characterSpacing: 40 // subtle tracking/letter-spacing
      })
    ]
  });

  // Assemble full Word Document with Google Docs Outline styles
  const docx = new Document({
    background: {
      color: pageBg
    },
    styles: {
      default: {
        document: {
          run: {
            font: FONT_SPEC,
            size: TABLE_TEXT_MIN_SIZE_PT * 2
          }
        },
        heading1: {
          run: {
            font: FONT_SPEC,
            bold: true,
            size: SECTION_HEADING_SIZE_PT * 2,
            color: HEADING_COLOR
          },
          paragraph: {
            alignment: AlignmentType.CENTER,
            spacing: headingSpacing
          }
        },
        heading2: {
          run: {
            font: FONT_SPEC,
            bold: true,
            size: SUB_HEADING_SIZE_PT * 2,
            color: HEADING_COLOR
          },
          paragraph: {
            alignment: AlignmentType.CENTER,
            spacing: headingSpacing
          }
        }
      }
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: geometry.landscape
                ? Math.max(geometry.portraitHeightTwips, Math.round((widestTableTwips + 2 * geometry.marginTwips) * 1.414))
                : widestTableTwips + 2 * geometry.marginTwips,
              height: geometry.landscape
                ? widestTableTwips + 2 * geometry.marginTwips
                : Math.max(geometry.portraitHeightTwips, Math.round((widestTableTwips + 2 * geometry.marginTwips) * 1.414)),
              orientation: geometry.landscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT
            },
            margin: {
              top: geometry.marginTwips,
              right: geometry.marginTwips,
              bottom: geometry.marginTwips,
              left: geometry.marginTwips
            }
          }
        },
        children: [...tab1Children, ...tab2Children, ...extraPagesChildren, watermarkParagraph]
      }
    ]
  });

  // Generate binary package and initiate instant direct browser download
  const blob = await Packer.toBlob(docx);
  const cleanTitle = (docData.tab2.strategyTitle || 'TDS_Strategy')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 32);
  saveAs(blob, `${cleanTitle}_${Date.now()}.docx`);
}

/**
 * Copies rich styled HTML for Google Docs (docs.new) in sleek black & white theme
 */
export async function copyCustomDocHtmlToClipboard(docData: CustomDocTemplate): Promise<boolean> {
  const tableStyleFor = (widthPct: number | undefined) =>
    `border-collapse: collapse; width: ${normalizeTableWidth(widthPct)}%; margin: 14px auto; font-family: Arial, sans-serif; font-size: 13px; background-color: #0a0a0a; color: #ffffff;`;
  const tdLeft =
    'border: 1px solid #404040; background-color: #171717; color: #ffffff; padding: 10px 14px; font-weight: bold; width: 25%; vertical-align: top;';
  const tdRight =
    'border: 1px solid #404040; padding: 10px 14px; vertical-align: top; color: #e5e5e5; line-height: 1.6; white-space: pre-wrap;';

  const extractBulletText = (r: TableRowItem) => {
    let text = (r.text ?? '').trim();
    if (!text) {
      const lbl = (r.label ?? '').trim();
      const cnt = (r.content ?? '').trim();
      const validLbl = lbl && lbl.toLowerCase() !== 'title' ? lbl : '';
      const validCnt = cnt && cnt !== '-' && cnt.toLowerCase() !== 'write here...' ? cnt : '';
      if (validLbl && validCnt) text = `${validLbl}: ${validCnt}`;
      else if (validCnt) text = validCnt;
      else if (validLbl) text = validLbl;
    }
    return text && text !== '-' ? text : '';
  };

  const notesItems = docData.tab1.notesRows.map(extractBulletText).filter(Boolean);
  const notesHtml = notesItems.length > 0
    ? `<ul style="margin: 0; padding-left: 24px; color: #e5e5e5; line-height: 1.8;">${notesItems.map(item => `<li style="margin-bottom: 6px;">${item}</li>`).join('')}</ul>`
    : '';

  const loadoutHtml = docData.tab2.loadoutRows
    .map(
      lr =>
        `<tr><td style="${tdLeft}">${lr.playerTitle}</td><td style="${tdRight}">${lr.slots.map(s => s.name).filter(Boolean).join(' | ')}</td></tr>`
    )
    .join('');

  const topNotesItems = docData.tab2.topNotesRows.map(extractBulletText).filter(Boolean);
  const topNotesHtml = topNotesItems.length > 0
    ? `<ul style="margin: 0; padding-left: 24px; color: #e5e5e5; line-height: 1.8;">${topNotesItems.map(item => `<li style="margin-bottom: 6px;">${item}</li>`).join('')}</ul>`
    : '';

  const categoriesHtml = docData.tab1.categories
    .map(
      cat => `
        <h2 style="color: #ffffff; font-size: 20px; text-align: center; margin-top: 20px; text-transform: uppercase;">${cat.title}</h2>
        <p style="text-align: center; font-size: 14px; color: #a3a3a3;">${cat.members.map(m => m.name || 'Name').join(' • ')}</p>
      `
    )
    .join('');

  const playersHtml = docData.tab2.players
    .map(
      p => `<div style="box-sizing: border-box; width: ${normalizeTableWidth(p.tableWidth)}%; margin: 24px auto 0 auto; padding: 16px; background-color: #111111; border: 1px solid #333333; border-radius: 8px;">
        <h3 style="color: #ffffff; margin: 0 0 4px 0; font-size: 20px;">${p.playerTitle}</h3>
        <p style="color: #a3a3a3; font-size: 12px; margin: 0 0 12px 0;">${p.difficultyBadge}</p>
        <p style="color: #d4d4d4; font-size: 13px;"><b>Towers:</b> ${p.towers.map(t => t.name).filter(Boolean).join(', ')}</p>
        ${!p.hideMap ? `<p style="color: #d4d4d4; font-size: 13px;"><b>${p.mapTitle || 'Map Markers'} (${p.tokens.length}):</b> ${p.tokens.map(t => `${t.label} (${t.towerName || 'Tower'})`).join(', ')}</p>` : ''}
        ${!p.hideNotes ? `<div style="background-color: #0a0a0a; border: 1px solid #262626; padding: 12px; border-radius: 6px; margin: 10px 0; font-size: 13px; line-height: 1.6; white-space: pre-wrap;"><b style="color: #ffffff;">${p.notesTitle || 'Notes'}:</b><br/>${p.notes || '-'}</div>` : ''}
        ${p.waveRows.map(w => `<p style="margin: 6px 0; font-size: 13px;"><b style="color: #ffffff;">${w.wave || 'Wave ?'}:</b> ${w.instructions || '-'}</p>`).join('')}
      </div>`
    )
    .join('');

  const commonIssuesHtml = docData.tab2.commonIssuesRows
    .map(i => {
      if (docData.tab2.hideCommonIssuesTitles) {
        return `<tr><td style="${tdRight}">${i.reason || 'write here...'}</td></tr>`;
      }
      return `<tr><td style="${tdLeft}">${i.wave || 'Title'}</td><td style="${tdRight}">${i.reason || 'write here...'}</td></tr>`;
    })
    .join('');

  const fullHtml = `
  <div style="font-family: Arial, sans-serif; background-color: #000000; color: #ffffff; padding: 24px; max-width: 820px; border: 2px solid #333333;">
    <h1 style="color: #ffffff; text-align: center; font-size: 28px; margin-bottom: 4px; letter-spacing: 2px;">STRATUM STRATEGY DOCUMENT</h1>
    <p style="text-align: center; color: #a3a3a3; font-size: 13px; margin-bottom: 24px; white-space: pre-wrap;">${docData.tab1.subBannerText}</p>

    ${categoriesHtml}

    ${notesHtml ? `
    <h2 style="color: #ffffff; font-size: 24px; text-align: center; margin-top: 28px;">${docData.tab1.notesTitle}</h2>
    <div style="width: ${normalizeTableWidth(docData.tab1.notesTableWidth)}%; margin: 14px auto; padding: 14px; background-color: #0e0e11; border: 1px solid #333333; border-radius: 8px;">
      ${notesHtml}
    </div>` : ''}

    ${
      topNotesHtml
        ? `<h2 style="color: #ffffff; font-size: 24px; text-align: center; margin-top: 32px;">${docData.tab2.topNotesTitle}</h2>
    <div style="width: ${normalizeTableWidth(docData.tab2.topNotesTableWidth)}%; margin: 14px auto; padding: 14px; background-color: #0e0e11; border: 1px solid #333333; border-radius: 8px;">
      ${topNotesHtml}
    </div>`
        : ''
    }

    <h2 style="color: #ffffff; font-size: 24px; text-align: center; margin-top: 32px;">${docData.tab2.loadoutsTitle}</h2>
    <table style="${tableStyleFor(docData.tab2.loadoutsTableWidth)}">
      ${loadoutHtml}
    </table>

    <h2 style="color: #ffffff; font-size: 26px; text-align: center; margin-top: 32px;">${docData.tab2.strategyTitle}</h2>
    ${playersHtml}

    <h2 style="color: #ffffff; font-size: 24px; text-align: center; margin-top: 32px;">${docData.tab2.commonIssuesTitle}</h2>
    <table style="${tableStyleFor(docData.tab2.commonIssuesTableWidth)}">
      ${commonIssuesHtml}
    </table>
  </div>
  `;

  try {
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard && navigator.clipboard.write) {
      const blobHtml = new Blob([fullHtml], { type: 'text/html' });
      const blobText = new Blob([docData.tab1.subBannerText], { type: 'text/plain' });
      await navigator.clipboard.write([
        new ClipboardItem({ 'text/html': blobHtml, 'text/plain': blobText })
      ]);
      return true;
    } else {
      await navigator.clipboard.writeText(fullHtml);
      return true;
    }
  } catch (e) {
    console.error('Clipboard copy failed:', e);
    return false;
  }
}
