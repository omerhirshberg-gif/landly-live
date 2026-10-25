const token = process.env.WHATSAPP_API_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN;
const wabaId = '1422106223369083';

if (!token) {
  console.error('Missing WhatsApp Access Token in .env.production.local');
  process.exit(1);
}

const body = {
  name: 'landly_otp_code',
  category: 'AUTHENTICATION',
  language: 'en_US',
  components: [
    {
      type: 'BODY',
      add_security_recommendation: true
    },
    {
      type: 'FOOTER',
      code_expiration_minutes: 10
    },
    {
      type: 'BUTTONS',
      buttons: [
        {
          type: 'OTP',
          otp_type: 'COPY_CODE',
          text: 'Copy code'
        }
      ]
    }
  ]
};

try {
  const res = await fetch(`https://graph.facebook.com/v21.0/${wabaId}/message_templates`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  console.log('Response:', JSON.stringify(data, null, 2));
} catch (err) {
  console.error('Error:', err);
}
