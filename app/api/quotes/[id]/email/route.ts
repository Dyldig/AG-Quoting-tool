import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createServiceClient()
    const { data: quote, error } = await supabase
      .from('quotes')
      .select('*, region:regions(*), lines:quote_lines(*, product:products(*))')
      .eq('id', params.id)
      .single()

    if (error || !quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    if (!quote.email) {
      return NextResponse.json({ error: 'Quote has no customer email address' }, { status: 400 })
    }

    const productSubtotal = (quote.lines ?? []).reduce((s: number, l: any) => s + l.line_total, 0)
    const subtotal = productSubtotal
    const gstAmount = quote.gst_type === 'ex' ? subtotal * 0.1 : 0
    const grandTotal = subtotal + gstAmount
    const effectiveTotal = quote.override_total ?? grandTotal

    // Fetch PDF
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const pdfRes = await fetch(`${appUrl}/api/quotes/${params.id}/pdf?view=customer`)
    const pdfBuffer = await pdfRes.arrayBuffer()

    const lineItemsHtml = (quote.lines ?? []).map((l: any) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #ecdcc8;">${l.product?.name ?? '—'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #ecdcc8;text-align:right;">${l.volume} ${l.uom === 'm3' ? 'm³' : 't'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #ecdcc8;text-align:right;font-weight:500;">${formatCurrency(l.line_total)}</td>
      </tr>
    `).join('')

    const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f7f0e7;font-family:'DM Sans',Arial,sans-serif;color:#31261D;">
<div style="max-width:580px;margin:32px auto;background:white;border:1px solid #ecdcc8;">
  <!-- Header -->
  <div style="background:#31261D;padding:24px 32px;">
    <div style="font-size:20px;font-weight:500;color:#ecdcc8;">
      Jeffries <span style="color:#878800;">Agriculture</span>
    </div>
    <div style="color:#ecdcc8;font-size:12px;margin-top:4px;">Compost · Mulch · Soil Amendments</div>
  </div>

  <!-- Body -->
  <div style="padding:32px;">
    <p style="margin-bottom:24px;">Dear ${quote.contact_name ?? quote.customer_name},</p>
    <p style="margin-bottom:24px;">Thank you for your enquiry. Please find your quote <strong>${quote.quote_number}</strong> attached to this email.</p>

    <!-- Quote summary -->
    <div style="margin-bottom:24px;">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;font-weight:500;color:#878800;margin-bottom:10px;border-bottom:1px solid #ecdcc8;padding-bottom:6px;">
        Quote Summary
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f7f0e7;">
            <th style="padding:8px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.06em;font-weight:500;">Product</th>
            <th style="padding:8px 12px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:0.06em;font-weight:500;">Volume</th>
            <th style="padding:8px 12px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:0.06em;font-weight:500;">Total</th>
          </tr>
        </thead>
        <tbody>${lineItemsHtml}</tbody>
      </table>
      <div style="text-align:right;margin-top:12px;padding-top:12px;border-top:2px solid #878800;">
        <span style="font-size:16px;font-weight:500;color:#878800;">Total: ${formatCurrency(effectiveTotal)}</span>
        <span style="font-size:10px;color:#888;display:block;margin-top:2px;">${quote.gst_type === 'ex' ? 'Including GST' : 'GST included'}</span>
      </div>
    </div>

    <p style="margin-bottom:24px;color:#666;font-size:13px;">
      This quote is valid for 30 days. The full quote PDF with detailed breakdown is attached.
    </p>

    <p style="color:#666;font-size:13px;">
      If you have any questions, please don't hesitate to contact your Jeffries Agriculture sales representative.
    </p>
  </div>

  <!-- Footer -->
  <div style="background:#f7f0e7;padding:16px 32px;font-size:11px;color:#888;">
    Jeffries Agriculture · South Australia · This email and any attachments are for the named recipient only.
  </div>
</div>
</body>
</html>
    `

    await resend.emails.send({
      from: 'Jeffries Agriculture <quotes@jeffries.com.au>',
      to: quote.email,
      subject: `Quote ${quote.quote_number} from Jeffries Agriculture`,
      html,
      attachments: [
        {
          filename: `${quote.quote_number}-quote.pdf`,
          content: Buffer.from(pdfBuffer),
        },
      ],
    })

    // Update email_sent_at on the quote
    await supabase
      .from('quotes')
      .update({ email_sent_at: new Date().toISOString(), status: 'sent' })
      .eq('id', params.id)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Email send error:', err)
    return NextResponse.json({ error: 'Email send failed', detail: err.message }, { status: 500 })
  }
}
