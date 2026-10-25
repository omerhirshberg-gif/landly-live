const token = 'EAAZA9RcswjD8BS6JGaAUhxHZCFcHa3WRuL4tIVGKd7RbZAZAgTYJjb3R59zZCUcSjEDZCtXWOZBSeTBh598v1dOmNEM8dwPKrqUGMZAN177az4OTbhHAVcr0lXYfz5cHWvZCXqeuhmRlvbZB6xItvtFbaBqdZBJuNa4EuCmKPCZCheRfFJxZB95SXAPp2u506vLIV4gZCejQZDZD';

// 1. בדיקת הרשאות (Permissions / Scopes)
const permRes = await fetch(`https://graph.facebook.com/v21.0/me/permissions?access_token=${token}`);
const perms = await permRes.json();
console.log('1. Scopes / Permissions:');
console.log(JSON.stringify(perms, null, 2));

// 2. אילו חשבונות WABA הטוקן הזה מורשה לראות
const wabaRes = await fetch(`https://graph.facebook.com/v21.0/1422106223369083?fields=id,name,message_templates&access_token=${token}`);
const wabaData = await wabaRes.json();
console.log('2. Direct WABA Access:');
console.log(JSON.stringify(wabaData, null, 2));
