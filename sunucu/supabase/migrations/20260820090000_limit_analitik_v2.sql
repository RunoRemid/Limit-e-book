-- =============================================================
-- Limit Sayısal Demo · Analitik şeması v2
-- Hata analitiği / istatistik paneli için gereken alanlar
-- -------------------------------------------------------------
-- v1 (20260819120000) uygulanmış olmalıdır; bu dosya onun üstüne
-- ekleme yapar. Tümü "if not exists" ile yazıldı, tekrar tekrar
-- çalıştırmak güvenlidir.
--
-- BU MIGRATION'DAKİ SQL, UYGULANMADAN ÖNCE GERİ ALINAN BİR İŞLEM
-- İÇİNDE ÇALIŞTIRILARAK DOĞRULANDI: 7 sütun eklendi, SELECT
-- politikası kuruldu, başlık yokken anon rolünün 0 satır gördüğü
-- fiilen sınandı, sonra rollback yapıldı.
-- =============================================================

-- -------------------------------------------------------------
-- 1) Analiz için eksik olan alanlar
-- -------------------------------------------------------------
alter table public.limit_olay
  -- Konu bazlı analizin çekirdeği. v1'de yalnızca sayfa_id vardı;
  -- konu adı satırda olmadan "hangi konuda zayıfım" sorulamıyordu.
  add column if not exists konu         text,
  add column if not exists unite        text,
  add column if not exists zorluk       smallint,
  -- Çeldirici analizi bunsuz yapılamaz: hangi YANLIŞ şıkkın
  -- tekrar tekrar seçildiğini görmek için doğru şık da gerekir.
  add column if not exists dogru_sik    text,
  -- Deneme hakkı sınırsız olduğu için "kaçıncı denemede" bilgisi
  -- tek anlamlı başarı ölçüsüdür. v1'de ekstra jsonb içinde
  -- gömülüydü; sorgulanabilir sütuna çıkarıldı.
  add column if not exists deneme_no    smallint,
  add column if not exists ilk_denemede boolean,
  -- Gerçek hakimiyet ile desteklenmiş başarıyı ayırmak için.
  add column if not exists koc_yardimi  boolean;

comment on column public.limit_olay.konu         is 'Sayfanın konu başlığı (ör. "Vektörler - III")';
comment on column public.limit_olay.unite        is 'Üst başlık / ünite';
comment on column public.limit_olay.zorluk       is '1 kolay · 2 orta · 3 zor';
comment on column public.limit_olay.dogru_sik    is 'Doğru şık — çeldirici analizi için';
comment on column public.limit_olay.deneme_no    is 'Bu sorudaki kaçıncı deneme (1 = ilk)';
comment on column public.limit_olay.ilk_denemede is 'Doğru cevap ilk denemede mi bulundu';
comment on column public.limit_olay.koc_yardimi  is 'Cevaptan önce koçtan yardım alındı mı';

-- Kısıtlar ayrı ayrı; "add constraint if not exists" Postgres'te yok,
-- bu yüzden varlık kontrolü ile eklenir.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'limit_olay_zorluk_ck') then
    alter table public.limit_olay add constraint limit_olay_zorluk_ck
      check (zorluk is null or zorluk between 1 and 3);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'limit_olay_dogru_sik_ck') then
    alter table public.limit_olay add constraint limit_olay_dogru_sik_ck
      check (dogru_sik is null or dogru_sik in ('A','B','C','D','E'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'limit_olay_deneme_no_ck') then
    alter table public.limit_olay add constraint limit_olay_deneme_no_ck
      check (deneme_no is null or deneme_no between 1 and 50);
  end if;
end $$;

-- -------------------------------------------------------------
-- 2) Dizinler
-- -------------------------------------------------------------
create index if not exists limit_olay_konu_idx
  on public.limit_olay (kurum, konu, olusturma desc)
  where tur = 'soru_cevap';

create index if not exists limit_olay_oturum_cevap_idx
  on public.limit_olay (oturum, olusturma)
  where tur = 'soru_cevap';

-- -------------------------------------------------------------
-- 3) OKUMA POLİTİKASI
-- -------------------------------------------------------------
-- ⚠ BU GERÇEK GÜVENLİK DEĞİLDİR — BELİRSİZLİKTİR.
--
-- Giriş sistemi yok, dolayısıyla kriptografik kimlik de yok.
-- İstemci kendi oturum kimliğini X-Oturum başlığında gönderir;
-- politika bunu satırdaki oturum ile karşılaştırır.
--
--   SAĞLADIĞI  : Toplu döküm engellenir. Başlıksız istek 0 satır
--                döner (başarısız-kapanır). Kimse "select *" ile
--                tüm tabloyu çekemez.
--   SAĞLAMADIĞI: Bir oturum UUID'sini ele geçiren o oturumun
--                verisini okuyabilir. Başlık istemciden gelir,
--                sunucu doğrulamaz.
--
-- Şu an toplanan veride kişisel tanımlayıcı YOK (ad, e-posta, IP
-- toplanmıyor; oturum rastgele bir UUID). Kişisel veri eklenirse
-- bu yaklaşım YETERSİZDİR; Supabase Anonymous Auth'a geçilip
-- politika auth.uid() üzerine kurulmalıdır.
-- -------------------------------------------------------------
drop policy if exists limit_olay_kendi_oku on public.limit_olay;
create policy limit_olay_kendi_oku
  on public.limit_olay
  for select
  to anon, authenticated
  using (
    oturum::text = nullif(
      current_setting('request.headers', true)::json ->> 'x-oturum', ''
    )
  );

-- UPDATE ve DELETE için hâlâ politika YOK: kimse kayıt değiştiremez
-- veya silemez. Raporlama service_role ile yapılır (RLS'i atlar).
