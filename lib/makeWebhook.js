export async function sendToMake(action, data) {
  const webhookUrl = process.env.MAKE_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn('MAKE_WEBHOOK_URL not set – skipping webhook');
    return;
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, data }),
    });
    if (!res.ok) {
      console.error('Make webhook error:', res.status, await res.text());
    }
  } catch (err) {
    console.error('Make webhook fetch failed:', err.message);
  }
}
