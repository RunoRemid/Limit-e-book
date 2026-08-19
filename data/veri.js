/* =============================================================
   Limit Yayınları — TYT/AYT Sayısal e-Kitap Demosu
   data/veri.js  ·  Tüm içerik tek global değişkende: window.LimitVeri
   -------------------------------------------------------------
   VERİ MODELİ: SAYFA → SORU
   Elimizdeki kaynak, tek soru görselleri değil; her biri 4-6 soru
   taşıyan orijinal kitap sayfalarıdır (1544 × 1920 WebP).
   Bu yüzden model iki katmanlıdır:

     sayfa  → bir tarama görseli + künye (branş, test, konu, kitap sayfası)
     soru   → o sayfadaki tek bir soru + görsel üzerindeki bölgesi

   Bölge (bolge) yüzdelerle verilir; arayüz bu bölgeye yakınlaşarak
   soruyu tam ekran okunur hâle getirir. Yüzde olduğu için görsel
   yeniden boyutlandırılsa da bozulmaz.

   CEVAP ANAHTARI — üç ayrı kaynak, soru düzeyinde etiketli
   Her sorunun anahtarKaynagi alanı, dogru değerinin NEREDEN
   geldiğini söyler. Demo akışının kesintisiz olması için 50 sorunun
   tamamında bir cevap vardır; ama hepsi aynı güvenilirlikte DEĞİLDİR:

     'sayfa'    → Kitabın sayfa altında basılı anahtarından okundu.
                  Resmî ve güvenilir. (24 soru)
     'cozuldu'  → Anahtar sayfada basılı değildi; soru çözülerek
                  bulundu. Büyük olasılıkla doğru ama resmî değil,
                  yayına girmeden önce anahtarla karşılaştırılmalı.
                  (23 soru)
     'demo'     → Şeklin güvenle okunamadığı sorular. Değer YALNIZCA
                  demo akışı çalışsın diye atanmıştır; doğruluğu
                  iddia EDİLMEZ, yayına girmeden mutlaka
                  düzeltilmelidir. (3 soru: GEO-T5 1, 4, 5)

   Arayüz, 'sayfa' dışındaki soruların altında küçük bir uyarı
   rozeti gösterir. Gerçek anahtarlar elinize geçtiğinde yapılacak
   tek şey, dogru alanını güncelleyip anahtarKaynagi değerini
   'sayfa' yapmaktır.
   ============================================================= */
