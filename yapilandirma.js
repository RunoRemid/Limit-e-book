/* ========================================================================
   yapilandirma.js — Canlı kip ayarları
   ------------------------------------------------------------------------
   Bu dosyada GİZLİ ANAHTAR BULUNMAZ ve bulunmamalıdır.
   
   - OpenAI anahtarı yalnızca sunucuda (Supabase Edge Function
     secret'ı ya da .env) durur; tarayıcı onu asla görmez.
   - Supabase "anon" anahtarı tasarımı gereği herkese açıktır
     (Supabase belgelerinde "publishable" olarak geçer); güvenlik
     RLS politikalarıyla sağlanır. Bu yüzden burada durması
     sakıncasızdır.
     
   Alanlar boş bırakılırsa uygulama tümüyle çevrimdışı çalışır:
   koç kural tabanlı motora, analitik de sessiz kapalı kipe düşer.
   Demo hiçbir koşulda kırılmaz.
   ======================================================================== */

window.LimitAyar = {

  /* --- Sokratik koç: uzak servis ----------------------------------------
     Supabase Edge Function adresi:
       https://<PROJE_REF>.supabase.co/functions/v1/limit-koc
     Yerel Node vekil sunucusu için:
       http://localhost:8787/limit-koc
     Boş bırakılırsa çevrimdışı kural motoru kullanılır.            */
  aiUcNokta: 'https://bqlmpbqwewqxytramphs.supabase.co/functions/v1/limit-koc',

  /* Sunucudaki izinli model listesiyle eşleşmeli. */
  aiModel: 'gpt-4o-mini',

  /* --- Supabase ---------------------------------------------------------
     Panel → Project Settings → Data API
       supabaseUrl      : Project URL
       supabaseAnonKey  : anon / publishable key                  */
  supabaseUrl: 'https://bqlmpbqwewqxytramphs.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxbG1wYnF3ZXdxeHl0cmFtcGhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxNDk3MzksImV4cCI6MjEwMjcyNTczOX0.9x-jpavIyC3pznigKpNGKjuAq0vI18xFOrdcU0-5kH4',

  /* Analitik olaylarını Supabase'e yaz. Yukarıdaki iki alan boşsa
     bu değer true olsa bile analitik kendini kapatır. */
  analitikAcik: true,

  /* Çok kiracılı kurulumda kayıtları ayırmak için etiket. */
  kurum: 'limit-demo'
};