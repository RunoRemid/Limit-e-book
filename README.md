# Limit Yayınları · TYT-AYT Sayısal e-Kitap Demosu

Orijinal soru bankası sayfaları üzerinde çalışan, Sokratik AI koçlu, **sıfır kurulum**
gerektiren etkileşimli kitap prototipi.

## Çalıştırma

`index.html` dosyasına çift tıklayın. Node.js, npm, derleme adımı ya da sunucu yoktur;
`file://` protokolü altında olduğu gibi çalışır.

> Tarayıcı: Chrome / Edge / Firefox güncel sürüm (CSS `color-mix`, `<dialog>`, WebP kullanılıyor).

## Klasör yapısı

```
limit-sayisal-demo/
├── index.html              Uygulama kabuğu, betik yükleme sırası burada
├── yapilandirma.js         Canlı kip ayarları (uç nokta, Supabase) — gizli anahtar YOK
├── css/
│   ├── tokens.css          Tasarım değişkenleri, sıfırlama, tipografi
│   ├── duzen.css           Uygulama kabuğu (grid), duyarlılık
│   ├── bilesenler.css      Düğme, rozet, kart, şık, koç modalı
│   ├── tarama.css          Kitap sayfası görüntüleyici (odak/tam sayfa, yakınlık)
│   └── video.css           "Öğretmen Çözümü İzle" düğmesi ve video modalı
├── data/
│   └── veri.js             window.LimitVeri — tüm içerik (JSON değil, global değişken)
├── img/
│   └── sorular/            Orijinal sayfa taramaları (10 × WebP, 1544 × 1920)
├── test/
│   └── dogrulama.html      Tarayıcıda açılan kontrol koşumu (110 kontrol)
├── sunucu/                 E-kitabın parçası DEĞİL — anahtarı saklayan uçlar
│   ├── supabase/
│   │   ├── functions/limit-koc/index.ts   OpenAI vekil sunucusu (Deno)
│   │   └── migrations/*.sql               Analitik şeması + RLS
│   └── node/               Yerel geliştirme alternatifi (Express)
└── src/
    ├── cekirdek.js         Ad alanı, yardımcılar, olay veri yolu, durum deposu
    ├── veri-servis.js      branş → sayfa → soru sorgu katmanı
    ├── analitik.js         Supabase olay günlüğü (SDK yok, saf fetch)
    ├── ai-sokratik.js      Limit Koç: prompt kurgusu + çevrimdışı motor + adaptör
    ├── ui-yanpanel.js      Branş sekmeleri ve sayfa/soru ağacı
    ├── ui-sayfa.js         Sahne: karşılama + tarama görüntüleyici
    ├── ui-koc.js           Koç açılır penceresi (yardım / çözüm kipleri)
    └── app.js              Önyükleme, yönlendirme, paneller, ayarlar
```

Betikler `index.html` içinde **sırayla** yüklenir:
`yapılandırma → veri → cekirdek → servis → analitik → ai → arayüz → app`.
Modül sistemi (import/export) bilinçli olarak kullanılmamıştır.

## Veri modeli: sayfa → soru

Kaynak, tek soru görselleri değil; her biri **4-6 soru taşıyan tam kitap sayfalarıdır**.
Model bu yüzden iki katmanlıdır:

| Katman | İçerik |
|---|---|
| `sayfa` | Bir tarama + künye (branş, test no, konu, ünite, kitap sayfası, sınav) |
| `soru`  | Sayfadaki tek bir soru + görsel üzerindeki **bölgesi**, şıkları, cevabı, özeti |

### İçerik envanteri

| Dosya | Branş | Test | Konu | Kitap s. | Sorular | Cevap anahtarı |
|---|---|---|---|---|---|---|
| `matematik 1.webp` | Matematik | 7 | Sayılar - VII | 17 | 1-6 | çözülerek bulundu |
| `matematik 2.webp` | Matematik | 6 | Sayılar - VI | 16 | 7-12 | sayfada basılı |
| `geometri 1.webp` | Geometri | 4 | Doğruda Açı - IV | 12 | 7-11 | sayfada basılı |
| `geometri 2.webp` | Geometri | 5 | Doğruda Açı - V | 13 | 1-6 | 3 çözüldü · 3 demo |
| `fizik 1.webp` | Fizik | 3 | Vektörler - III | 9 | 1-4 | çözülerek bulundu |
| `fizik 2.webp` | Fizik | 2 | Vektörler - II | 8 | 5-8 | sayfada basılı |
| `kimya 1.webp` | Kimya | 7 | Elementleri Tanıyalım - I | 17 | 1-4 | çözülerek bulundu |
| `kimya 2.webp` | Kimya | 6 | Periyodik Özellikler - II | 16 | 5-8 | sayfada basılı |
| `biyoloji 1.webp` | Biyoloji | 7 | Canlıların Temel Bileşenleri - III | 17 | 1-6 | çözülerek bulundu |
| `biyoloji 2.webp` | Biyoloji | 6 | Canlıların Temel Bileşenleri - II | 16 | 6-10 | sayfada basılı |

