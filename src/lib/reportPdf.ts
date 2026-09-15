/* The release QA report as a PDF, with the Evident logo as a watermark.

   Built in the browser with jsPDF and saved straight to the downloads folder.
   This module only lays the document out: the caller loads jsPDF and the logo
   and hands them in, so the library is fetched only when someone downloads,
   and the layout can be produced outside a browser to be checked. */
import type { jsPDF as JsPDF } from 'jspdf'
import type { ReportPoint, ReportRisk, SavedReport } from '../api'

type Doc = InstanceType<typeof JsPDF>
type Point = ReportPoint & { severity?: ReportRisk['severity'] }
type RGB = [number, number, number]

export const REPORT_SECTIONS: Array<{
  key: 'findings' | 'gaps' | 'risks' | 'recommendations'
  title: string
}> = [
  { key: 'findings', title: 'Key findings' },
  { key: 'gaps', title: 'Gaps' },
  { key: 'risks', title: 'Risks' },
  { key: 'recommendations', title: 'Recommendations' },
]

// A4 in millimetres
const PAGE = { w: 210, h: 297, left: 18, right: 18, top: 20, bottom: 18 }
const WIDTH = PAGE.w - PAGE.left - PAGE.right
const INK: RGB = [11, 11, 11]
const MUTED: RGB = [120, 118, 112]
const SEVERITY: Record<ReportRisk['severity'], RGB> = {
  high: [163, 38, 38],
  medium: [138, 93, 0],
  low: [110, 108, 102],
}
// faint enough to read through; it sits under the text in any case
const WATERMARK_OPACITY = 0.07
const WATERMARK_WIDTH = 150

/** Millimetres from one baseline to the next at a font size, with leading. */
const leading = (pt: number) => pt * 0.3528 * 1.45

/** The PDF's built-in fonts cover Latin-1 only. The typographic punctuation a
    model writes is mapped to its plain form rather than printed as junk. */
function plain(text: string): string {
  return text
    .replace(/[‘’′]/g, "'")
    .replace(/[“”″]/g, '"')
    .replace(/[–—−]/g, '-')
    .replace(/…/g, '...')
    .replace(/↔/g, '<->')
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/[•●]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '')
    .trim()
}

export function reportFileName(saved: SavedReport): string {
  const name = `qa-report-${saved.releaseName}${saved.period ? `-${saved.period}` : ''}`
  return `${name.replace(/[\\/:*?"<>|\s]+/g, '-')}.pdf`
}

/** Width and height from a PNG's header, so the logo keeps its proportions. */
function pngSize(png: Uint8Array): { w: number; h: number } {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  return { w: view.getUint32(16), h: view.getUint32(20) }
}

