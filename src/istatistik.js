/* =============================================================
   istatistik.js — Deneme günlüğünden ölçüt türetme
   -------------------------------------------------------------
   Saf hesaplama katmanı: DOM bilmez, çizim yapmaz. Arayüz yalnızca
   buradan okur; böylece ölçütlerin tanımı tek yerde durur ve
   test edilebilir.

   KAYNAK: yerel deneme günlüğü (Limit.depo.denemeGunlugu()).
   Ağ olmadan da doludur; Supabase yalnızca cihazlar arası
   zenginleştirme içindir.

   ÖLÇÜT TANIMLARI — burası kritik
   Deneme hakkı SINIRSIZ olduğu için klasik "doğruluk %" anlamsızdır:
   yeterince deneyen herkes eninde sonunda %100'e ulaşır. Bu yüzden
   iki ayrı ölçüt kullanılır ve ikisi de AYNI paydaya sahiptir
   (denenen soru sayısı) — böylece karıştırılamazlar:

     İlk denemede doğru : ipucu/koç almadan, ilk seferde doğru
                          çözülen sorular  → gerçek hakimiyet
     Sonunda çözülen    : kaç deneme ve yardım sonrası olursa olsun
                          doğruya ulaşılan sorular  → azim

   Bir soru "ilk denemede" sayılabilmesi için kazanan denemenin
   hem deneme_no = 1 hem koc_yardimi = false olması gerekir.
   ============================================================= */