Toplam **10 sayfa · 50 soru**.

### Cevap anahtarı politikası ⚠

Demo akışının kesintisiz olması için **50 sorunun tamamında bir cevap vardır**. Ancak hepsi
aynı güvenilirlikte değildir; her sorunun `anahtarKaynagi` alanı değerin nereden geldiğini
söyler:

| Etiket | Adet | Anlamı | Yayına hazır mı? |
|---|---|---|---|
| `sayfa` | 24 | Kitabın sayfa altında basılı anahtarından okundu | Evet |
| `cozuldu` | 23 | Anahtar basılı değildi, soru çözülerek bulundu | Anahtarla karşılaştırılmalı |
| `demo` | 3 | Şekil güvenle okunamadı; değer **yalnızca demo akışı çalışsın diye** atandı | **Hayır — düzeltilmeli** |

`demo` etiketli üç soru: **GEO-T5** (Doğruda Açı - V) 1, 4 ve 5. Bu değerlerin doğruluğu
iddia edilmez.

Arayüz `sayfa` dışındaki soruların altında küçük bir rozet gösterir (`çözülerek bulundu` /
`demo anahtarı`), yan panelde de ilgili sayfanın yanında turuncu bir nokta belirir. Gerçek
anahtarlar elinize geçtiğinde yapılacak tek şey `dogru` alanını güncelleyip `anahtarKaynagi`
değerini `'sayfa'` yapmaktır. Rozetleri tümüyle gizlemek isterseniz `src/ui-sayfa.js`
içindeki `anahtarRozeti()` fonksiyonunun `null` dönmesi yeterlidir.

> Anahtarı olmayan soru için *öz değerlendirme* kod yolu yerinde duruyor (`dogru: null`);
> ileride anahtar bekleyen bir soru eklenirse arayüz çökmez, o soruda doğru/yanlış hükmü
> vermez. Doğrulama koşumu bu yolu sentetik bir soruyla test eder.

### Yeni sayfa ekleme

1. Taramayı `img/sorular/` altına koyun (dosya adı ne olursa olsun, boşluklu da olabilir).
2. `data/veri.js` → `sayfalar` dizisine künyeyi ve `sorular` listesini ekleyin.
3. Her soru için `sutun` ('sol'/'sag') ve `ust`/`alt` yüzdelerini verin — bölge otomatik üretilir.

## Sayısal düzen: taramanın okunabilirliği

Sayısal soruda denklemin ve şeklin net okunması hayati. Görüntüleyici bunu iki kiple çözer:

- **Odak (varsayılan)** — yalnızca seçili sorunun bölgesi ekrana yayılır. Sütun sınırları,
  sayfa ortasındaki ayraç çizgisi ve komşu sorunun numarası çerçeveye girmeyecek biçimde
  daraltılmıştır.
- **Tam sayfa** — sayfanın tamamı, en-boy oranı korunarak kapsayıcıya sığdırılır.

Her iki kipte de %100–%250 arası kademeli yakınlaştırma vardır.

### Odak matematiği

Kaydırma `transform` ile **değil**, yüzde `margin` ile yapılır. Yüzde margin — yatay da düşey
de — kapsayıcının **genişliğine** göre çözüldüğü için tek bir orana bağlıdır: JS'siz, tam
duyarlı ve `transform`un getirdiği alt piksel bulanıklığından muaf.

```
K   = 100 / bolge.en × yakinlik      → görsel genişliği (kapsayıcı katı)
ml% = −(bolge.x   × K)               → yatay kaydırma
mt% = −(bolge.y   × K × oran)        → düşey kaydırma   (oran = 1920/1544)
pb% =  (bolge.boy × K × oran)        → pencere yüksekliği
```