export function buildReportPdf(JsPDFClass: typeof JsPDF, saved: SavedReport,
                               logo: Uint8Array): Doc {
  const doc = new JsPDFClass({ unit: 'mm', format: 'a4' })
  const { w: logoW, h: logoH } = pngSize(logo)
  const markW = WATERMARK_WIDTH
  const markH = markW * (logoH / logoW)

  /* Drawn first on every page, so the text lands on top of it: the logo has a
     white background, and laid over the words it would wash them out. */
  const watermark = () => {
    doc.saveGraphicsState()
    // jsPDF builds a graphics state with `new doc.GState`; its typings only
    // describe the instance, so the constructor is named here
    const GState = doc.GState as unknown as new (options: { opacity: number }) =>
      Parameters<Doc['setGState']>[0]
    doc.setGState(new GState({ opacity: WATERMARK_OPACITY }))
    doc.addImage(logo, 'PNG', (PAGE.w - markW) / 2, (PAGE.h - markH) / 2, markW, markH,
                 'evident-logo', 'FAST')
    doc.restoreGraphicsState()
  }

  let y = PAGE.top
  watermark()

  /** Start a new page when the next `need` millimetres will not fit. */
  const room = (need: number) => {
    if (y + need > PAGE.h - PAGE.bottom) {
      doc.addPage()
      watermark()
      y = PAGE.top
    }
  }
  const font = (style: 'normal' | 'bold' | 'italic', pt: number, color: RGB) => {
    doc.setFont('helvetica', style)
    doc.setFontSize(pt)
    doc.setTextColor(...color)
  }
  const lines = (text: string, width: number): string[] => doc.splitTextToSize(text, width)

  const paragraph = (text: string, pt: number, color: RGB, style: 'normal' | 'italic' = 'normal') => {
    font(style, pt, color)
    for (const line of lines(plain(text), WIDTH)) {
      room(leading(pt))
      y += leading(pt)
      doc.text(line, PAGE.left, y)
    }
  }

  const heading = (title: string) => {
    room(14)
    y += 7
    font('bold', 9.5, MUTED)
    doc.text(title.toUpperCase(), PAGE.left, y)
    y += 1.5
  }

  const item = (point: Point, number: string | null) => {
    const pt = 10.5
    const lh = leading(pt)
    const indent = 6
    const x = PAGE.left + indent
    const width = WIDTH - indent
    const text = plain(point.text)

    // the severity label shares the first line with the text that follows it
    const label = point.severity ? `${point.severity.toUpperCase()}  ` : ''
    font('bold', 8.5, INK)
    const labelW = label ? doc.getTextWidth(label) : 0
    font('normal', pt, INK)
    const first = lines(text, width - labelW)[0] ?? ''
    const rest = text.slice(first.length).trim()
    const all = [first, ...(rest ? lines(rest, width) : [])]

    room(lh * Math.min(all.length, 2))
    y += lh
    if (number) {
      font('normal', pt, MUTED)
      doc.text(number, PAGE.left, y)
    } else {
      doc.setFillColor(...MUTED)
      doc.circle(PAGE.left + 1.6, y - 1.25, 0.65, 'F')
    }
    if (label && point.severity) {
      font('bold', 8.5, SEVERITY[point.severity])
      doc.text(label, x, y)
    }
    font('normal', pt, INK)
    doc.text(first, x + labelW, y)
    for (const line of all.slice(1)) {
      room(lh)
      y += lh
      doc.text(line, x, y)
    }

    if (point.added) {
      const last = all[all.length - 1]
      const lastX = x + (all.length === 1 ? labelW : 0)
      const lastW = doc.getTextWidth(last)
      const tag = '(from the data)'
      font('italic', 8.5, MUTED)
      const tagW = doc.getTextWidth(tag)
      if (lastX + lastW + 2 + tagW <= PAGE.left + WIDTH) {
        doc.text(tag, lastX + lastW + 2, y)
      } else {
        room(lh)
        y += lh
        doc.text(tag, x, y)
      }
    }
    y += 1.8
  }

  // --- the document -----------------------------------------------------------
  const r = saved.report
  font('bold', 18, INK)
  y += 6
  doc.text(plain(`QA report - ${saved.releaseName}`), PAGE.left, y)
  y += 2
  // the provenance note rides in this line rather than trailing the report: at
  // the foot it spilled a one-page report onto an otherwise empty second page
  paragraph(`Written from ${saved.releaseName}${saved.period ? ` · ${saved.period}` : ''} data · `
    + `${new Date(saved.createdAt).toLocaleString()} · by ${saved.createdBy} · ${saved.model}. `
    + 'Figures come from this release\'s dashboards'
    + ((saved.addedFromData ?? []).length
      ? '; lines marked "(from the data)" were added from them because the draft left them out.'
      : '.'), 9, MUTED)
  y += 2

  heading('Summary')
  paragraph(r.summary, 11, INK)

  for (const { key, title } of REPORT_SECTIONS) {
    const points: Point[] = r[key]
    if (!points.length) continue
    heading(title)
    points.forEach((point, i) => item(point, key === 'recommendations' ? `${i + 1}.` : null))
  }

  // page footers, once the page count is known
  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page)
    font('normal', 8, MUTED)
    doc.text(plain(`QA report - ${saved.releaseName}${saved.period ? ` · ${saved.period}` : ''}`),
             PAGE.left, PAGE.h - 10)
    doc.text(`Page ${page} of ${pages}`, PAGE.w - PAGE.right, PAGE.h - 10, { align: 'right' })
  }
  return doc
}
