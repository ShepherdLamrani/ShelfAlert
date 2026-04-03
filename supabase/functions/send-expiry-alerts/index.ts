import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_KEY   = Deno.env.get('RESEND_API_KEY')!
const ALERT_EMAIL  = Deno.env.get('ALERT_EMAIL')!

serve(async () => {
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY)
  const { data: products } = await sb.from('products').select('*')

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const expired  = products?.filter(p => new Date(p.expiry) <= today) || []
  const expiring = products?.filter(p => {
    const days = Math.round((new Date(p.expiry).getTime() - today.getTime()) / 86400000)
    return days > 0 && days <= 30
  }) || []
  const lowStock = products?.filter(p => p.qty <= 10) || []

  if (expired.length === 0 && expiring.length === 0 && lowStock.length === 0) {
    return new Response('No alerts today', { status: 200 })
  }

  const date = today.toLocaleDateString('en-IE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const sectionRow = (emoji: string, color: string, title: string, items: string) => `
    <tr>
      <td style="padding: 0 0 24px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #e2e4e8;border-radius:10px;overflow:hidden;">
          <tr>
            <td style="background:${color};padding:12px 20px;">
              <span style="font-size:14px;font-weight:600;color:#fff;">${emoji} ${title}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 20px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                ${items}
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>`

  const itemRow = (name: string, detail: string) => `
    <tr>
      <td style="padding:6px 0;border-bottom:1px solid #f0f1f3;">
        <span style="font-size:13px;font-weight:600;color:#1a1a1a;">${name}</span>
        <span style="font-size:12px;color:#6b7280;margin-left:8px;">${detail}</span>
      </td>
    </tr>`

  let sections = ''

  if (expired.length > 0) {
    const items = expired.map(p => itemRow(p.name, `Expired ${p.expiry} — ${p.qty} units`)).join('')
    sections += sectionRow('🚨', '#b91c1c', `Expired (${expired.length})`, items)
  }

  if (expiring.length > 0) {
    const items = expiring.map(p => {
      const days = Math.round((new Date(p.expiry).getTime() - today.getTime()) / 86400000)
      return itemRow(p.name, `Expires in ${days} day${days === 1 ? '' : 's'} — ${p.expiry}`)
    }).join('')
    sections += sectionRow('⚠️', '#d97706', `Expiring Soon (${expiring.length})`, items)
  }

  if (lowStock.length > 0) {
    const items = lowStock.map(p => itemRow(p.name, `${p.qty} units remaining`)).join('')
    sections += sectionRow('📦', '#2563eb', `Low Stock (${lowStock.length})`, items)
  }

  const html = `
  <!DOCTYPE html>
  <html>
  <body style="margin:0;padding:0;background:#f4f5f7;font-family:'Segoe UI',system-ui,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 16px;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

            <!-- Header -->
            <tr>
              <td style="background:#fff;border:1px solid #e2e4e8;border-radius:10px 10px 0 0;padding:20px 24px;border-bottom:none;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td>
                      <table cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="width:4px;background:#185FA5;border-radius:2px;padding:0;vertical-align:middle;">
                            <div style="width:4px;height:36px;"></div>
                          </td>
                          <td style="padding-left:10px;vertical-align:middle;">
                            <div style="font-size:20px;font-weight:700;color:#0f1923;letter-spacing:-0.3px;">Shelf<span style="color:#185FA5;">Alert</span></div>
                            <div style="font-size:9px;color:#6b7280;letter-spacing:2px;text-transform:uppercase;margin-top:2px;">Expiry Management</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                    <td align="right" style="vertical-align:middle;">
                      <div style="font-size:12px;color:#6b7280;">${date}</div>
                      <div style="font-size:11px;color:#9ca3af;margin-top:2px;">Daily Alert Report</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Summary bar -->
            <tr>
              <td style="background:#185FA5;padding:12px 24px;">
                <span style="font-size:13px;color:#fff;font-weight:500;">
                  ${expired.length} expired &nbsp;·&nbsp; ${expiring.length} expiring soon &nbsp;·&nbsp; ${lowStock.length} low stock
                </span>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="background:#f4f5f7;padding:24px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  ${sections}
                </table>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:#fff;border:1px solid #e2e4e8;border-radius:0 0 10px 10px;padding:16px 24px;border-top:none;text-align:center;">
                <p style="font-size:12px;color:#9ca3af;margin:0;">
                  Sent by <strong style="color:#185FA5;">ShelfAlert</strong> &nbsp;·&nbsp;
                  <a href="https://shelf-alert-kappa.vercel.app" style="color:#185FA5;text-decoration:none;">Open app</a>
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>`

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'ShelfAlert <onboarding@resend.dev>',
      to: ALERT_EMAIL,
      subject: `ShelfAlert — ${expired.length} expired, ${expiring.length} expiring soon`,
      html
    })
  })

  return new Response('Alerts sent', { status: 200 })
})