Tam sayfa kipi aynı formülün `bolge = {0, 0, 100, 100}` hâlidir.

Netlik için: görsel doğal boyutunun üstüne zorla büyütülmez, `image-rendering` zorlanmaz
(tarayıcının kendi yüksek kaliteli süzgeci en net sonucu verir), ölçekleme yalnızca genişlik
üzerinden yapılıp yükseklik oranla türetilir — şekiller hiçbir kipte ezilmez.

## Video çözüm

Kitap sayfalarının köşesindeki QR kod, o testin çözüm videosuna gider. Bu deneyim doğrudan
sorunun içine taşındı: soru kartının altındaki **▶ Öğretmen Çözümü İzle** düğmesi,
sayfanın üzerine 16:9 bir modal indirir ve videoyu `<iframe>` ile oynatır.

- Düğme, koçun laciverti ve markanın kırmızısından bilinçli olarak ayrışır — video izlemek
  yapay zekâdan yardım istemekten farklı bir eylemdir.
- Modal; çarpı, dışarı tıklama ve `Esc` ile kapanır. Kapanışta `iframe`in `src`si boşaltılır,
  böylece video arka planda çalmaya devam etmez.
- Modal açıkken kronometre durur ve klavye kısayolları arkadaki soruya işlemez.

### `video_url` alanı

Her soru nesnesinde `video_url` bulunur. Soruya özel bağlantı vermek için ilgili soruya
`video_url` yazmanız yeterlidir; `data/veri.js` sonundaki normalleştirme döngüsü yalnızca
boş olanları varsayılanla doldurur.

Ortak varsayılan adres `data/veri.js` başındaki `DEMO_VIDEO` sabitindedir. Adres **gömme
(embed)** biçiminde olmalıdır — `watch?v=` biçimi `<iframe>` içinde çalışmaz:

```
izleme : https://www.youtube.com/watch?v=VIDEO_ID
gömme  : https://www.youtube.com/embed/VIDEO_ID     ← veri.js'e bu yazılır
```

Not: `file://` altında bazı tarayıcılar üçüncü taraf gömme oynatıcılarını kısıtlayabilir.
Sunum sırasında sorun yaşarsanız klasörü basit bir yerel sunucuyla açmak yeterlidir
(mimari yine de kurulumsuzdur; sunucu yalnızca sunum kolaylığıdır).

## Öğrenci deneyimi

### Sınırsız deneme

Öğrenci bir şıkka bastığında soru **kilitlenmez** ve doğru cevap **açık edilmez**:

- Yanlış şık kırmızıya döner ve tekrar tıklanamaz; diğer şıklar açık kalır.
- Öğrenci doğruyu bulana kadar denemeye devam eder. Arayüzde "kalan hak" gibi bir
  ibare yoktur; sistem bunu doğal olarak yapar.
- Doğru bulunduğunda soru kilitlenir, kronometre durur, kaçıncı denemede bulunduğu
  ve süre gösterilir.

Bu yüzden istatistik "doğru/yanlış oranı" değil, **ilk denemede çözme oranıdır** —
sınırsız denemede herkes eninde sonunda doğruyu bulacağı için anlamlı olan tek ölçü budur.
Denemeler analitiğe `ekstra.deneme_no` alanıyla gider; şema değişikliği gerekmez.

### Koç: sabit panel yerine açılır pencere

Sağdaki sabit panel kaldırıldı — ekranı daraltıyordu ve soruyu okumayı zorlaştırıyordu.
Yerine soru kartının altında üç düğme var:

| Düğme | İşlev | Kısayol |
|---|---|---|
| ◈ Koç'tan yardım al | Sokratik ipucu — cevabı **asla** vermez | `K` |
| ✓ Koç çözsün | Adım adım çözüm ve doğru şık | `Ç` |
| ▶ Öğretmen Çözümü İzle | Video çözüm modalı | `V` |

İlk ikisi aynı koç penceresini açar, farklı kiple. **Kip mesaj başınadır:** "Koç çözsün"
tek seferlik bir çözüm isteğidir; sonrasında öğrencinin yazdığı mesajlar yeniden Sokratik
kipe döner.

