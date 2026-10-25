const token = 'EAAZA9RcswjD8BS6JGaAUhxHZCFcHa3WRuL4tIVGKd7RbZAZAgTYJjb3R59zZCUcSjEDZCtXWOZBSeTBh598v1dOmNEM8dwPKrqUGMZAN177az4OTbhHAVcr0lXYfz5cHWvZCXqeuhmRlvbZB6xItvtFbaBqdZBJuNa4EuCmKPCZCheRfFJxZB95SXAPp2u506vLIV4gZCejQZDZD';
const wabaId = '1422106223369083';

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
  console.log('Result:', JSON.stringify(data, null, 2));
} catch (err) {
  console.error('Error:', err);
}
