-- =============================================================
-- Limit Sayısal Demo · Analitik şeması
-- -------------------------------------------------------------
-- Bu projede zaten canlı veri ve 90+ tablo var. Çakışma olmasın
-- diye tüm nesneler "limit_" önekiyle adlandırılmıştır.
--
-- Tek tablo + iki görünüm yaklaşımı seçildi: olay günlüğü esnektir,
-- yeni bir ölçüm eklemek için şema değiştirmek gerekmez.
--
-- GÜVENLİK ÖZETİ
--   · RLS açık.
--   · anon YALNIZCA INSERT yapabilir (öğrenci tarayıcısı).
--   · anon SELECT/UPDATE/DELETE YAPAMAZ — kimse başkasının
--     verisini okuyamaz, kimse kayıt silemez.
--   · Raporlar service_role ile (SQL Editor / sunucu) okunur.
-- =============================================================

-- -------------------------------------------------------------
-- 1) Olay günlüğü
-- -------------------------------------------------------------
create table if not exists public.limit_olay (
  id              bigint generated always as identity primary key,
  olusturma       timestamptz not null default now(),

  -- Rastgele oturum kimliği. Kişisel veri DEĞİLDİR; ad, e-posta,
  -- IP gibi hiçbir tanımlayıcı toplanmaz.
  oturum          uuid        not null,

  -- Çok kiracılı kurulumda kayıtları ayırmak için etiket.
  kurum           text        not null default 'limit-demo',

  tur             text        not null
                  check (tur in ('oturum','soru_goruntuleme','soru_cevap','koc_mesaj','video_izleme')),

  brans           text        check (brans is null or brans in
                                ('matematik','geometri','fizik','kimya','biyoloji')),
  sayfa_id        text,
  soru_id         text,
  soru_no         smallint    check (soru_no is null or (soru_no between 1 and 99)),

  secim           text        check (secim is null or secim in ('A','B','C','D','E')),
  dogru_mu        boolean,
  sure_sn         integer     check (sure_sn is null or (sure_sn between 0 and 86400)),
  ipucu_kademe    smallint    check (ipucu_kademe is null or (ipucu_kademe between 0 and 10)),

  -- 'sayfa' = kitabın basılı anahtarı, 'cozuldu' = çözülerek bulundu,
  -- 'demo'  = yalnızca demo için atanmış değer.
  -- Rapor okurken hangi cevapların resmî olduğunu ayırt etmeyi sağlar.
  anahtar_kaynagi text        check (anahtar_kaynagi is null or
                                anahtar_kaynagi in ('sayfa','cozuldu','demo')),

  ekstra          jsonb,

  -- Şişkin gövde ile tablo doldurulmasın
  constraint limit_olay_ekstra_boyut
    check (ekstra is null or pg_column_size(ekstra) < 4096)
);

comment on table public.limit_olay is
  'Limit TYT-AYT Sayısal e-kitap demosu · anonim öğrenci etkileşim günlüğü';

-- -------------------------------------------------------------
-- 2) Dizinler
-- -------------------------------------------------------------
create index if not exists limit_olay_zaman_idx
  on public.limit_olay (olusturma desc);

create index if not exists limit_olay_oturum_idx
  on public.limit_olay (oturum, olusturma desc);

create index if not exists limit_olay_soru_idx
  on public.limit_olay (soru_id)
  where tur = 'soru_cevap';

create index if not exists limit_olay_brans_idx
  on public.limit_olay (kurum, brans, olusturma desc);

-- -------------------------------------------------------------
-- 3) RLS
-- -------------------------------------------------------------
alter table public.limit_olay enable row level security;

-- Öğrenci tarayıcısı yalnızca YAZAR.
drop policy if exists limit_olay_yaz on public.limit_olay;
create policy limit_olay_yaz
  on public.limit_olay
  for insert
  to anon, authenticated
  with check (
    -- Geçmişe/geleceğe kayıt uydurulmasın
    olusturma between now() - interval '1 day' and now() + interval '1 hour'
  );

-- Okuma, güncelleme ve silme için POLİTİKA YOK.
-- RLS açıkken politikası olmayan işlem reddedilir; yalnızca
-- service_role (SQL Editor, sunucu tarafı) erişebilir.

-- -------------------------------------------------------------
-- 4) Raporlama görünümleri
--    security_invoker: görünüm, çağıranın yetkisiyle çalışır.
--    Böylece anon bu görünümleri sorgulasa bile boş döner.
-- -------------------------------------------------------------
create or replace view public.limit_ozet_brans
with (security_invoker = true) as
select
  kurum,
  brans,
  count(*) filter (where tur = 'soru_cevap')                             as cevap_sayisi,
  count(*) filter (where tur = 'soru_cevap' and dogru_mu is true)        as dogru,
  count(*) filter (where tur = 'soru_cevap' and dogru_mu is false)       as yanlis,
  round(
    100.0 * count(*) filter (where tur = 'soru_cevap' and dogru_mu is true)
    / nullif(count(*) filter (where tur = 'soru_cevap'), 0)
  , 1)                                                                   as basari_yuzde,
  round(avg(sure_sn) filter (where tur = 'soru_cevap'), 1)               as ortalama_sure_sn,
  count(*) filter (where tur = 'koc_mesaj')                              as koc_mesaji,
  count(*) filter (where tur = 'video_izleme')                           as video_izleme,
  count(distinct oturum)                                                 as oturum_sayisi
from public.limit_olay
where brans is not null
group by kurum, brans;

comment on view public.limit_ozet_brans is
  'Branş bazında doğru/yanlış oranı, ortalama süre, koç ve video kullanımı';

create or replace view public.limit_ozet_soru
with (security_invoker = true) as
select
  kurum,
  brans,
  sayfa_id,
  soru_id,
  soru_no,
  max(anahtar_kaynagi)                                                   as anahtar_kaynagi,
  count(*)                                                               as deneme,
  count(*) filter (where dogru_mu is true)                               as dogru,
  round(
    100.0 * count(*) filter (where dogru_mu is true) / nullif(count(*), 0)
  , 1)                                                                   as basari_yuzde,
  round(avg(sure_sn), 1)                                                 as ortalama_sure_sn,
  round(avg(ipucu_kademe), 2)                                            as ortalama_ipucu_kademesi,
  -- En çok işaretlenen yanlış şık: çeldirici analizi için
  mode() within group (order by secim) filter (where dogru_mu is false)  as en_sik_yanlis_sik
from public.limit_olay
where tur = 'soru_cevap'
group by kurum, brans, sayfa_id, soru_id, soru_no;

comment on view public.limit_ozet_soru is
  'Soru bazında zorluk göstergesi: başarı oranı, süre, ipucu ihtiyacı, en sık işaretlenen yanlış şık';