> ⚠ **Çözüm kipi sunucu güncellemesi ister.** Edge Function her istekte kendi
> değiştirilemez kuralını ekler. Eski sürüm her koşulda "cevabı söyleme" diyordu; yeni
> sürüm kipe göre kural seçiyor (`KURALLAR[kip]`). Fonksiyonu yeniden dağıtmadan "Koç
> çözsün" çözümü anlatır ama doğru şıkkı adıyla yazmaz:
> ```bash
> cd sunucu && supabase functions deploy limit-koc
> ```

## Canlıya geçiş

Demo iki kipte çalışır ve **kip geçişi ayar dosyasından yapılır, kodda değişiklik gerekmez**:

| Kip | Koç | Analitik | Gereken |
|---|---|---|---|
| Çevrimdışı (varsayılan) | Kural tabanlı motor | Kapalı | Hiçbir şey |
| Canlı | OpenAI `gpt-4o-mini` | Supabase | Aşağıdaki adımlar |

`yapilandirma.js` boşken uygulama çevrimdışı kalır. Alanları doldurunca canlıya geçer.
Bir aksama olursa (sunucu kapalı, kota bitti, internet yok) koç **sessizce kural tabanlı
motora düşer** — sunum ortasında ekran boş kalmaz.

### Neden vekil sunucu?

OpenAI anahtarı tarayıcıya konursa herkes görür ve fatura size gelir. Bu yüzden anahtar
sunucuda durur; tarayıcı yalnızca sizin uç noktanıza konuşur, OpenAI'yi hiç görmez.

```
tarayıcı ──POST {sistem, mesajlar, model}──▶ vekil sunucu ──anahtar──▶ OpenAI
   ▲                                              │
   └──────────── {metin} ◀───────────────────────┘
```

Doğrulama koşumu bunu her seferinde sınar: istekte `sk-` ile başlayan hiçbir değer
bulunmadığını, modelin yapılandırmadan geldiğini ve sunucu hata verirse yerel motora
düşüldüğünü kontrol eder.

---

### Adım 1 — OpenAI anahtarını sunucuya koy

Anahtarı https://platform.openai.com/api-keys adresinden alın. **Hiçbir yere yapıştırmadan
önce**: bu anahtar `yapilandirma.js`'e, herhangi bir `.js` dosyasına veya git deposuna
GİRMEZ. Yalnızca aşağıdaki iki yerden birine.

**Supabase Edge Function ile (önerilen):**

```bash
npm i -g supabase                    # yalnızca bir kez
supabase login
supabase link --project-ref bqlmpbqwewqxytramphs

cd sunucu
supabase secrets set OPENAI_API_KEY=sk-...
supabase functions deploy limit-koc
```

Uç noktanız: `https://bqlmpbqwewqxytramphs.supabase.co/functions/v1/limit-koc`

> Anahtarı panelden de girebilirsiniz: **Edge Functions → Secrets → Add new secret**,
> ad `OPENAI_API_KEY`.

**Ya da yerel Node sunucusuyla (deneme için):**

```bash
cd sunucu/node
npm install
cp .env.ornek .env        # .env içine OPENAI_API_KEY=sk-... yazın
npm start
```

Uç noktanız: `http://localhost:8787/limit-koc` · Sağlık kontrolü: `/saglik`

### Adım 2 — Analitik tablosunu kur

```bash
cd sunucu
supabase db push
```

Panelden yapmak isterseniz: **SQL Editor** → yeni sorgu →
`sunucu/supabase/migrations/20260819120000_limit_analitik.sql` içeriğini yapıştırıp çalıştırın.

Oluşanlar:

| Nesne | Durum |
|---|---|
| `public.limit_olay` | tablo · RLS açık · 4 dizin |
| `limit_olay_yaz` | politika · yalnızca **INSERT**, `anon` + `authenticated` |
| `public.limit_ozet_brans` | görünüm · `security_invoker` |
| `public.limit_ozet_soru` | görünüm · `security_invoker` |

Kurulumdan sonra doğrulamak için (SQL Editor):

```sql
select
  (select count(*) from information_schema.tables
     where table_schema='public' and table_name='limit_olay')                    as tablo,
  (select relrowsecurity from pg_class where oid='public.limit_olay'::regclass)  as rls_acik,
  (select string_agg(policyname || ':' || cmd, ', ') from pg_policies
     where schemaname='public' and tablename='limit_olay')                       as politikalar;
```

Beklenen: `tablo = 1`, `rls_acik = true`, `politikalar = limit_olay_yaz:INSERT`.

