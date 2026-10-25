const token = process.env.WHATSAPP_API_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN;

if (!token) {
  console.error('No token found');
  process.exit(1);
}

// 1. מי המשתמש/אפליקציה של הטוקן
const meRes = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${token}`);
const meData = await meRes.json();
console.log('Token owner / app:', JSON.stringify(meData, null, 2));

// 2. אילו חשבונות WABA משויכים ישירות לטוקן הזה
const wabasRes = await fetch(`https://graph.facebook.com/v21.0/me/extended_credit_lines?access_token=${token}`);
const sharedRes = await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name,businesses{id,name,owned_whatsapp_business_accounts{id,name}}&access_token=${token}`);
const sharedData = await sharedRes.json();
console.log('Accessible Businesses & WABAs:', JSON.stringify(sharedData, null, 2));