(function (global) {
  'use strict';

  var IMG = 'img/sorular/';

  /* -----------------------------------------------------------
     VİDEO ÇÖZÜM
     Kitap sayfalarının köşesindeki QR kod, o testin çözüm
     videosuna gider. Bu deneyimi dijitalleştiriyoruz: her sorunun
     video_url alanı, modal içinde <iframe> ile oynatılır.

     Adres GÖMME (embed) biçiminde olmalıdır:
       izleme  : https://www.youtube.com/watch?v=VIDEO_ID
       gömme   : https://www.youtube.com/embed/VIDEO_ID
     watch?v= biçimi iframe içinde çalışmaz.

     Soruya özel bağlantı vermek için ilgili soru nesnesine
     video_url yazmanız yeterli; aşağıdaki normalleştirme döngüsü
     yalnızca boş olanları bu varsayılanla doldurur.
     ----------------------------------------------------------- */
  var DEMO_VIDEO = 'https://www.youtube.com/embed/6bq232LCoo4?rel=0';

  /* Sayfa düzeni sabitleri — tüm taramalar 1544 × 1920 ve iki sütunlu.
     Bölge yüzdeleri bu düzene göre verilmiştir. */
  /* Sütun sınırları — sayfa ortasındaki ayraç çizgisi (~%48,2) ve
     komşu sütunun soru numarası çerçeveye girmesin diye daraltıldı. */
  var SOL = { x: 4.0,  en: 43.5 };   /* %4,0  – %47,5 */
  var SAG = { x: 51.3, en: 44.7 };   /* %51,3 – %96,0 — ayraç çizgisi ~%50,5'te kalır */

  function bolge(sutun, ust, alt) {
    var s = sutun === 'sag' ? SAG : SOL;
    return { x: s.x, en: s.en, y: ust, boy: alt - ust };
  }

  /* -----------------------------------------------------------
     KONU REHBERİ — Sokratik omurga
     Koç, soruya özel içerik yoksa buradaki konu düzeyi merdiveni
     kullanır. Her madde bir sonraki İŞLEMİ tarif eder, sonucu
     asla vermez.
     ----------------------------------------------------------- */
  var konuRehberi = {

    'sayilar': {
      ad: 'Sayılar ve Denklemler',
      formuller: [
        'Bir çarpımın en büyük/en küçük değeri için çarpanların işaret ve sınır durumlarını tara.',
        'Tam sayılarda bölünebilme: a·b = k ise a, k nın bir bölenidir.',
        'Ardışık tam sayılar: a, a+1, a+2 biçiminde tek bilinmeyene indirgenir.',
        'Doğal sayı çözümü aranan denklemlerde değişkenlerden birini yalnız bırakıp diğerine değer tara.'
      ],
      ipuclari: [
        'Sorunun sana verdiği kısıt ne? "Doğal sayı", "tam sayı", "pozitif" gibi bir sözcük varsa çözüm kümesini o daraltıyor — önce onu yaz.',
        'Bilinmeyenleri tek tek denemek yerine bir bağıntı kurmayı dene: verilen eşitliklerden hangisi bir bilinmeyeni diğeri cinsinden yazmana izin veriyor?',
        '"En az" ya da "en çok" isteniyorsa uç durumları düşün: çarpanlar hangi değerlerde en küçük/en büyük olur? Negatif değer alabilir mi?',
        'Bulduğun adayı sorunun BÜTÜN koşullarına geri koy. Bir koşulu sağlayıp diğerini bozan aday elenir — hangisini kontrol etmedin?'
      ],
      kontrol: [
        'Bulduğun değer sorudaki "doğal sayı / tam sayı" kısıtını sağlıyor mu?',
        'Soru değerin kendisini mi, yoksa bir ifadenin değerini mi istiyor?'
      ]
    },

    'dogruda-aci': {
      ad: 'Doğruda Açı',
      formuller: [
        'Paralel iki doğru bir kesenle kesilirse: yöndeş açılar eşit, iç ters açılar eşit, iç yan açılar bütünlerdir (toplamı 180°).',
        'Z kuralı: paralel doğrular arasındaki zikzakta, kırılma noktasından paralel çizersen açı ikiye ayrılır.',
        'Bütünler açılar 180°, tümler açılar 90°.',
        'Açıortay, açıyı iki eş parçaya böler.',
        'Zikzak (testere) kuralı: paralel doğrular arasında sol taraftaki açıların toplamı = sağ taraftaki açıların toplamı.'
      ],
      ipuclari: [
        'Şekilde paralel doğrular verilmiş. Kırılma noktalarından bu doğrulara paralel yardımcı doğru çizersen ne kazanırsın?',
        'Çizdiğin yardımcı paralel, kırılma açısını iki parçaya böler. Bu parçalardan her biri hangi açıyla yöndeş ya da iç ters oluyor?',
        'Açıortay verilmişse o açıyı 2x gibi tek bir harfle adlandır — böylece denklemde tek bilinmeyenle çalışırsın. Hangi açıya bu adı verirdin?',
        'Denklemi kurdun mu? Paralel doğrular arasında bir tarafın açı toplamı diğer tarafa eşit olmalı — iki tarafı da yazıp eşitle.'
      ],
      kontrol: [
        'Bulduğun açı şekildeki görünümle tutarlı mı — dar görünen bir açıya 120° bulmadın ya?',
        'Soru hangi açıyı istiyor: senin adlandırdığın açı mı, onun bütünleri mi?'
      ]
    },

    'vektorler': {
      ad: 'Vektörler',
      formuller: [
        'Bileşenlere ayırma: Vₓ = V·cos θ , V_y = V·sin θ',
        'Bileşke: önce eksen eksen topla (ΣVₓ, ΣV_y), sonra |R| = √(ΣVₓ² + ΣV_y²)',
        'Aralarında θ açısı olan iki vektör: R² = A² + B² + 2·A·B·cos θ',
        'Bileşkenin sıfır olması, kapalı bir çokgen (uç uca eklendiğinde başa dönüş) demektir.',
        'Vektörün büyüklüğü döndürmeyle değişmez; yalnızca bileşenleri değişir.'
      ],
      ipuclari: [
        'Vektörleri olduğu gibi toplamaya çalışma. Önce hepsini aynı iki eksene (yatay-düşey) indirgesek ne kazanırız?',
        'Her vektörün eksenlerdeki bileşenini yaz. İşaretlere dikkat: sola ve aşağı yönler negatif. Hangi vektörün bileşeni negatif çıkıyor?',
        'Eksen toplamlarını (ΣVₓ ve ΣV_y) buldun mu? Bileşkenin büyüklüğü için bu iki toplamı nasıl birleştirirsin?',
        '"Bileşke sıfır" deniyorsa vektörler uç uca eklendiğinde kapalı şekil oluşturur. Bu sana hangi kenar uzunluğunu verir?'
      ],
      kontrol: [
        'Bileşke, en büyük vektörden büyük mü çıktı? Zıt yönlü vektörler varsa bu şüpheli.',
        'Soru bileşkenin büyüklüğünü mü, yoksa bir bileşenini mi istiyor?'
      ]
    },

    'atom-periyodik': {
      ad: 'Modern Atom Teorisi ve Periyodik Özellikler',
      formuller: [
        'Elektron dizilimi: 1s 2s 2p 3s 3p 4s 3d … (Aufbau sırası)',
        'Grup: son katmandaki değerlik elektron sayısı · Periyot: en yüksek baş kuantum sayısı',
        'İyonlaşma enerjisi periyotta soldan sağa artar, grupta yukarıdan aşağıya azalır.',
        'İyonlaşma enerjilerinde ani sıçrama, değerlik elektronlarının bittiğini gösterir → grup numarası.',
        'Atom yarıçapı periyotta sağa gidildikçe küçülür; katyon atomundan küçük, anyon atomundan büyüktür.',
        'Küresel simetri (yarı dolu / tam dolu orbital) iyonlaşma enerjisini beklenenden yükseltir.'
      ],
      ipuclari: [
        'Elindeki sayısal veriden elementin kimliğine gitmelisin. İyonlaşma enerjilerinde nerede ANİ bir sıçrama var — bu sana neyi söyler?',
        'Sıçramadan önceki elektron sayısı değerlik elektron sayısıdır. Buradan elementin grubunu yazabilir misin?',
        'Elektron dizilimini yazdın mı? Diziliminin bittiği orbital, elementin hangi blokta olduğunu doğrudan veriyor.',
        'Yargıları tek tek ele al. Her biri için "bu doğruysa elementin şu özelliğini gerektirir" diye düşün — hangisi verilerle çelişiyor?'
      ],
      kontrol: [
        'Bulduğun atom numarası, verilen periyodik tablo kesitindeki konumla uyuşuyor mu?',
        'Soru "hangisi doğrudur" mu, "hangisi yanlıştır" mı diyor — hangisini arıyorsun?'
      ]
    },

    'enzimler': {
      ad: 'Canlıların Temel Bileşenleri · Enzimler',
      formuller: [
        'Enzimler protein yapılıdır; hidroliz edilirlerse amino asit açığa çıkar.',
        'Enzimler tepkimeden değişmeden çıkar: miktarları artmaz, azalmaz.',
        'Yüksek sıcaklık ve uygun olmayan pH enzimin yapısını (üç boyutlu şeklini) bozar → denatürasyon.',
        'Her enzim substratına özgüdür; enzim aktivasyon enerjisini düşürür.',
        'Hidroliz: su kullanılarak bağ kırılması. Dehidrasyon sentezi: su açığa çıkararak bağ kurulması.',
        'Glikozit bağı karbonhidratlarda, peptit bağı proteinlerde, ester bağı yağlarda bulunur.'
      ],
      ipuclari: [
        'Önce maddenin yapısını belirle: bu molekül protein mi, karbonhidrat mı, yağ mı? Yapı, hangi bağın ve hangi yapı taşının söz konusu olduğunu belirler.',
        'Enzimin tepkimedeki rolünü hatırla: harcanıyor mu, yoksa çıkışta aynen duruyor mu? Bu, "miktarı değişir mi" sorusunu doğrudan yanıtlar.',
        'Şıkları elerken her birini bir koşula bağla: "bu ifade doğruysa hücrede şunun olması gerekir." Hangisi bu testi geçemiyor?',
        'Deney düzeneği varsa değişkenleri karşılaştır: kaplar arasında yalnızca TEK fark olan çifti bul — sonuç farkı o değişkenden gelir.'
      ],
      kontrol: [
        'Hidroliz mi sentez mi oluyor — su harcanıyor mu, açığa mı çıkıyor?',
        'Soru "hangisi yanlıştır" diyorsa, doğru bulduğun şıkları elediğinde geriye tek bir tane kalmalı.'
      ]
    }
  };

  /* -----------------------------------------------------------
     BRANŞLAR
     ----------------------------------------------------------- */
  /* Branş renkleri tokens.css ile birebir aynı olmalı.
     Hepsi derin ve düşük doygunlukta: ayırt edilebilirler ama
     marka kızılıyla yarışmazlar. Fizik'in laciverdi grafite çevrildi. */
  var branslar = [
    { id: 'matematik', ad: 'Matematik', kisa: 'MAT', renk: '#9C0000', ikon: '∑' },
    { id: 'geometri',  ad: 'Geometri',  kisa: 'GEO', renk: '#A8551B', ikon: '△' },
    { id: 'fizik',     ad: 'Fizik',     kisa: 'FİZ', renk: '#4A4C54', ikon: '◎' },
    { id: 'kimya',     ad: 'Kimya',     kisa: 'KİM', renk: '#1F6B58', ikon: '⬡' },
    { id: 'biyoloji',  ad: 'Biyoloji',  kisa: 'BİY', renk: '#6B4A7A', ikon: '❋' }
  ];

  /* -----------------------------------------------------------
     SAYFALAR
     ----------------------------------------------------------- */
  var sayfalar = [

    /* ===== MATEMATİK ===== */
    {
      id: 'MAT-T7',
      brans: 'matematik',
      gorsel: IMG + 'matematik 1.webp',
      en: 1544, boy: 1920,
      test: 7,
      konu: 'Sayılar - VII',
      unite: 'Birinci Dereceden Denklem ve Eşitsizlikler',
      rehber: 'sayilar',
      kitapSayfa: 17,
      sinav: 'TYT',
      anahtarKaynagi: 'demo',
      sorular: [
        { no: 1, sutun: 'sol', ust: 13.5, alt: 41.5, zorluk: 2, dogru: 'C', anahtarKaynagi: 'cozuldu',
          /* b, 30 ve 18 in ortak böleni → b ∈ {1,2,3,6}; toplamlar 49, 26, 19, 14.
             I (en az 14) ve II (en çok 49) doğru, III yanlış. */
          ozet: 'a·b = 30 ve b·c = 18 iken a + b + c toplamının alabileceği değerlere dair I, II, III öncüllerinden hangilerinin doğru OLABİLECEĞİ soruluyor.' },
        { no: 2, sutun: 'sol', ust: 50, alt: 64, zorluk: 2, dogru: 'A', anahtarKaynagi: 'cozuldu',
          /* (a+5−z)(13−a)z ifadesi a=7, z=6 için 216 ile en büyük. */
          ozet: 'x = a − z + 5 ve y = 13 − a iken x·y·z çarpımının en çok kaç olabileceği soruluyor.' },
        { no: 3, sutun: 'sol', ust: 73, alt: 94, zorluk: 2, dogru: 'C', anahtarKaynagi: 'cozuldu',
          /* 13 × 24 = 312; karalanan rakamlar 1, 4, 1 → toplam 6. */
          ozet: 'İki basamaklı iki sayının çarpımında üç rakamı karalanmış; karalanan üç rakamın toplamı soruluyor.' },
        { no: 4, sutun: 'sag', ust: 13.5, alt: 41.5, zorluk: 2, dogru: 'E', anahtarKaynagi: 'cozuldu',
          /* m + 2^m dizisi: 1, 3, 6, 11, 20, 37, 70 → 11 (m=3) ve 37 (m=5) var, 18 yok. */
          ozet: 'm doğal sayı olmak üzere m + 2^m ifadesinin alabildiği "nektar sayılar" tanımlanmış; 11, 18, 37 sayılarından hangilerinin nektar sayı olduğu soruluyor.' },
        { no: 5, sutun: 'sag', ust: 49, alt: 63, zorluk: 3, dogru: 'A', anahtarKaynagi: 'cozuldu',
          /* (A−(B+C))(A+(B+C)) = 19 asal → A = 10, B+C = 9 → 10/9. */
          ozet: 'A, B, C pozitif tam sayı ve A² − (B + C)² = 19 iken A/(B + C) ifadesinin değeri soruluyor.' },
        { no: 6, sutun: 'sag', ust: 73, alt: 94, zorluk: 3, dogru: 'E', anahtarKaynagi: 'cozuldu',
          /* Toplam = 102Z + 101K + 100Y + 30X → Z=9, K=8, Y=3, X=1 ile 2056. */
          ozet: 'X, Y, Z, K yerine 1, 9, 8, 3 rakamları yerleştirilerek YXZ + KXZ + ZXK toplamının en büyük değeri soruluyor.' }
      ]
    },

    {
      id: 'MAT-T6',
      brans: 'matematik',
      gorsel: IMG + 'matematik 2.webp',
      en: 1544, boy: 1920,
      test: 6,
      konu: 'Sayılar - VI',
      unite: 'Birinci Dereceden Denklem ve Eşitsizlikler',
      rehber: 'sayilar',
      kitapSayfa: 16,
      sinav: 'TYT',
      anahtarKaynagi: 'sayfa',
      sorular: [
        { no: 7,  sutun: 'sol', ust: 7.5, alt: 21.5, zorluk: 3, dogru: 'D',
          ozet: 'A + B = 4 ve (A − 2)·B − C² = 1 iken A·B·C çarpımının en az kaç olabileceği soruluyor.' },
        { no: 8,  sutun: 'sol', ust: 32, alt: 52, zorluk: 2, dogru: 'E',
          ozet: 'x·y = 7 iken "x ve y tam sayıdır", "aynı işaretlidir", "y ≠ 0" öncüllerinden hangilerinin KESİNLİKLE doğru olduğu soruluyor.' },
        { no: 9,  sutun: 'sol', ust: 62, alt: 92, zorluk: 3, dogru: 'D',
          ozet: 'Baklava dilimi şeklinde dizilmiş karelere 1-9 rakamları tekrarsız yazılıyor; her satırdaki üç sayının toplamı eşit olacak şekilde A + B + C nin en büyük değeri soruluyor.' },
        { no: 10, sutun: 'sag', ust: 7.5, alt: 21.5, zorluk: 2, dogru: 'C',
          ozet: '2x + 3y = 22 eşitliğini sağlayan kaç farklı (x, y) doğal sayı ikilisi olduğu soruluyor.' },
        { no: 11, sutun: 'sag', ust: 29, alt: 56, zorluk: 2, dogru: 'E',
          ozet: 'a < b < c ardışık tam sayılar iken b − c = −1, (a·b·c)/3 tam sayıdır, (a+b+c)/b tam sayıdır öncüllerinden hangilerinin doğru olduğu soruluyor.' },
        { no: 12, sutun: 'sag', ust: 62, alt: 92, zorluk: 3, dogru: 'D',
          ozet: 'Artan doğal sayılardan oluşan haç biçimli şemada a + b − c − d ifadesinin en büyük değerinin en küçüğünden ne kadar fazla olduğu soruluyor.' }
      ]
    },

    /* ===== GEOMETRİ ===== */
    {
      id: 'GEO-T4',
      brans: 'geometri',
      gorsel: IMG + 'geometri 1.webp',
      en: 1544, boy: 1920,
      test: 4,
      konu: 'Doğruda Açı - IV',
      unite: 'Açılar ve Üçgenler',
      rehber: 'dogruda-aci',
      kitapSayfa: 12,
      sinav: 'TYT',
      anahtarKaynagi: 'sayfa',
      sorular: [
        { no: 7,  sutun: 'sol', ust: 7.5, alt: 36, zorluk: 3, dogru: 'D',
          ozet: 'AB // CD // EK, [MF] ⊥ [FB] ve [EM] açıortay iken m(ABF) = 35°, m(MDC) = 85° verilerinden x = m(MEK) açısı soruluyor.' },
        { no: 8,  sutun: 'sol', ust: 47, alt: 92, zorluk: 3, dogru: 'E',
          ozet: 'Zemine bırakılmış üç bükülmüş tel; AB // FE, DE // BC, HK ⊥ DE, GH ⊥ FE iken x, y, z açıları arasındaki x = y, x = z, x + y + z = 180° öncüllerinin doğruluğu soruluyor.' },
        { no: 9,  sutun: 'sag', ust: 7.5, alt: 32, zorluk: 2, dogru: 'E',
          ozet: '[EF // [BA, m(CDE) = m(CBA) ve m(DEF) = 110° iken m(BCD) açısı soruluyor.' },
        { no: 10, sutun: 'sag', ust: 34, alt: 58, zorluk: 2, dogru: 'D',
          ozet: '[BC // [DE // [FK, m(ABC) = 100°, m(AFK) = 160° ve [AD açıortay iken m(ADE) açısı soruluyor.' },
        { no: 11, sutun: 'sag', ust: 59, alt: 93, zorluk: 3, dogru: 'E',
          ozet: 'Tenis masası üzerindeki ip modelinde 2β = 3α iken α ve β açılarının bütünlerinin oranının hangisi olabileceği soruluyor.' }
      ]
    },

    {
      id: 'GEO-T5',
      brans: 'geometri',
      gorsel: IMG + 'geometri 2.webp',
      en: 1544, boy: 1920,
      test: 5,
      konu: 'Doğruda Açı - V',
      unite: 'Açılar ve Üçgenler',
      rehber: 'dogruda-aci',
      kitapSayfa: 13,
      sinav: 'TYT',
      anahtarKaynagi: 'demo',
      sorular: [
        { no: 1, sutun: 'sol', ust: 13.5, alt: 35.5, zorluk: 2, dogru: 'C', anahtarKaynagi: 'demo',
          ozet: 'Karanfil ve Menekşe sokakları paralel; 70°, 80° ve 30° verilerinden x açısı soruluyor.' },
        { no: 2, sutun: 'sol', ust: 42, alt: 65, zorluk: 3, dogru: 'A', anahtarKaynagi: 'cozuldu',
          /* 2a + a + 45 + b + 2b = 180 → a + b = 45; m(COF) = a + 45 + b = 90. */
          ozet: 'A, O, B doğrusal; m(AOF) = 2·m(EOF), m(BOC) = 2·m(COD), m(EOD) = 45° iken m(COF) soruluyor.' },
        { no: 3, sutun: 'sol', ust: 71, alt: 93, zorluk: 3, dogru: 'C', anahtarKaynagi: 'cozuldu',
          /* Açıortaylar: 2p + 2q = 84 → p + q = 42; açıortaylar arasındaki açı = p + q. */
          ozet: '[BA // [FL, m(ABC) = m(CBD), m(DFK) = m(KFL) ve m(BDF) = 84° iken x = m(CEK) soruluyor.' },
        { no: 4, sutun: 'sag', ust: 13.5, alt: 42, zorluk: 3, dogru: 'D', anahtarKaynagi: 'demo',
          ozet: 'İçbükey ABCDEFG çokgensel mermer yüzeyde α + β + θ ile z + t toplamı arasındaki ilişki verilmiş; x ile y açıları arasındaki bağıntı soruluyor.' },
        { no: 5, sutun: 'sag', ust: 44, alt: 70, zorluk: 3, dogru: 'B', anahtarKaynagi: 'demo',
          ozet: '[BA // [KL // [EF, [DE // [KF, m(CBA) = 110°, m(DCB) = m(LKF) = 75° iken α = m(CDE) soruluyor.' },
        { no: 6, sutun: 'sag', ust: 73, alt: 93, zorluk: 2, dogru: 'D', anahtarKaynagi: 'cozuldu',
          /* Zikzak kuralı: 50 + x = 20 + 85 → x = 55. */
          ozet: '[BA // [EF, m(ABC) = 50°, m(BCD) = 20°, m(DEF) = 85° iken x = m(CDE) soruluyor.' }
      ]
    },

    /* ===== FİZİK ===== */
    {
      id: 'FIZ-T3',
      brans: 'fizik',
      gorsel: IMG + 'fizik 1.webp',
      en: 1544, boy: 1920,
      test: 3,
      konu: 'Vektörler - III',
      unite: '1. Ünite · Fizik Bilimine Giriş ve Vektörler',
      rehber: 'vektorler',
      kitapSayfa: 9,
      sinav: 'AYT',
      anahtarKaynagi: 'demo',
      sorular: [
        { no: 1, sutun: 'sol', ust: 13.5, alt: 30, zorluk: 1, dogru: 'B', anahtarKaynagi: 'cozuldu',
          /* (3,0) + (0,6) + (5,0) = (8,6) → |R| = 10. */
          ozet: 'K(3, 0), L(0, 6), M(5, 0) vektörlerinin bileşkesinin büyüklüğü soruluyor.' },
        { no: 2, sutun: 'sol', ust: 55, alt: 93, zorluk: 3, dogru: 'E', anahtarKaynagi: 'cozuldu',
          /* |X| = 4/sin53 = 5; X=(−3,4), Y=(0,−4) → Z=(3,0), |Z|=3; |X+Y−Z| = 6. Üçü de doğru. */
          ozet: 'Aralarındaki dik uzaklık 4 br olan paralel K ve L doğrultularında X, Y, Z vektörleri veriliyor; bileşkeleri sıfır iken |X| = 5, |Z| = 3, |X + Y − Z| = 6 öncüllerinin doğruluğu soruluyor. (sin53 = 0,8; cos53 = 0,6)' },
        { no: 3, sutun: 'sag', ust: 13.5, alt: 24, zorluk: 1, dogru: 'D', anahtarKaynagi: 'cozuldu',
          /* √(3² + 4² + 5²) = √50 = 5√2. */
          ozet: 'Üç boyutlu K vektörünün x, y, z bileşenleri 3, 4 ve 5 br iken vektörün büyüklüğü soruluyor.' },
        { no: 4, sutun: 'sag', ust: 43, alt: 93, zorluk: 2, dogru: 'A', anahtarKaynagi: 'cozuldu',
          /* K+L vektörel → K, L vektörel. L·M vektörel → M skaler. M·N skaler → N skaler. */
          ozet: 'K + L → vektörel, L · M → vektörel, M · N → skaler bilgilerinden K, L, M, N niceliklerinin vektörel mi skaler mi olduğunu doğru gösteren tablo soruluyor.' }
      ]
    },

    {
      id: 'FIZ-T2',
      brans: 'fizik',
      gorsel: IMG + 'fizik 2.webp',
      en: 1544, boy: 1920,
      test: 2,
      konu: 'Vektörler - II',
      unite: '1. Ünite · Fizik Bilimine Giriş ve Vektörler',
      rehber: 'vektorler',
      kitapSayfa: 8,
      sinav: 'AYT',
      anahtarKaynagi: 'sayfa',
      sorular: [
        { no: 5, sutun: 'sol', ust: 7.5, alt: 34, zorluk: 3, dogru: 'B',
          ozet: 'Düşey yukarı yönlü |M| = 2√3F ile düşeyle 30°ar açı yapan |K| = |L| = 3F vektörlerinin bileşkesinin kaç F olduğu soruluyor.' },
        { no: 6, sutun: 'sol', ust: 53, alt: 92, zorluk: 3, dogru: 'C',
          ozet: '|K| = √2 br, |L| = |M| = |N| = 1 br olan dört vektör için |L + M| = |K|, |L| + |N| = |K|, |N + L| = |K| yargılarından hangilerinin doğru olabileceği soruluyor.' },
        { no: 7, sutun: 'sag', ust: 7.5, alt: 55, zorluk: 2, dogru: 'C',
          ozet: 'Özdeş karelere bölünmüş düzlemdeki K vektörü orijin etrafında döndürüldüğünde bileşenlerinin ve büyüklüğünün nasıl değiştiği soruluyor.' },
        { no: 8, sutun: 'sag', ust: 65, alt: 92, zorluk: 3, dogru: 'C',
          ozet: 'x-y düzleminde |K| = 8F (x ekseniyle 8°) ve |L| = 10F (y ekseninden 61°) vektörlerinin bileşkesinin kaç F olduğu soruluyor. (sin53 = 0,8; cos53 = 0,6)' }
      ]
    },

    /* ===== KİMYA ===== */
    {
      id: 'KIM-T7',
      brans: 'kimya',
      gorsel: IMG + 'kimya 1.webp',
      en: 1544, boy: 1920,
      test: 7,
      konu: 'Elementleri Tanıyalım - I',
      unite: 'Modern Atom Teorisi',
      rehber: 'atom-periyodik',
      kitapSayfa: 17,
      sinav: 'AYT',
      anahtarKaynagi: 'demo',
      sorular: [
        { no: 1, sutun: 'sol', ust: 13, alt: 46, zorluk: 2, dogru: 'D', anahtarKaynagi: 'cozuldu',
          /* X=Li, Y=O, Z=N. I yanlış (en yüksek 1.İE N'de, küresel simetri);
             II doğru (Li⁺ soy gaz kararlılığı); III doğru (NO₂ asidik oksit). */
          ozet: 'X, Y, Z elementlerinin 1s, 2s, 2p orbitallerindeki elektron sayıları tabloda verilmiş; iyonlaşma enerjisi ve ZO₂ oksidinin asidik karakteri ile ilgili yargılar soruluyor.' },
        { no: 2, sutun: 'sol', ust: 65, alt: 94, zorluk: 3, dogru: 'E', anahtarKaynagi: 'cozuldu',
          /* ₁₆X=S (…3p⁴), ₂₄Y=Cr ([Ar]4s¹3d⁵). V. madde Y için yanlış: son orbitalde 5 elektron var. */
          ozet: '₁₆X ve ₂₄Y elementleri için metalik özellik, blok, bileşik yapma, geçiş metali olma ve son orbitaldeki elektron sayısı işaretlemelerinden hangisinin YANLIŞ olduğu soruluyor.' },
        { no: 3, sutun: 'sag', ust: 13, alt: 48, zorluk: 2, dogru: 'A', anahtarKaynagi: 'cozuldu',
          /* Yalnız I: Mg > Be. II yanlış (anyon atomundan büyüktür), III yanlış (Na > Al). */
          ozet: 'Yarıçapları 160 pm ve 113 pm olan X ve Y tanecikleri için ₁₂Mg-₄Be, ₁₆S-₁₆S²⁻, ₁₃Al-₁₁Na eşleştirmelerinden hangilerinin olabileceği soruluyor.' },
        { no: 4, sutun: 'sag', ust: 66, alt: 94, zorluk: 3, dogru: 'E', anahtarKaynagi: 'cozuldu',
          /* Kesitte X=Al(13), Y=Cl(17), Z=Ar(18): Al amfoter, atom numarası ilişkisi ve AlCl₃ — üçü de doğru. */
          ozet: '3. periyot p bloğundaki X, Y, Z elementleri için amfoter metal olma, atom numarası ilişkisi ve XY₃ bileşiği yargıları soruluyor.' }
      ]
    },

    {
      id: 'KIM-T6',
      brans: 'kimya',
      gorsel: IMG + 'kimya 2.webp',
      en: 1544, boy: 1920,
      test: 6,
      konu: 'Periyodik Özellikler - II',
      unite: 'Modern Atom Teorisi',
      rehber: 'atom-periyodik',
      kitapSayfa: 16,
      sinav: 'AYT',
      anahtarKaynagi: 'sayfa',
      sorular: [
        { no: 5, sutun: 'sol', ust: 7.5, alt: 54, zorluk: 2, dogru: 'E',
          ozet: '3. periyot elementlerinin 1. iyonlaşma enerjisi grafiği verilmiş; periyodik artış eğilimi ve küresel simetrinin Mg ile Al arasındaki etkisine dair yargılar soruluyor.' },
        { no: 6, sutun: 'sol', ust: 61, alt: 92, zorluk: 2, dogru: 'E',
          ozet: 'Periyodik tablo kesitinde X, Y, Z veriliyor; X in atom numarası 9 iken halojen olma, hidrojenli bileşiklerin asitliği ve atom çapı yargıları soruluyor.' },
        { no: 7, sutun: 'sag', ust: 7.5, alt: 42, zorluk: 3, dogru: 'C',
          ozet: 'L, M, T elementlerinin ardışık iyonlaşma enerjileri tabloda verilmiş; atom numarası, grup ve toprak alkali metal olma ifadelerinden hangisinin YANLIŞ olduğu soruluyor.' },
        { no: 8, sutun: 'sag', ust: 47, alt: 92, zorluk: 2, dogru: 'C',
          ozet: 'X, Y, Z elementlerinin iyonlaşma enerjileri tablosundan periyodik konum, atom numarası, kütle numarası, kuantum sayıları ve elektron dağılımı niceliklerinden hangisinin BELİRLENEMEYECEĞİ soruluyor.' }
      ]
    },

    /* ===== BİYOLOJİ ===== */
    {
      id: 'BIY-T7',
      brans: 'biyoloji',
      gorsel: IMG + 'biyoloji 1.webp',
      en: 1544, boy: 1920,
      test: 7,
      konu: 'Canlıların Temel Bileşenleri - III',
      unite: '2. Ünite · Canlılar Dünyası',
      rehber: 'enzimler',
      kitapSayfa: 17,
      sinav: 'TYT',
      anahtarKaynagi: 'demo',
      sorular: [
        { no: 1, sutun: 'sol', ust: 13.5, alt: 35, zorluk: 1, dogru: 'E', anahtarKaynagi: 'cozuldu',
          /* Bütün enzimler protein yapılıdır → üçü de hidrolizde amino asit verir. */
          ozet: 'ATP sentaz, DNA polimeraz ve laktaz enzimlerinden hangilerinin hidroliz edilirse amino asit açığa çıkaracağı soruluyor.' },
        { no: 2, sutun: 'sol', ust: 46, alt: 74, zorluk: 2, dogru: 'C', anahtarKaynagi: 'cozuldu',
          /* Ester bağını yalnızca lipaz yıkar; pepsin peptit, amilaz glikozit bağıyla çalışır. */
          ozet: 'Lipaz, pepsin ve amilaz enzimlerinin katalizlediği tepkimeler veriliyor; bu enzimler için ORTAK OLMAYAN özellik soruluyor.' },
        { no: 3, sutun: 'sol', ust: 82, alt: 94, zorluk: 1, dogru: 'A', anahtarKaynagi: 'cozuldu',
          /* Enzim tüm canlılarda ortaktır; glikojen, kitin, kolesterol belirli gruplara özgüdür. */
          ozet: 'Enzim, glikojen, maltoz, kitin ve kolesterol moleküllerinden hangisinin bütün canlılarda ortak bulunduğu soruluyor.' },
        { no: 4, sutun: 'sag', ust: 13.5, alt: 30, zorluk: 2, dogru: 'C', anahtarKaynagi: 'cozuldu',
          /* Enzim ve ATP sentezi hücre içinde; enzim-substrat kompleksi hücre dışında da oluşur. */
          ozet: 'Enzim sentezi, ATP sentezi ve enzim-substrat kompleksi oluşumundan hangilerinin hücre dışında da gerçekleşebileceği soruluyor.' },
        { no: 5, sutun: 'sag', ust: 37, alt: 58, zorluk: 2, dogru: 'B', anahtarKaynagi: 'cozuldu',
          /* Ürün artar, substrat azalır; enzim değişmeden çıkar. */
          ozet: 'Enzimatik bir tepkimenin başı ve sonu kıyaslandığında ürün, enzim ve substrattan hangilerinin miktarında değişme OLMAYACAĞI soruluyor.' },
        { no: 6, sutun: 'sag', ust: 64, alt: 94, zorluk: 3, dogru: 'E', anahtarKaynagi: 'cozuldu',
          /* E₂ bozulsa bile L, E₃ ile R üretiminde kullanılmaya devam eder → E şıkkı yanlış. */
          ozet: 'K → L → (M, R) enzimatik yol şeması veriliyor; enzim takımları, ortak substrat ve mutasyon etkileri ifadelerinden hangisinin YANLIŞ olduğu soruluyor.' }
      ]
    },

    {
      id: 'BIY-T6',
      brans: 'biyoloji',
      gorsel: IMG + 'biyoloji 2.webp',
      en: 1544, boy: 1920,
      test: 6,
      konu: 'Canlıların Temel Bileşenleri - II',
      unite: '2. Ünite · Canlılar Dünyası',
      rehber: 'enzimler',
      kitapSayfa: 16,
      sinav: 'TYT',
      anahtarKaynagi: 'sayfa',
      sorular: [
        { no: 6,  sutun: 'sol', ust: 7.5, alt: 27, zorluk: 2, dogru: 'C',
          ozet: 'Karbonu işaretlenmiş glikoz besin yoluyla veriliyor; bir süre sonra bu işaretli karbona hangi molekülde rastlanabileceği soruluyor.' },
        { no: 7,  sutun: 'sol', ust: 39, alt: 60, zorluk: 1, dogru: 'B',
          ozet: 'Konserve yapımında önce kaynatma sonra hava almayacak şekilde kapatma işleminin enzimlerin hangi özelliğiyle ilgili olduğu soruluyor.' },
        { no: 8,  sutun: 'sol', ust: 71, alt: 92, zorluk: 2, dogru: 'A',
          ozet: 'Hayvan hücresinde glikozit bağlarının kopmasına bağlı olarak glikoz, fruktoz ve amino asitten hangilerinin açığa çıkmasının beklenebileceği soruluyor.' },
        { no: 9,  sutun: 'sag', ust: 7.5, alt: 41, zorluk: 2, dogru: 'A',
          ozet: 'Yağ ve nişastaya uygun enzim eklenmiş dört deney kabı (30°C, 20°C, 90°C, 30°C) kongo kırmızısı ile izleniyor; hangi kaplarda mavi renk oluşacağı soruluyor.' },
        { no: 10, sutun: 'sag', ust: 58, alt: 92, zorluk: 3, dogru: 'E',
          ozet: 'Glikozit bağı sayısının zamanla azaldığı grafik veriliyor; bu değişime neden olan tepkime ile ilgili ifadelerden hangisinin YANLIŞ olduğu soruluyor.' }
      ]
    }
  ];

  /* Normalleştirme — veri yazımını sadeleştirmek için türetilen alanlar */
  sayfalar.forEach(function (s) {
    s.sorular.forEach(function (q) {
      q.sayfa = s.id;
      q.id = s.id + '-S' + q.no;
      q.bolge = bolge(q.sutun, q.ust, q.alt);
      if (!q.secenekler) q.secenekler = ['A', 'B', 'C', 'D', 'E'];
      /* Anahtarın kaynağı soru düzeyinde de saklanır:
         'sayfa'    → kitabın sayfa altında basılı anahtarından okundu
         'cozuldu'  → soru çözülerek bulundu (resmî anahtar değil)
         'demo'     → yalnızca demo akışı için atanmış geçerli şık   */
      if (!q.anahtarKaynagi) q.anahtarKaynagi = s.anahtarKaynagi;
      if (!q.video_url) q.video_url = DEMO_VIDEO;
    });
  });

  global.LimitVeri = {
    meta: {
      yayin: 'Limit Yayınları',
      urun: 'TYT · AYT Sayısal Etkileşimli Kitap',
      surum: '0.5.0-demo',
      hedefKitle: '15-18 yaş / 11-12. sınıf ve mezun',
      guncelleme: '2026-08-19',
      kaynak: 'Orijinal soru bankası taramaları · 1544 × 1920 WebP'
    },
    branslar: branslar,
    konuRehberi: konuRehberi,
    sayfalar: sayfalar
  };

})(window);