> Bu şema, aynı SQL ile bir üretim projesinde bir kez kurulup rol değiştirilerek sınanmıştı:
> `anon` rolüyle INSERT başarılı, aynı rolle okunan satır sayısı 0. Yani politika hem
> yazmaya izin veriyor hem okumayı kapatıyor.

### Adım 3 — `yapilandirma.js`'i doldur

Değerleri Supabase panelinde **Project Settings → Data API** altında bulursunuz:

```js
window.LimitAyar = {
  aiUcNokta: 'https://bqlmpbqwewqxytramphs.supabase.co/functions/v1/limit-koc',
  aiModel: 'gpt-4o-mini',
  supabaseUrl: 'https://bqlmpbqwewqxytramphs.supabase.co',
  supabaseAnonKey: 'eyJhbGciOi...',        // anon / publishable key
  analitikAcik: true,
  kurum: 'limit-demo'
};
```

`index.html`'i yenileyin. Koç panelinin üstünde **"Sayısal özel ders · gpt-4o-mini"** yazıyorsa
canlı kip devrededir. Konsolda `[Limit analitik] açık · oturum ...` satırını görürsünüz.

> **Hangi anahtar nereye:** `anon` anahtarı tasarımı gereği herkese açıktır (Supabase belgeleri
> "publishable" der), güvenliği RLS sağlar — `yapilandirma.js`'e girmesi normaldir.
> `service_role` anahtarı ise **asla** tarayıcıya girmez. OpenAI anahtarı da öyle.

---

### Analitik: ne toplanıyor, kim okuyabiliyor?

Kişisel veri toplanmaz — ad, e-posta, IP yok. Yalnızca rastgele bir oturum kimliği üretilir.

| Olay | Kaydedilen |
|---|---|
| `oturum` | sürüm, ekran boyutu, tarayıcı dili |
| `soru_goruntuleme` | branş, sayfa, soru no |
| `soru_cevap` | işaretlenen şık, doğru mu, süre, o ana kadarki ipucu kademesi |
| `koc_mesaj` | ipucu kademesi, yanıtın kaynağı (uzak / yerel / süzgeç) |
| `video_izleme` | hangi sorunun videosu açıldı |

Her kayıt `anahtar_kaynagi` alanını da taşır; böylece raporda **resmî anahtarlı sorularla
demo cevaplı soruları ayırt edebilirsiniz** — `demo` etiketli soruların başarı oranı anlamlı
değildir.

Güvenlik: RLS açık, `anon` rolü **yalnızca INSERT** yapabilir. Okuma, güncelleme ve silme için
politika yoktur; yani kimse başkasının verisini göremez, kimse kayıt silemez. Raporları
`service_role` ile (SQL Editor) okursunuz:

```sql
select * from public.limit_ozet_brans order by cevap_sayisi desc;
select * from public.limit_ozet_soru  order by basari_yuzde asc limit 20;   -- en zorlanılan sorular
```

`limit_ozet_soru` görünümü `en_sik_yanlis_sik` sütununu da verir: bir soruda öğrenciler
hangi çeldiriciye takılıyor — içerik ekibi için doğrudan kullanılabilir bir sinyal.

### Yayına açmadan önce

Bunlar demo için gerekli değil, geniş kitleye açarken gerekli:

- **Uç nokta koruması.** Edge Function şu an anon anahtarıyla çağrılabiliyor; anon anahtarı
  herkese açık olduğundan uç nokta da fiilen açıktır. Oturum başına hız sınırı ya da
  paylaşılan bir uygulama gizi ekleyin.
- **CORS daraltma.** `index.ts` içindeki `Access-Control-Allow-Origin: '*'` değerini kendi
  alan adınızla değiştirin (`file://` ile denerken `*` gerekiyor).
- **Maliyet tavanı.** OpenAI panelinde aylık bütçe sınırı tanımlayın. Sunucu tarafında
  `max_tokens` 800'e, model listesi üç modele sınırlandı; ama asıl fren bütçe sınırıdır.
- **Kota takibi.** Bu demo bilinçli olarak **izole** tutuluyor: aynı projedeki `ai_usage` /
  `quota_events` tablolarına bağlanmadı. Vekil sunucu yine de OpenAI'nin token sayılarını
  `kullanim` alanında geri döndürüyor; ileride bağlamak istenirse veri hazır.

## AI koç — tasarım kararı

Sayısal derste cevabı vermek öğrenmeyi bitirir. `src/ai-sokratik.js` bunu üç katmanda
güvenceye alır:

