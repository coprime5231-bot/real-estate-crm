/**
 * 產生「電腦標籤-40號」風格的 .docx：每頁 1 個 table、6 row、1 cell/row。
 * 每個 cell 包含寄件人地址 + 收件人地址 + 收件人姓名（含「親啟」）。
 *
 * 寫法：load 空模板（lib/labels/template-40.docx）→ 用新建的 table XML
 * 取代原本的單一空 table → 多頁之間插 page break。保留模板的 sectPr
 * （page size / margins）讓列印對齊 40 號標籤紙。
 */

import path from 'path'
import { readFileSync } from 'fs'
import PizZip from 'pizzip'

export const SENDER_ADDRESS = '高雄市左營區博愛二路196號'

export interface Label {
  address: string
  name: string // e.g. "林先生 親啟"
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * 一個 cell 內的 paragraphs：
 *  1. 寄件人地址（左上、預設大小）
 *  2-3. 空白行（縮成 16）
 *  4. 收件人地址（粗體 40、輕度左縮）
 *  5. 收件人姓名 + 親啟（粗體 40、深度縮排）
 *
 * label 為 null 時只放寄件人地址、其餘空白（補白卡片用）。
 */
function cellInner(label: Label | null): string {
  let xml = ''

  // 1. sender
  xml += `<w:p><w:pPr><w:ind w:left="144" w:right="144"/></w:pPr>`
  xml += `<w:r><w:rPr><w:rFonts w:hint="eastAsia"/><w:color w:val="000000"/><w:szCs w:val="24"/></w:rPr><w:t>${xmlEscape(SENDER_ADDRESS)}</w:t></w:r>`
  xml += `</w:p>`

  // 2-3. spacers
  xml += `<w:p><w:pPr><w:ind w:left="144" w:right="144"/><w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:pPr></w:p>`
  xml += `<w:p><w:pPr><w:ind w:left="144" w:right="144"/><w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:pPr></w:p>`

  if (label) {
    // 4. recipient address (bold 40, leading whitespace)
    xml += `<w:p><w:pPr><w:ind w:left="144" w:right="144"/></w:pPr>`
    xml += `<w:r><w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:t xml:space="preserve">          </w:t></w:r>`
    xml += `<w:r><w:rPr><w:rFonts w:hint="eastAsia"/><w:b/><w:bCs/><w:color w:val="000000"/><w:sz w:val="40"/><w:szCs w:val="40"/></w:rPr><w:t>${xmlEscape(label.address)}</w:t></w:r>`
    xml += `</w:p>`

    // 5. recipient name (bold 40, deep indent)
    xml += `<w:p><w:pPr><w:ind w:leftChars="900" w:left="4162" w:right="144" w:hangingChars="500" w:hanging="2002"/></w:pPr>`
    xml += `<w:r><w:rPr><w:rFonts w:hint="eastAsia"/><w:b/><w:bCs/><w:color w:val="000000"/><w:sz w:val="40"/><w:szCs w:val="40"/></w:rPr><w:t>${xmlEscape(label.name)}</w:t></w:r>`
    xml += `</w:p>`
  }

  return xml
}

function buildCell(label: Label | null): string {
  return `<w:tc><w:tcPr><w:tcW w:w="11340" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>${cellInner(label)}</w:tc>`
}

function buildRow(label: Label | null): string {
  return `<w:tr><w:tblPrEx><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPrEx><w:trPr><w:cantSplit/><w:trHeight w:hRule="exact" w:val="2722"/></w:trPr>${buildCell(label)}</w:tr>`
}

function buildTable(labels: (Label | null)[]): string {
  const padded: (Label | null)[] = labels.slice(0, 6)
  while (padded.length < 6) padded.push(null)

  let xml = `<w:tbl>`
  xml += `<w:tblPr>`
  xml += `<w:tblW w:w="0" w:type="auto"/>`
  xml += `<w:tblLayout w:type="fixed"/>`
  xml += `<w:tblCellMar><w:left w:w="15" w:type="dxa"/><w:right w:w="15" w:type="dxa"/></w:tblCellMar>`
  xml += `<w:tblLook w:val="0000" w:firstRow="0" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="0" w:noVBand="0"/>`
  xml += `</w:tblPr>`
  xml += `<w:tblGrid><w:gridCol w:w="11340"/></w:tblGrid>`
  for (const l of padded) xml += buildRow(l)
  xml += `</w:tbl>`
  return xml
}

/**
 * 切多頁、每頁 6 個、最後一頁不足 6 個 cell 用 null 補白。
 */
function buildBody(labels: Label[]): string {
  const pages: Label[][] = []
  for (let i = 0; i < labels.length; i += 6) {
    pages.push(labels.slice(i, i + 6))
  }
  if (pages.length === 0) pages.push([])

  const pageBreak = `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`
  return pages.map((p) => buildTable(p)).join(pageBreak)
}

/**
 * Main: 拿模板 → 替換 body 內容 → 回傳新 .docx Buffer。
 */
export function buildLabelsDocx(labels: Label[]): Buffer {
  const templatePath = path.join(process.cwd(), 'lib', 'labels', 'template-40.docx')
  const templateBuf = readFileSync(templatePath)
  const zip = new PizZip(templateBuf)

  const docFile = zip.file('word/document.xml')
  if (!docFile) throw new Error('template missing word/document.xml')
  const docXml = docFile.asText()

  // 抓 sectPr（頁面設定要保留）
  const sectPrMatch = docXml.match(/<w:sectPr[^>]*>[\s\S]*?<\/w:sectPr>/)
  const sectPr = sectPrMatch ? sectPrMatch[0] : ''

  // body 開頭、結尾
  const bodyOpen = '<w:body>'
  const bodyClose = '</w:body>'
  const bodyStart = docXml.indexOf(bodyOpen)
  const bodyEnd = docXml.indexOf(bodyClose)
  if (bodyStart < 0 || bodyEnd < 0) throw new Error('template body not found')

  const newBody = bodyOpen + buildBody(labels) + sectPr + bodyClose
  const newDocXml = docXml.slice(0, bodyStart) + newBody + docXml.slice(bodyEnd + bodyClose.length)

  zip.file('word/document.xml', newDocXml)
  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' })
}
