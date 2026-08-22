// פרטי החיבור ל-Supabase — משותפים לכל דפי האתר (login, signup, forgot-password, reset-password)
const SUPABASE_URL = 'https://ldvhjpucksdnphsvyxgd.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_EeuKai3Lo7ZZdYtb_oh-1A_0zZk-4bq';

// יוצר קליינט אחד גלובלי שכל דף יכול להשתמש בו
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