1. **Sistem istemi** — koça kimlik, "cevabı asla söyleme" altın kuralı, Sokratik yöntem
   basamakları ve biçim sınırı (3-4 cümle, her mesaj bir soruyla biter) verilir. Doğru şık
   yalnızca "öğrenciye asla aktarma" kaydıyla bağlama girer; anahtarı olmayan soruda bu blok
   hiç yazılmaz.
2. **İpucu merdiveni** — öğrenci ısrar ettikçe kademe kademe açılır; her kademe bir sonraki
   *işlemi* tarif eder, sonucu değil.
3. **Sızıntı süzgeci** — üretilen yanıt doğru şıkkı ele veriyorsa yayına çıkmadan yakalanır ve
   çevrimdışı motorun yanıtına düşülür. Şık harfinin tek başına durması şart koşulur, yoksa
   koçun kendi cümlesindeki bir sözcüğün baş harfi yanlışlıkla cevap sanılır.

### Konu rehberi

50 sorunun her birine tek tek ipucu yazmak yerine, Sokratik omurga **konu düzeyinde**
tutulur (`data/veri.js` → `konuRehberi`): Sayılar, Doğruda Açı, Vektörler, Modern Atom
Teorisi & Periyodik Özellikler, Enzimler. Her rehberde bir araç kutusu (formüller/teoremler),
4 kademeli ipucu merdiveni ve öz kontrol soruları bulunur.

Bir soruya özel merdiven yazmak isterseniz o sorunun `ipuclari` alanını doldurmanız yeterli;
motor soruya özel içeriği rehberin önüne alır.

### İki çalışma kipi

- **Çevrimdışı (varsayılan)** — internet ve anahtar gerektirmez, kural tabanlı motor.
- **Uzak** — Ayarlar (⚙) → *Uzak servis* seçilip bir uç nokta adresi girilir.

#### Uzak uç nokta sözleşmesi

**API anahtarı tarayıcıya gömülmez.** Anahtarı saklayan ince bir sunucu ucu beklenir.

İstek (`POST`, `application/json`):

```json
{
  "sistem": "…tam sistem istemi…",
  "mesajlar": [{ "role": "user", "content": "…" }],
  "model": "claude-sonnet-5",
  "maxTokens": 400,
  "temperature": 0.4
}
```

Yanıt: `{ "metin": "…" }` — Anthropic Messages biçimi (`content[0].text`) de kabul edilir.
Uç nokta hata verirse koç sessizce çevrimdışı motora düşer, oturum kesilmez.

## Doğrulama

`test/dogrulama.html` dosyasına çift tıklayın. 110 kontrol koşar ve sonucu sayfaya
`GECTI / KALDI` listesi olarak basar. Test koşucusu, derleme ya da bağımlılık yoktur.

Kapsam: veri şeması ve görsel yolları, bölge geometrisi (sayfa sınırları içinde mi, aynı
sütundaki sorular örtüşüyor mu), cevap anahtarı bütünlüğü, konu rehberi bağlantıları,
gezinme, sistem istemi kurgusu, sızıntı süzgeci (yanlış pozitifler dahil) ve Sokratik
motorun kademe akışı; ayrıca canlı kip: vekil sunucu sözleşmesi, anahtar sızıntısı
(istekte `sk-` / `service_role` var mı), sunucu hatasında yerel motora düşme ve analitik
modülünün kapalıyken çökmemesi.

## Kısayollar

| Tuş | İşlev |
|---|---|
| `A` – `E` | Şık işaretle |
| `←` / `→` | Önceki / sonraki soru |
| `T` | Odak ↔ tam sayfa |
| `V` | Öğretmen çözümü videosunu aç |
| `+` / `−` | Yakınlaştır / uzaklaştır |
| `K` | Koçtan yardım al |
| `Ç` | Koç çözsün |

## Durum ve kalıcılık

İlerleme, süreler, ipucu kademesi, görüntüleme tercihleri ve koç oturumları `localStorage`
içinde `limit.sayisal.demo.v1` anahtarında tutulur. Adres çubuğu `#/brans/soruId`
biçimindedir; sayfa yenilendiğinde aynı soruda kalınır, bağlantı paylaşılabilir.
Sıfırlamak için: Ayarlar → *Demoyu sıfırla*.

## Sürüm

`0.5.0-demo` · sınırsız deneme + koç modalı
