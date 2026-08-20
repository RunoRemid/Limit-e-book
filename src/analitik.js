/* =============================================================
   analitik.js — Öğrenci istatistiklerini Supabase'e yazar
   -------------------------------------------------------------
   TASARIM İLKELERİ

   1. Kurulumsuz kalır. supabase-js SDK'sı YOK; Supabase'in PostgREST
      uç noktasına doğrudan fetch ile yazılır. Böylece no-build
      mimarisi bozulmaz.

   2. Sessiz ve engelsiz. Analitik hiçbir koşulda arayüzü
      bekletmez, hata fırlatmaz, öğrenciye görünmez. Ağ yoksa
      olaylar yerel kuyruğa alınır, sonraki fırsatta gönderilir.

   3. Kapalıyken de çalışır. yapilandirma.js boşsa modül kendini
      kapatır ve demo tümüyle çevrimdışı sürer.

   4. Kişisel veri toplamaz. Yalnızca rastgele bir oturum kimliği
      üretilir; ad, e-posta, IP gibi hiçbir tanımlayıcı gönderilmez.
   ============================================================= */
(function (global) {
  'use strict';

  var Limit = global.Limit || (global.Limit = {});

  var KUYRUK_ANAHTARI = 'limit.analitik.v1';
  var KUYRUK_TAVANI = 200;      /* yerel kuyruk sınırı */
  var TOPLU_BOYUT = 25;         /* tek istekte gönderilecek olay sayısı */

  var ayar = null;
  var acik = false;
  var oturum = null;
  var gonderiliyor = false;

  /* ----------------------------------------------------------- */
  function yerelOku() {
    try {
      var ham = global.localStorage.getItem(KUYRUK_ANAHTARI);
      return ham ? JSON.parse(ham) : { oturum: null, kuyruk: [] };
    } catch (h) {
      return { oturum: null, kuyruk: [] };
    }
  }

  function yerelYaz(nesne) {
    try { global.localStorage.setItem(KUYRUK_ANAHTARI, JSON.stringify(nesne)); }
    catch (h) { /* kota dolu olabilir — analitik yüzünden demo durmaz */ }
  }

  /* crypto.randomUUID her modern tarayıcıda var; yoksa yedek üretici */
  function uuid() {
    if (global.crypto && typeof global.crypto.randomUUID === 'function') {
      return global.crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      var v = c === 'x' ? r : ((r & 0x3) | 0x8);
      return v.toString(16);
    });
  }

  /* Supabase istek başlıkları.
     X-Oturum: okuma politikası bu başlığa bakar. Sunucu tarafındaki
     RLS, satırdaki oturum ile bu değeri karşılaştırır; başlık yoksa
     hiçbir satır dönmez (başarısız-kapanır).
     ⚠ Bu başlık istemciden gelir, sunucu doğrulamaz — toplu dökümü
     engeller ama gerçek kimlik doğrulama değildir. Ayrıntı README'de. */
  function basliklar(ek) {
    var b = {
      'Content-Type': 'application/json',
      'apikey': ayar.supabaseAnonKey,
      'Authorization': 'Bearer ' + ayar.supabaseAnonKey,
      'X-Oturum': oturum
    };
    if (ek) Object.keys(ek).forEach(function (a) { b[a] = ek[a]; });
    return b;
  }

  /* ----------------------------------------------------------- */
  function kuyrugaEkle(kayit) {
    var depo = yerelOku();
    depo.oturum = oturum;
    depo.kuyruk.push(kayit);
    if (depo.kuyruk.length > KUYRUK_TAVANI) {
      depo.kuyruk.splice(0, depo.kuyruk.length - KUYRUK_TAVANI);
    }
    yerelYaz(depo);
  }

  /**
   * Kuyruğu Supabase'e boşaltır. Başarısız olursa kayıtlar kuyrukta
   * kalır; bir sonraki olayda yeniden denenir.
   */
  function bosalt() {
    if (!acik || gonderiliyor) return Promise.resolve(false);

    var depo = yerelOku();
    if (!depo.kuyruk.length) return Promise.resolve(true);

    var toplu = depo.kuyruk.slice(0, TOPLU_BOYUT);
    gonderiliyor = true;

    return fetch(ayar.supabaseUrl.replace(/\/+$/, '') + '/rest/v1/limit_olay', {
      method: 'POST',
      headers: basliklar({ 'Prefer': 'return=minimal' }),
      body: JSON.stringify(toplu),
      keepalive: true            /* sekme kapanırken de gitsin */
    }).then(function (y) {
      if (y.ok) {
        /* Yalnızca gönderilenleri kuyruktan düş — arada yeni olay
           eklenmiş olabilir, tümünü silmek veri kaybettirir. */
        var guncel = yerelOku();
        guncel.kuyruk = guncel.kuyruk.slice(toplu.length);
        yerelYaz(guncel);
        return true;
      }

      /* KALICI hata (400-499, 429 hariç): şema uyuşmuyor ya da
         anahtar geçersiz. Yeniden denemek asla başarmaz; kuyrukta
         tutmak sonsuza kadar birikmeye yol açar. Partiyi düşür. */
      if (y.status >= 400 && y.status < 500 && y.status !== 429) {
        return y.text().catch(function () { return ''; }).then(function (detay) {
          console.warn('[Limit analitik] kalıcı hata ' + y.status +
                       ', bu parti düşürüldü. Şema güncel mi? ' + detay.slice(0, 200));
          var g = yerelOku();
          g.kuyruk = g.kuyruk.slice(toplu.length);
          yerelYaz(g);
          return false;
        });
      }
      throw new Error('Supabase ' + y.status);
    }).catch(function (h) {
      console.debug('[Limit analitik] gönderilemedi, kuyrukta bekliyor:', h.message);
      return false;
    }).then(function (sonuc) {
      gonderiliyor = false;
      return sonuc;
    });
  }

  /* ----------------------------------------------------------- */
  Limit.analitik = {

    baglat: function () {
      ayar = global.LimitAyar || {};
      acik = !!(ayar.analitikAcik && ayar.supabaseUrl && ayar.supabaseAnonKey);

      var depo = yerelOku();
      oturum = depo.oturum || uuid();
      depo.oturum = oturum;
      yerelYaz(depo);

      if (!acik) {
        console.info('[Limit analitik] kapalı — yapilandirma.js içindeki Supabase alanları boş.');
        return false;
      }

      this.olay('oturum', {
        ekstra: {
          surum: Limit.surum,
          ekran: global.innerWidth + 'x' + global.innerHeight,
          dil: global.navigator.language
        }
      });

      /* Sekme kapanırken kuyruğu boşaltmayı dene */
      global.addEventListener('pagehide', function () { bosalt(); });

      console.info('[Limit analitik] açık · oturum ' + oturum.slice(0, 8));
      return true;
    },

    acikMi: function () { return acik; },
    oturumId: function () { return oturum; },

    /**
     * Bir olayı kuyruğa alır ve göndermeyi dener.
     * @param {string} tur  'oturum' | 'soru_goruntuleme' | 'soru_cevap' | 'koc_mesaj' | 'video_izleme'
     */
    olay: function (tur, veri) {
      if (!acik) return;
      veri = veri || {};

      function ya(deger) { return deger === undefined ? null : deger; }

      kuyrugaEkle({
        oturum: oturum,
        kurum: ayar.kurum || 'limit-demo',
        tur: tur,
        brans: veri.brans || null,
        sayfa_id: veri.sayfa_id || null,
        soru_id: veri.soru_id || null,
        soru_no: ya(veri.soru_no),
        /* v2 alanları — konu bazlı analiz ve çeldirici analizi için */
        konu: veri.konu || null,
        unite: veri.unite || null,
        zorluk: ya(veri.zorluk),
        dogru_sik: veri.dogru_sik || null,
        deneme_no: ya(veri.deneme_no),
        ilk_denemede: ya(veri.ilk_denemede),
        koc_yardimi: ya(veri.koc_yardimi),
        secim: veri.secim || null,
        dogru_mu: ya(veri.dogru_mu),
        sure_sn: ya(veri.sure_sn),
        ipucu_kademe: ya(veri.ipucu_kademe),
        anahtar_kaynagi: veri.anahtar_kaynagi || null,
        ekstra: veri.ekstra || null
      });

      bosalt();
    },

    /** Bir soru nesnesinden ortak alanları çıkarır. */
    soruAlanlari: function (soru) {
      var sayfa = Limit.veri.soruSayfasi(soru.id) || {};
      return {
        brans: sayfa.brans,
        sayfa_id: sayfa.id,
        soru_id: soru.id,
        soru_no: soru.no,
        konu: sayfa.konu || null,
        unite: sayfa.unite || null,
        zorluk: soru.zorluk === undefined ? null : soru.zorluk,
        anahtar_kaynagi: soru.anahtarKaynagi
      };
    },

    /**
     * Bir şık işaretlemesinden tam deneme kaydı üretir.
     * Hem yerel günlüğe hem Supabase'e aynı alan kümesi gider;
     * panelin iki kaynağı da aynı biçimde okuyabilmesi için.
     * @param {Object} v  'soru:cevaplandi' olayının verisi
     */
    denemeKaydi: function (v) {
      var soru = v.soru;
      var alanlar = this.soruAlanlari(soru);
      var ilerleme = Limit.depo.ilerlemeAl(soru.id) || {};
      var kademe = ilerleme.ipucuKademe || 0;

      alanlar.oturum = oturum;
      alanlar.zaman = Limit.yrd.simdi();
      alanlar.secim = v.secim;
      /* Doğru şık kaydediliyor: çeldirici analizi bunsuz yapılamaz. */
      alanlar.dogru_sik = soru.dogru || null;
      alanlar.dogru_mu = v.dogruMu;
      alanlar.sure_sn = v.sureSn;
      alanlar.deneme_no = v.denemeNo || 1;
      /* "İlk denemede" yalnızca DOĞRU bulunduğunda anlamlıdır;
         yanlış denemelerde null bırakılır ki oranlar bozulmasın. */
      alanlar.ilk_denemede = v.dogruMu === true ? (v.denemeNo === 1) : null;
      alanlar.koc_yardimi = kademe > 0;

      return alanlar;
    },

    bosalt: bosalt
  };

})(window);
