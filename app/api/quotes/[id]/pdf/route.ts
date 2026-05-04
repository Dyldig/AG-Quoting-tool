import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const LOGO_SRC = `${APP_URL}/jeffries-logo.jpg`

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const view = request.nextUrl.searchParams.get('view') ?? 'customer'
  const isInternal = view === 'internal'

  try {
    const supabase = await createServiceClient()
    const { data: quote, error } = await supabase
      .from('quotes')
      .select('*, region:regions(*), lines:quote_lines(*, product:products(*)), blend:quote_blends(*, amendments:blend_amendments(*, amendment:amendments(*))), profile:profiles!created_by(full_name)')
      .eq('id', params.id)
      .single()

    if (error || !quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    const hasBlend = !!(quote.blend)

    // Blend cumulative freight
    const compostLine = hasBlend
      ? (quote.lines ?? []).find((l: any) => l.product?.category === 'compost')
      : null
    const compostFreightRate = hasBlend && quote.fulfilment_type === 'delivery'
      ? (compostLine?.freight ?? 0)
      : 0
    const totalBaseTonnes = (quote.lines ?? []).reduce((s: number, l: any) => s + (l.volume_t ?? 0), 0)
    const totalAmendmentTonnes = hasBlend
      ? (quote.blend?.amendments ?? []).reduce((s: number, a: any) => s + a.quantity_tonnes, 0)
      : 0
    const blendFreightTotal = compostFreightRate * (totalBaseTonnes + totalAmendmentTonnes)

    const productSubtotal = (quote.lines ?? []).reduce((s: number, l: any) => s + l.line_total, 0)
    const blendFeeTotal = quote.blend?.blend_fee_total ?? 0
    const blendAmendmentTotal = (quote.blend?.amendments ?? []).reduce((s: number, a: any) => s + a.line_total, 0)
    const blendTotal = blendFeeTotal + blendAmendmentTotal + blendFreightTotal
    const subtotal = productSubtotal + blendTotal
    const gstAmount = quote.gst_type === 'ex' ? subtotal * 0.1 : 0
    const grandTotal = subtotal + gstAmount
    const effectiveTotal = quote.override_total ?? grandTotal

    const html = generatePDFHtml({
      quote, isInternal, subtotal, gstAmount, grandTotal, effectiveTotal,
      hasBlend, compostFreightRate, totalBlendTonnes: totalBaseTonnes + totalAmendmentTonnes, blendFreightTotal,
    })

    // Use Puppeteer
    const puppeteer = await import('puppeteer')
    const browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const pdfRaw = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
    })
    await browser.close()
    const pdfBuffer = Buffer.from(pdfRaw)

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${quote.quote_number}-${view}.pdf"`,
      },
    })
  } catch (err: any) {
    console.error('PDF generation error:', err)
    return NextResponse.json({ error: 'PDF generation failed', detail: err.message }, { status: 500 })
  }
}