(function (global) {
  'use strict';

  var Limit = global.Limit || (global.Limit = {});

  /* Panelin anlamlı sayı üretebilmesi için gereken en az deneme. */
  var YETERLI_VERI = 5;
  /* Bir konunun "güçlü/odak" olarak adlandırılabilmesi için en az
     kaç farklı soru denenmiş olmalı. Tek soruya bakıp "bu konuda
     zayıfsın" demek haksızlık olur. */
  var KONU_ESIGI = 3;

  /* Hız–isabet haritasının eşikleri. Gerekçeleri hizIsabet()
     başlığında ve README'de yazılı. */
  var ISABET_ESIGI = 50;        /* % — sabit, anlamı herkeste aynı */
  var HIZ_ESIGI_YEDEK = 90;     /* sn — ortanca hesaplanamazsa */

  /* Bölge adları arayüzde renge DEĞİL yazıya dayanır; bu yüzden
     ad ve açıklama veri katmanında durur. */
  var BOLGELER = {
    guclu:  { ad: 'Hızlı ve isabetli',
              aciklama: 'Bu konularda hem hızlısın hem ilk seferde doğru buluyorsun.' },
    acele:  { ad: 'Acele ediyorsun',
              aciklama: 'Hızlı çözüyorsun ama ilk deneme çoğu kez tutmuyor; biraz yavaşlamak kazandırır.' },
    yavas:  { ad: 'Emin ama yavaş',
              aciklama: 'Doğruyu buluyorsun; sınavda zaman kazanmak için tempo çalışman yeterli.' },
    kavram: { ad: 'Kavram eksiği',
              aciklama: 'Hem süre uzuyor hem ilk deneme tutmuyor; konuyu tekrar etmek en çok buradan kazandırır.' }
  };

  /* ----------------------------------------------------------- */
  function ortanca(sayilar) {
    var s = sayilar.slice().sort(function (a, b) { return a - b; });
    if (!s.length) return 0;
    var orta = Math.floor(s.length / 2);
    return s.length % 2
      ? s[orta]
      : Math.round((s[orta - 1] + s[orta]) / 2);
  }

  var AYLAR = ['Oca','Şub','Mar','Nis','May','Haz',
               'Tem','Ağu','Eyl','Eki','Kas','Ara'];

  /* Gün sınırı YEREL saate göre. ISO damgasının ilk 10 karakterini
     kesmek UTC günü verir; gece geç saatte çözülen soru bir sonraki
     güne düşer ve öğrenciye yanlış görünürdü. */
  function gunAnahtari(zaman) {
    var t = new Date(zaman);
    if (isNaN(t.getTime())) return '—';
    var ay = t.getMonth() + 1, gun = t.getDate();
    return t.getFullYear() + '-' + (ay < 10 ? '0' : '') + ay +
           '-' + (gun < 10 ? '0' : '') + gun;
  }

  function gunEtiketi(zaman) {
    var t = new Date(zaman);
    if (isNaN(t.getTime())) return '—';
    return t.getDate() + ' ' + AYLAR[t.getMonth()];
  }

  /* ----------------------------------------------------------- */
  /* Örnek set bir kez üretilip saklanır; her çizimde yeniden
     üretmek gereksiz. */
  var ornekOnbellek = null;

  function yuzde(pay, payda) {
    return payda ? Math.round((pay / payda) * 100) : 0;
  }

  /**
   * Denemeleri soru bazında toplar.
   * @returns {Object} soruId → { denemeler, kazanan, konu, brans, zorluk }
   */
  function soruBazinda(gunluk) {
    var harita = {};

    gunluk.forEach(function (k) {
      if (!k || !k.soru_id) return;
      var s = harita[k.soru_id] || (harita[k.soru_id] = {
        soru_id: k.soru_id,
        konu: k.konu || '—',
        brans: k.brans || null,
        zorluk: k.zorluk || null,
        denemeler: [],
        kazanan: null,
        sonZaman: null
      });

      s.denemeler.push(k);
      if (!s.sonZaman || k.zaman > s.sonZaman) s.sonZaman = k.zaman;

      /* Kazanan = doğruya ulaşılan ilk deneme. Sonradan gelen
         kayıtlar (ör. tekrar çözme) kazananı değiştirmez. */
      if (k.dogru_mu === true && !s.kazanan) s.kazanan = k;
    });

    return harita;
  }

  /** Bir sorunun "ilk denemede ve yardımsız" çözülüp çözülmediği. */
  function ilkDenemedeMi(soru) {
    var kz = soru.kazanan;
    return !!kz && kz.deneme_no === 1 && kz.koc_yardimi !== true;
  }

  /* ----------------------------------------------------------- */
  Limit.istatistik = {

    YETERLI_VERI: YETERLI_VERI,
    KONU_ESIGI: KONU_ESIGI,

    /** Ham günlük — ileride Supabase ile birleştirilebilir. */
    gunluk: function () {
      return Limit.depo.denemeGunlugu();
    },

    /**
     * PANELİN TEK VERİ KAYNAĞI.
     * Kartlar da grafikler de yalnızca buradan okur; aynı panelde
     * iki farklı toplam çıkamaz.
     *
     * Demo verisi BELLEKTE durur (Limit.demoVeri), localStorage'a
     * hiç dokunmaz. Önceki sürümde demo kipi gerçek deneme
     * günlüğünü SİLİP yerine örnek kayıt yazıyordu; öğrencinin
     * gerçek geçmişi yok oluyor ve iki veri birbirine karışıyordu.
     */
    aktifGunluk: function () {
      if (Array.isArray(Limit.demoVeri)) return Limit.demoVeri;

      var g = this.gunluk();
      if (g.length >= YETERLI_VERI) {
        Limit.istatistikOrnekVeri = false;
        return g;
      }

      /* Gerçek veri eşiğin altındaysa panel boş kalmaz: örnek set
         gösterilir ve üstte "Örnek veri · gerçek kullanım kaydı
         değildir" şeridi çıkar. Öğrenci beş deneme yapar yapmaz
         kendi verisi devralır; örnek set depoya YAZILMAZ. */
      if (Limit.demoSeti) {
        if (!ornekOnbellek) ornekOnbellek = Limit.demoSeti.uret();
        Limit.istatistikOrnekVeri = true;
        return ornekOnbellek;
      }
      return g;
    },

    soruBazinda: function (gunluk) {
      return soruBazinda(gunluk || this.gunluk());
    },

    /**
     * Konu bazında dağılım. Panelin hem özet hem grafik katmanı
     * bunu kullanır.
     */
    konular: function (gunluk) {
      var harita = soruBazinda(gunluk || this.gunluk());
      var konular = {};

      Object.keys(harita).forEach(function (id) {
        var s = harita[id];
        var k = konular[s.konu] || (konular[s.konu] = {
          konu: s.konu,
          brans: s.brans,
          denenen: 0,
          cozulen: 0,
          ilkDenemede: 0,
          toplamDeneme: 0,
          toplamSure: 0,
          sureAdet: 0,
          sonZaman: null
        });

        k.denenen++;
        k.toplamDeneme += s.denemeler.length;
        if (!k.sonZaman || s.sonZaman > k.sonZaman) k.sonZaman = s.sonZaman;

        if (s.kazanan) {
          k.cozulen++;
          if (ilkDenemedeMi(s)) k.ilkDenemede++;
          if (typeof s.kazanan.sure_sn === 'number') {
            k.toplamSure += s.kazanan.sure_sn;
            k.sureAdet++;
          }
        }
      });

      return Object.keys(konular).map(function (ad) {
        var k = konular[ad];
        k.ilkDenemeYuzde = yuzde(k.ilkDenemede, k.denenen);
        k.cozulmeYuzde = yuzde(k.cozulen, k.denenen);
        k.ortalamaSure = k.sureAdet ? Math.round(k.toplamSure / k.sureAdet) : null;

        /* Grafiklerin kullandığı üçlü ayrım. Burada tanımlanır ki
           kart ile grafik asla çelişmesin — grafik katmanı ölçüt
           hesaplamaz, yalnızca bu alanları çizer.

           Sınırsız deneme altında ikili "doğru/yanlış" anlamsızdır:
           yeterince deneyen herkesin her sorusu sonunda "doğru"
           olur. Anlamlı ayrım üçlüdür:                            */
        k.sonradanCozulen = k.cozulen - k.ilkDenemede;   /* tekrar/yardımla */
        k.cozulemeyen     = k.denenen - k.cozulen;       /* hâlâ açık */

        /* Yanlış DENEME sayısı: "yanlışların dağılımı" grafiğinin
           birimi. Soru bazlı değil deneme bazlı — öğrencinin kaç kez
           yanlış işaretlediğini gösterir. */
        k.yanlisDeneme = k.toplamDeneme - k.cozulen;

        /* Örneklem eşiğinin altındaki konular grafikte "yetersiz
           veri" olarak işaretlenir; sıfır gibi gösterilmez. */
        k.yeterliOrneklem = k.denenen >= KONU_ESIGI;

        return k;
      }).sort(function (a, b) { return b.denenen - a.denenen; });
    },

    /**
     * Özet şeridi için tek nesne.
     * yeterliVeri false ise arayüz boş durumu gösterir; kırık
     * grafik ya da "%0" gibi cesaret kırıcı sayı basmaz.
     */
    ozet: function (gunluk) {
      var g = gunluk || this.gunluk();
      var harita = soruBazinda(g);
      var sorular = Object.keys(harita).map(function (id) { return harita[id]; });

      var denenen = sorular.length;
      var cozulen = 0, ilkDenemede = 0, sureToplam = 0, sureAdet = 0;

      sorular.forEach(function (s) {
        if (!s.kazanan) return;
        cozulen++;
        if (ilkDenemedeMi(s)) ilkDenemede++;
        if (typeof s.kazanan.sure_sn === 'number') {
          sureToplam += s.kazanan.sure_sn;
          sureAdet++;
        }
      });

      /* Güçlü konu / odak alanı: yalnızca yeterli örneklem olan
         konular yarışır. Tek soruya bakıp hüküm vermeyiz. */
      var adaylar = this.konular(g).filter(function (k) {
        return k.denenen >= KONU_ESIGI;
      });
      var sirali = adaylar.slice().sort(function (a, b) {
        return b.ilkDenemeYuzde - a.ilkDenemeYuzde;
      });

      var toplamSoru = Limit.veri.sorular().length;

      return {
        yeterliVeri: g.length >= YETERLI_VERI,
        denemeSayisi: g.length,

        denenenSoru: denenen,
        cozulenSoru: cozulen,
        toplamSoru: toplamSoru,
        kapsamYuzde: Math.min(100, yuzde(denenen, toplamSoru)),

        /* İki ölçüt, AYNI payda: denenen soru sayısı */
        ilkDenemedeSoru: ilkDenemede,
        ilkDenemeYuzde: yuzde(ilkDenemede, denenen),
        sonundaYuzde: yuzde(cozulen, denenen),

        ortalamaSureSn: sureAdet ? Math.round(sureToplam / sureAdet) : null,

        /* İkisi de EN AZ İKİ aday ister. Tek konu varken "güçlü
           konun" demek anlamsız: kıyas yoksa en güçlü de yoktur.
           %33 ile "güçlü konun" yazmak öğrenciyi yanıltırdı. */
        gucluKonu: sirali.length > 1 ? sirali[0] : null,
        odakKonu: sirali.length > 1 ? sirali[sirali.length - 1] : null,
        konuAdayi: adaylar.length
      };
    },

    /* =========================================================
       HIZ–İSABET HARİTASI
       ---------------------------------------------------------
       Her konu iki eksende konumlanır:
         x = hız    → doğruyu bulana kadar geçen ortalama süre (sn)
         y = isabet → ilk denemede yardımsız doğru oranı (%)

       EŞİKLER — ikisi bilinçli olarak FARKLI cinsten:

       İsabet eşiği SABİT (%50). "İlk denemede doğru" zaten
       normalize bir orandır; %50 "denediğim soruların yarısını
       ilk seferde yardımsız çözüyorum" demektir ve anlamı
       öğrenciden öğrenciye değişmez.

       Hız eşiği ÖĞRENCİNİN KENDİ ORTANCASI. Mutlak bir "hızlı"
       saniyesi yoktur: bir geometri sorusu ile bir periyodik
       tablo sorusu aynı sürede çözülmez. Öğrenci kendi
       geçmişiyle kıyaslanır — panelin ilkesi budur.

       Ortanca yerine ortalama kullanılmadı: tek bir çok yavaş
       konu ortalamayı yukarı çekip diğer her şeyi "hızlı"
       gösterirdi.

       Yeterli örneklemli (>= KONU_ESIGI soru) en az iki konu
       yoksa ortanca anlamsızdır; o zaman sabit yedeğe düşülür
       (HIZ_ESIGI_YEDEK, soru başına ~90 sn — sayısal bölümlerde
       yaygın hedef tempo).

       Ortancaya EŞİT süre "hızlı" sayılır: ortancada olmak
       yavaş olmak değildir.
       ========================================================= */
    ISABET_ESIGI: ISABET_ESIGI,
    HIZ_ESIGI_YEDEK: HIZ_ESIGI_YEDEK,
    BOLGELER: BOLGELER,

    hizIsabet: function (gunluk) {
      var g = gunluk || this.gunluk();
      var konular = this.konular(g).filter(function (k) {
        return k.ortalamaSure !== null;
      });

      /* Eşik yalnızca güvenilir konulardan hesaplanır; tek soruluk
         bir konu ortancayı kaydırıp herkesin yerini değiştirmesin. */
      var saglam = konular.filter(function (k) { return k.yeterliOrneklem; });
      var esikSure, yontem;
      if (saglam.length >= 2) {
        esikSure = ortanca(saglam.map(function (k) { return k.ortalamaSure; }));
        yontem = 'ortanca';
      } else {
        esikSure = HIZ_ESIGI_YEDEK;
        yontem = 'sabit';
      }

      var noktalar = konular.map(function (k) {
        var hizli = k.ortalamaSure <= esikSure;
        var isabetli = k.ilkDenemeYuzde >= ISABET_ESIGI;
        var anahtar = hizli
          ? (isabetli ? 'guclu' : 'acele')
          : (isabetli ? 'yavas' : 'kavram');

        return {
          konu: k.konu,
          brans: k.brans,
          denenen: k.denenen,
          sure: k.ortalamaSure,
          isabet: k.ilkDenemeYuzde,
          hizli: hizli,
          isabetli: isabetli,
          bolge: anahtar,
          bolgeAdi: BOLGELER[anahtar].ad,
          /* Örneklemi zayıf konu haritada soluk ve farklı biçimde
             çizilir: üç denemeye bakıp "kavram eksiğin var" demek
             yanıltıcı olurdu. */
          yeterliOrneklem: k.yeterliOrneklem
        };
      });

      return {
        noktalar: noktalar,
        esikSure: esikSure,
        esikIsabet: ISABET_ESIGI,
        yontem: yontem,
        /* Harita en az iki konu ister; tek nokta "bölge" anlatmaz. */
        yeterli: noktalar.length >= 2
      };
    },

    /* =========================================================
       ZAMAN İÇİNDE GELİŞİM
       ---------------------------------------------------------
       Her soru, İLK denendiği güne yazılır. Bu bölümleme sayesinde
       günlerin toplamı özet kartındaki "denenen soru" sayısına
       birebir eşittir — kart ile grafik çelişemez.

       Alternatif (her denemeyi kendi gününe yazmak) aynı soruyu
       birden çok güne dağıtır, toplam kartla tutmazdı.

       Gün sınırı YEREL saate göre çizilir: öğrencinin günü budur.
       ========================================================= */
    gelisim: function (gunluk) {
      var g = gunluk || this.gunluk();
      var harita = soruBazinda(g);
      var gunler = {};

      Object.keys(harita).forEach(function (id) {
        var s = harita[id];
        var ilk = null;
        s.denemeler.forEach(function (d) {
          if (!ilk || d.zaman < ilk) ilk = d.zaman;
        });
        if (!ilk) return;

        var anahtar = gunAnahtari(ilk);
        var gun = gunler[anahtar] || (gunler[anahtar] = {
          gun: anahtar,
          etiket: gunEtiketi(ilk),
          denenen: 0,
          cozulen: 0,
          ilkDenemede: 0,
          toplamSure: 0,
          sureAdet: 0
        });

        gun.denenen++;
        if (s.kazanan) {
          gun.cozulen++;
          if (ilkDenemedeMi(s)) gun.ilkDenemede++;
          if (typeof s.kazanan.sure_sn === 'number') {
            gun.toplamSure += s.kazanan.sure_sn;
            gun.sureAdet++;
          }
        }
      });

      var sirali = Object.keys(gunler).sort().map(function (a) {
        var gun = gunler[a];
        gun.ilkDenemeYuzde = yuzde(gun.ilkDenemede, gun.denenen);
        gun.ortalamaSure = gun.sureAdet
          ? Math.round(gun.toplamSure / gun.sureAdet) : null;
        /* Tek soruluk bir gün %0 ya da %100 verir; çizgi gerçekte
           olmayan bir dalgalanma gösterir. İşaretlenir. */
        gun.azVeri = gun.denenen < KONU_ESIGI;
        return gun;
      });

      var olculebilir = sirali.filter(function (gun) {
        return gun.ortalamaSure !== null;
      });

      return {
        gunler: sirali,
        /* İki nokta olmadan "trend" diye bir şey yoktur. */
        yeterli: sirali.length >= 2,
        gunSayisi: sirali.length,
        ilkGun: sirali.length ? sirali[0] : null,
        sonGun: sirali.length ? sirali[sirali.length - 1] : null,
        sureVarMi: olculebilir.length >= 2
      };
    }
  };

})(window);
