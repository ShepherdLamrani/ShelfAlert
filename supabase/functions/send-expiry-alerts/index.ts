import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_KEY = Deno.env.get('SERVICE_ROLE_KEY')!
```

Then run:
```
supabase secrets set --env-file .env --project-ref vkkufrrpuxnxfybrgovk
```

And redeploy:
```
supabase functions deploy send-expiry-alerts --project-ref vkkufrrpuxnxfybrgovk
const RESEND_KEY   = Deno.env.get('RESEND_API_KEY')!
const ALERT_EMAIL  = Deno.env.get('ALERT_EMAIL')!

serve(async () => {
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY)
  const { data: products } = await sb.from('products').select('*')

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const expired   = products?.filter(p => new Date(p.expiry) <= today) || []
  const expiring  = products?.filter(p => {
    const days = Math.round((new Date(p.expiry).getTime() - today.getTime()) / 86400000)
    return days > 0 && days <= 30
  }) || []
  const lowStock  = products?.filter(p => p.qty <= 10) || []

  if (expired.length === 0 && expiring.length === 0 && lowStock.length === 0) {
    return new Response('No alerts today', { status: 200 })
  }

  let html = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
    <h2 style="color:#185FA5;">ShelfAlert — Daily Report</h2>`

  if (expired.length > 0) {
    html += `<h3 style="color:#b91c1c;">🚨 Expired (${expired.length})</h3><ul>`
    expired.forEach(p => { html += `<li><strong>${p.name}</strong> — expired ${p.expiry} (${p.qty} units)</li>` })
    html += `</ul>`
  }

  if (expiring.length > 0) {
    html += `<h3 style="color:#d97706;">⚠️ Expiring soon (${expiring.length})</h3><ul>`
    expiring.forEach(p => {
      const days = Math.round((new Date(p.expiry).getTime() - today.getTime()) / 86400000)
      html += `<li><strong>${p.name}</strong> — expires in ${days} days (${p.expiry})</li>`
    })
    html += `</ul>`
  }

  if (lowStock.length > 0) {
    html += `<h3 style="color:#2563eb;">📦 Low stock (${lowStock.length})</h3><ul>`
    lowStock.forEach(p => { html += `<li><strong>${p.name}</strong> — only ${p.qty} units left</li>` })
    html += `</ul>`
  }

  html += `<p style="color:#9ca3af;font-size:12px;margin-top:2rem;">Sent by ShelfAlert • shelfalert.vercel.app</p></div>`

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