function generatePDFHtml({ quote, isInternal, subtotal, gstAmount, grandTotal, effectiveTotal, hasBlend, compostFreightRate, totalBlendTonnes, blendFreightTotal }: {
  quote: any
  isInternal: boolean
  subtotal: number
  gstAmount: number
  grandTotal: number
  effectiveTotal: number
  hasBlend: boolean
  compostFreightRate: number
  totalBlendTonnes: number
  blendFreightTotal: number
}) {
  const creatorName = (quote.profile as any)?.full_name || null

  const lineRows = (quote.lines ?? []).map((line: any) => {
    const isPellet = line.product?.category === 'pellets'
    const effectiveFreight = isPellet ? (line.freight_override ?? 0) : line.freight
    const freightLabel = isPellet
      ? (effectiveFreight > 0 ? formatCurrency(effectiveFreight) : 'Ex gate')
      : hasBlend ? 'Blend' : (line.freight > 0 ? formatCurrency(line.freight) : 'Pickup')

    return `
    <tr>
      <td>${line.product?.name ?? '—'}<br><small style="color:#888">${line.product?.sku ?? ''} · ${line.uom === 'm3' ? 'm³' : 't'}</small></td>
      <td class="num">${line.volume} ${line.uom === 'm3' ? 'm³' : 't'}</td>
      ${isInternal ? `<td class="num">${formatCurrency(line.base_price)}</td>${!hasBlend ? `<td class="num">${freightLabel}</td>` : ''}` : ''}
      <td class="num">${formatCurrency(line.line_total)}</td>
    </tr>
  `}).join('')

  const blendRows = quote.blend ? (quote.blend.amendments ?? []).map((a: any) => `
    <tr>
      <td>${a.amendment?.name ?? a.custom_name ?? 'Amendment'}</td>
      <td class="num">${a.quantity_tonnes.toFixed(3)} t</td>
      <td class="num">${formatCurrency(a.rate_per_tonne)}/t</td>
      <td class="num">${formatCurrency(a.line_total)}</td>
    </tr>
  `).join('') : ''

  const validUntil = quote.valid_until
    ? new Date(quote.valid_until).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
    : (() => { const d = new Date(); d.setDate(d.getDate() + 60); return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }) })()

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', sans-serif; font-size: 11pt; color: #31261D; line-height: 1.5; }
  .header { background: #31261D; color: white; padding: 20px 0; margin-bottom: 32px; }
  .header-inner { display: flex; justify-content: space-between; align-items: center; }
  .logo-wrap { display: flex; align-items: center; }
  .quote-meta { text-align: right; }
  .quote-number { font-size: 16pt; font-weight: 500; }
  .quote-date { color: #ecdcc8; font-size: 9pt; margin-top: 4px; }
  .section { margin-bottom: 24px; }
  h2 { font-size: 9pt; font-weight: 500; text-transform: uppercase; letter-spacing: 0.08em; color: #878800; margin-bottom: 12px; border-bottom: 1px solid #ecdcc8; padding-bottom: 6px; }
  .customer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .field-label { font-size: 8pt; color: #888; text-transform: uppercase; letter-spacing: 0.06em; }
  .field-value { font-weight: 500; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f7f0e7; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 500; padding: 8px 10px; text-align: left; }
  th.num, td.num { text-align: right; }
  td { padding: 8px 10px; border-bottom: 1px solid #ecdcc8; font-size: 10pt; }
  .totals { margin-left: auto; width: 280px; }
  .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 10pt; }
  .totals-row.total { font-weight: 500; font-size: 13pt; color: #878800; border-top: 2px solid #878800; margin-top: 6px; padding-top: 10px; }
  .totals-row.sub { color: #666; }
  .override-note { background: #fff8e1; border: 1px solid #f59e0b; padding: 10px 14px; margin-top: 16px; font-size: 9pt; }
  .disclaimer-note { background: #f7f0e7; border-left: 3px solid #878800; padding: 8px 12px; margin-top: 16px; font-size: 9pt; color: #31261D; }
  .validity { font-size: 9pt; color: #888; margin-top: 24px; border-top: 1px solid #ecdcc8; padding-top: 16px; }
  .conditions { margin-top: 32px; border-top: 2px solid #878800; padding-top: 20px; }
  .conditions h3 { font-size: 9pt; font-weight: 500; color: #31261D; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; margin-top: 16px; }
  .conditions h3:first-child { margin-top: 0; }
  .conditions p { font-size: 8.5pt; color: #666; line-height: 1.6; margin-bottom: 6px; }
  .badge { display: inline-block; background: #f7f0e7; color: #31261D; font-size: 8pt; padding: 2px 8px; font-weight: 500; text-transform: capitalize; }
  .badge.complex { background: #fef3c7; color: #92400e; }
  .internal-banner { background: #878800; color: white; text-align: center; padding: 6px; font-size: 9pt; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 16px; }
</style>
</head>
<body>
${isInternal ? '<div class="internal-banner">INTERNAL — CONFIDENTIAL</div>' : ''}
<div class="header">
  <div class="header-inner">
    <div class="logo-wrap">
      <img src="${LOGO_SRC}" style="height:80px;width:auto" alt="Jeffries Agriculture">
    </div>
    <div class="quote-meta">
      <div class="quote-number">${quote.quote_number}</div>
      ${quote.quote_name ? `<div style="color:#ecdcc8;font-size:9pt;margin-top:3px">${quote.quote_name}</div>` : ''}
      <div class="quote-date">${new Date(quote.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
      ${creatorName ? `<div style="color:#ecdcc8;font-size:8.5pt;margin-top:2px">Prepared by: ${creatorName}</div>` : ''}
      <div style="color:#ecdcc8;font-size:8.5pt;margin-top:3px">Valid until <strong style="color:white">${validUntil}</strong></div>
      <div style="margin-top:8px;display:inline-block;background:#878800;color:white;padding:3px 10px;font-size:9pt;font-weight:500;text-transform:capitalize">${quote.status}</div>
    </div>
  </div>
</div>

${quote.quote_name ? `<div class="section" style="margin-bottom:16px"><div style="font-size:12pt;font-weight:500;color:#31261D">${quote.quote_name}</div></div>` : ''}
<div class="section">
  <h2>Customer Details</h2>
  <div class="customer-grid">
    <div><div class="field-label">Company</div><div class="field-value">${quote.customer_name}</div></div>
    ${quote.contact_name ? `<div><div class="field-label">Contact</div><div class="field-value">${quote.contact_name}</div></div>` : ''}
    ${quote.email ? `<div><div class="field-label">Email</div><div class="field-value">${quote.email}</div></div>` : ''}
    <div><div class="field-label">Region</div><div class="field-value">${(quote.region as any)?.name ?? '—'}</div></div>
    <div><div class="field-label">Fulfilment</div><div class="field-value" style="text-transform:capitalize">${quote.fulfilment_type}</div></div>
    <div><div class="field-label">GST</div><div class="field-value">${quote.gst_type === 'ex' ? 'Ex GST' : 'Inc GST'}</div></div>
  </div>
</div>

<div class="section">
  <h2>Products</h2>
  <table>
    <thead>
      <tr>
        <th>Product</th>
        <th>Volume</th>
        ${isInternal ? `<th class="num">Base Price</th>${!hasBlend ? '<th class="num">Freight</th>' : ''}` : ''}
        <th class="num">Total</th>
      </tr>
    </thead>
    <tbody>${lineRows}</tbody>
  </table>
</div>

${quote.blend && (quote.blend.amendments ?? []).length > 0 ? `
<div class="section">
  <h2>Blend — <span class="badge ${quote.blend.classification}">${quote.blend.classification}</span></h2>
  <table>
    <thead>
      <tr><th>Amendment</th><th class="num">Qty (t)</th><th class="num">Rate</th><th class="num">Total</th></tr>
    </thead>
    <tbody>${blendRows}</tbody>
  </table>
  ${isInternal ? `
  <div style="margin-top:10px;padding:10px;background:#f7f0e7;">
    <strong>Blend fee:</strong> ${formatCurrency(quote.blend.blend_fee_rate)}/t × ${(quote.blend.total_base_tonnes + quote.blend.total_amendment_tonnes).toFixed(2)} t = ${formatCurrency(quote.blend.blend_fee_total)}
    (${quote.blend.classification} classification)
  </div>` : ''}
  ${blendFreightTotal > 0 ? `
  <div style="margin-top:8px;padding:10px;background:#f7f0e7;">
    <strong>Blend freight:</strong> ${formatCurrency(compostFreightRate)}/t × ${totalBlendTonnes.toFixed(2)} t = ${formatCurrency(blendFreightTotal)}
  </div>` : ''}
</div>` : ''}

<div class="totals">
  ${(quote.blend && (quote.blend.blend_fee_total + ((quote.blend.amendments ?? []).reduce((s: number, a: any) => s + a.line_total, 0))) > 0) ? `<div class="totals-row sub"><span>Blend subtotal</span><span>${formatCurrency(quote.blend.blend_fee_total + (quote.blend.amendments ?? []).reduce((s: number, a: any) => s + a.line_total, 0))}</span></div>` : ''}
  ${blendFreightTotal > 0 ? `<div class="totals-row sub"><span>Blend freight</span><span>${formatCurrency(blendFreightTotal)}</span></div>` : ''}
  <div class="totals-row sub"><span>Subtotal</span><span>${formatCurrency(subtotal)}</span></div>
  ${quote.gst_type === 'ex' ? `<div class="totals-row sub"><span>GST (10%)</span><span>${formatCurrency(gstAmount)}</span></div>` : ''}
  <div class="totals-row total"><span>TOTAL</span><span>${formatCurrency(effectiveTotal)}</span></div>
  ${isInternal && quote.override_total ? `<div class="override-note">⚠ Manual override applied. Calculated total: ${formatCurrency(grandTotal)}. Override: ${formatCurrency(quote.override_total)}.</div>` : ''}
</div>

${quote.notes ? `<div class="section" style="margin-top:24px"><h2>Notes</h2><p>${quote.notes}</p></div>` : ''}

${isInternal && quote.disclaimer_acknowledged && quote.disclaimer_acknowledged_at ? `
<div class="disclaimer-note">
  ✓ Customer disclaimer acknowledged by sales representative on ${new Date(quote.disclaimer_acknowledged_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}${creatorName ? ` (${creatorName})` : ''}.
</div>` : ''}

${!isInternal ? `
<div class="conditions">
  <h3>Conditions of Quotation</h3>
  <p>All information provided in this quote is 'commercial in confidence'.</p>
  <p>If acceptance of this quote exceeds sixty (60) days, the quoted price may be subject to change.</p>
  <p>If Jeffries are required to purchase additional products, or hold stock for a period of time, this may incur holding costs or the quoted value of the purchased goods to be invoiced.</p>
  <p>This quote incorporates Jeffries' standard terms of contract for the sale of goods and hire of equipment (found on the back of all Jeffries invoices).</p>

  <h3>Product Information</h3>
  <p>The products Jeffries manufacture are made from recycled organics, meaning better quality, nutrient rich, compost, soil and mulch, contributing to a more sustainable environment. While we continue to invest in new technologies and processes to remove visual contaminants, some will still appear in the finished product. These visual contaminants will not affect product performance in any way.</p>
  <p>Thank you for the opportunity to provide you with this quote. This is an indicative price only. Prices quoted are m³/t for one unit per line item.</p>
</div>` : ''}

<div class="validity">
  <p>This quote is valid until <strong>${validUntil}</strong>. All prices are in Australian Dollars (AUD) and ${quote.gst_type === 'ex' ? 'exclude' : 'include'} GST unless otherwise stated.</p>
  <p style="margin-top:6px">For questions, please contact your Jeffries Agriculture sales representative.</p>
  <p style="margin-top:8px;font-size:8pt;color:#aaa">Generated by Jeffries Quoting Tool · ${quote.quote_number}${quote.quote_name ? ` · ${quote.quote_name}` : ''}</p>
</div>
</body>
</html>`
}
