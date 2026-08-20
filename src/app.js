/* =============================================================
   app.js — Önyükleme, adres yönlendirme, panel ve ayar kontrolü
   Betik sırasında EN SON yüklenir.
   ============================================================= */
(function (global) {
  'use strict';

  var Limit = global.Limit;
  var Y = Limit.yrd;
  var kabuk;

  /* ===========================================================
     Adres yönlendirme:  #/brans/soruId
     Sayfa yenilense de aynı soruda kalınır, bağlantı paylaşılabilir.
     =========================================================== */
  function adresYaz() {
    var d = Limit.depo.al();
    var yeni = d.gorunum === 'istatistik'
      ? '#/istatistik'
      : '#/' + (d.aktifBrans || '') + (d.aktifSoruId ? '/' + d.aktifSoruId : '');
    if (global.location.hash !== yeni) {
      global.history.replaceState(null, '', yeni);
    }
  }

  function adresOku() {
    var parca = (global.location.hash || '').replace(/^#\/?/, '').split('/');

    /* #/istatistik ayrı bir görünüm; branş/soru kısmına karışmaz. */
    if (parca[0] === 'istatistik') {
      return { gorunum: 'istatistik', brans: null, soruId: null };
    }

    var brans = parca[0] || null;
    var soruId = parca[1] || null;
    if (brans && !Limit.veri.brans(brans)) brans = null;
    if (soruId && !Limit.veri.soru(soruId)) soruId = null;
    return { gorunum: 'soru', brans: brans, soruId: soruId };
  }

  /* İstatistik düğmesinin basılı/aktif görünümü */
  function istatistikDugmesiTazele() {
    var d = Y.sec('#dugmeIstatistik');
    if (d) d.setAttribute('aria-current', String(Limit.depo.al().gorunum === 'istatistik'));
  }

  /* ===========================================================
     Panel kontrolü
     =========================================================== */
  function panelleriUygula() {
    var d = Limit.depo.al();
    /* Koç artık sabit panel değil, açılır pencere — yalnızca konu paneli. */
    kabuk.setAttribute('data-yan-acik', d.yanAcik ? 'evet' : 'hayir');
  }

  /* ===========================================================
     Ayarlar kutusu
     =========================================================== */
  function ayarlariAc() {
    var kutu = Y.sec('#ayarKutusu');
    var d = Limit.depo.al();
    Y.sec('#ayarSaglayici').value = d.ayarlar.aiSaglayici;
    Y.sec('#ayarUcNokta').value = d.ayarlar.aiUcNokta || '';
    ayarAlanTazele();
    if (typeof kutu.showModal === 'function') kutu.showModal();
    else kutu.setAttribute('open', 'open');
  }

  function ayarAlanTazele() {
    var uzak = Y.sec('#ayarSaglayici').value === 'uzak';
    Y.sec('#ayarUcNoktaSatiri').style.display = uzak ? 'block' : 'none';
  }

  function ayarlariKaydet() {
    var saglayici = Y.sec('#ayarSaglayici').value;
    var ucNokta = Y.sec('#ayarUcNokta').value.trim();

    if (saglayici === 'uzak' && !ucNokta) {
      Limit.bildir('Uzak kip için bir uç nokta adresi girmelisin.');
      return;
    }
    Limit.depo.guncelle({ ayarlar: { aiSaglayici: saglayici, aiUcNokta: ucNokta } });
    Y.sec('#ayarKutusu').close();
    Limit.bildir(saglayici === 'uzak' ? 'Koç uzak servise bağlandı.' : 'Koç çevrimdışı motorda çalışıyor.');
  }

  /* ===========================================================
     Video çözüm kutusu
     -----------------------------------------------------------
     iframe'in src'si yalnızca kutu açıkken doludur. Kapanışta
     boşaltılır; aksi hâlde YouTube gömmesi arka planda çalmaya
     devam eder ve öğrenci sesi kesemez.
     =========================================================== */
  function videoKutusu() { return Y.sec('#videoKutusu'); }

  function videoAc(soru) {
    if (!soru || !soru.video_url) {
      Limit.bildir('Bu soru için henüz video çözüm bağlantısı girilmemiş.');
      return;
    }
    var sayfa = Limit.veri.soruSayfasi(soru.id) || {};
    var kutu = videoKutusu();

    Y.sec('#videoBaslik').textContent = 'Öğretmen Çözümü · ' + soru.no + '. soru';
    Y.sec('#videoAlt').textContent = sayfa.konu + ' · Test ' + sayfa.test + ' · kitap s.' + sayfa.kitapSayfa;
    Y.sec('#videoCerceve').src = soru.video_url;

    if (typeof kutu.showModal === 'function') kutu.showModal();
    else kutu.setAttribute('open', 'open');

    Limit.sahne.kronoDurdur();   /* video izlerken kronometre işlemesin */
    Limit.analitik.olay('video_izleme', Limit.analitik.soruAlanlari(soru));
  }

  function videoKapat() {
    var kutu = videoKutusu();
    Y.sec('#videoCerceve').src = '';          /* oynatmayı durdur */
    if (typeof kutu.close === 'function' && kutu.open) kutu.close();
    else kutu.removeAttribute('open');
  }

  /* ===========================================================
     Uygulama API'si — arayüz katmanları bunu çağırır
     =========================================================== */
  Limit.uygulama = {

    bransSec: function (bransId) {
      var d = Limit.depo.al();
      if (d.aktifBrans === bransId && d.aktifSoruId) return;

      var ilk = Limit.veri.bransSorulari(bransId)[0];
      Limit.depo.guncelle({ aktifBrans: bransId, aktifSoruId: ilk ? ilk.id : null });
      adresYaz();
      Limit.sahne.ciz();
      Limit.olay.yayinla('soru:degisti', { soruId: ilk ? ilk.id : null });
    },

    soruAc: function (soruId) {
      var soru = Limit.veri.soru(soruId);
      if (!soru) return;
      var sayfa = Limit.veri.soruSayfasi(soruId);
      Limit.sahne.kronoDurdur();
      Limit.depo.guncelle({ aktifSoruId: soruId, aktifBrans: sayfa.brans });
      adresYaz();
      Limit.sahne.ciz();
      Limit.olay.yayinla('soru:degisti', { soruId: soruId });
      if (global.innerWidth <= 900) Limit.uygulama.yanAcKapa(false);
    },

    /* Taramada odak / tam sayfa geçişi */
    tamSayfaAcKapa: function (deger) {
      var d = Limit.depo.al();
      var yeni = deger === undefined ? !d.tamSayfa : !!deger;
      Limit.depo.guncelle({ tamSayfa: yeni, yakinlik: 1 }, true);
      Limit.sahne.ciz();
    },

    videoAc: videoAc,
    videoKapat: videoKapat,

    /* --- İstatistik görünümü ------------------------------- */
    istatistikAc: function () {
      Limit.depo.guncelle({ gorunum: 'istatistik' }, true);
      adresYaz();
      istatistikDugmesiTazele();
      Limit.sahne.ciz();
      var s = Y.sec('#sahne');
      if (s) s.scrollTop = 0;
    },

    istatistikKapat: function () {
      Limit.depo.guncelle({ gorunum: 'soru' }, true);
      adresYaz();
      istatistikDugmesiTazele();
      Limit.sahne.ciz();
    },

    /* Yakınlık kademesini bir adım değiştirir */
    yakinlikDegistir: function (yon) {
      var kademeler = Limit.sahne.YAKINLIK_KADEMELERI;
      var d = Limit.depo.al();
      var i = kademeler.indexOf(d.yakinlik);
      if (i === -1) i = 0;
      var yeni = kademeler[Math.max(0, Math.min(kademeler.length - 1, i + yon))];
      if (yeni === d.yakinlik) return;
      Limit.depo.guncelle({ yakinlik: yeni }, true);
      Limit.sahne.ciz();
    },

    gez: function (yon) {
      var d = Limit.depo.al();
      var hedef = Limit.veri.komsu(d.aktifSoruId, yon);
      if (!hedef) { Limit.bildir(yon === 'onceki' ? 'İlk sorudasın.' : 'Bu branşın son sorusu.'); return; }
      this.soruAc(hedef.id);
    },

    yanAcKapa: function (acik) {
      var d = Limit.depo.al();
      var yeni = acik === undefined ? !d.yanAcik : !!acik;
      Limit.depo.guncelle({ yanAcik: yeni }, true);
      panelleriUygula();
    },

    /* ------------------------------------------------------- */
    baglat: function () {
      kabuk = Y.sec('#uygulama');

      /* 1) Veri katmanı */
      try {
        var meta = Limit.veri.baglat();
        Y.sec('#markaAlt').textContent = meta.urun;
        document.title = meta.urun + ' · ' + meta.yayin;
      } catch (h) {
        document.body.innerHTML =
          '<div style="padding:48px;font-family:system-ui;color:#12233F">' +
          '<h1 style="color:#C8102E">Veri yüklenemedi</h1><p>' + Y.kacis(h.message) + '</p></div>';
        return;
      }

      /* 2) Adresten gelen durum, kayıtlı durumun önüne geçer */
      var adres = adresOku();
      /* Görünüm her zaman adresten gelir: #/istatistik ile paylaşılan
         bağlantı doğrudan panele açılsın, kayıtlı durum ezmesin. */
      Limit.depo.guncelle({ gorunum: adres.gorunum }, true);
      if (adres.brans || adres.soruId) {
        Limit.depo.guncelle({
          aktifBrans: adres.brans || (adres.soruId ? Limit.veri.soruSayfasi(adres.soruId).brans : null),
          aktifSoruId: adres.soruId
        }, true);
      }

      /* 2b) Canlı yapılandırma — yapilandirma.js dolduruysa koç uzak
             servise geçer. Kullanıcı Ayarlar'dan kendi adresini
             girmişse ona dokunulmaz; yapılandırma yalnızca TOHUMLAR. */
      var kfg = global.LimitAyar || {};
      if (kfg.aiUcNokta && !Limit.depo.al().ayarlar.aiUcNokta) {
        Limit.depo.guncelle({
          ayarlar: { aiSaglayici: 'uzak', aiUcNokta: kfg.aiUcNokta }
        }, true);
      }

      /* 2c) Analitik — Supabase alanları boşsa sessizce kapalı kalır */
      Limit.analitik.baglat();

      /* 3) Dar ekranda konu paneli çekmece gibi davranır; içeriğin
            üstünü kapatmasın diye kapalı açılır. */
      if (global.innerWidth <= 900) {
        Limit.depo.guncelle({ yanAcik: false }, true);
      }

      /* 4) Katmanlar */
      panelleriUygula();
      Limit.sahne.baglat();
      Limit.yanpanel.baglat();
      Limit.koc.baglat();
      Limit.sahne.ciz();
      adresYaz();

      /* 5) Kabuk düğmeleri */
      Y.sec('#dugmeYanPanel').addEventListener('click', function () { Limit.uygulama.yanAcKapa(); });
      Y.sec('#dugmeIstatistik').addEventListener('click', function () {
        var d = Limit.depo.al();
        if (d.gorunum === 'istatistik') Limit.uygulama.istatistikKapat();
        else Limit.uygulama.istatistikAc();
      });
      istatistikDugmesiTazele();

      Y.sec('#dugmeAyar').addEventListener('click', ayarlariAc);
      Y.sec('#perde').addEventListener('click', function () {
        Limit.uygulama.yanAcKapa(false);
      });

      /* Video kutusu: çarpı, dışarı tıklama ve Esc ile kapanır.
         <dialog> Esc'i kendi yakalar; 'close' olayında src boşaltılır. */
      Y.sec('#videoKapat').addEventListener('click', videoKapat);
      videoKutusu().addEventListener('click', function (e) {
        /* Perdeye yapılan tıklama hedef olarak dialog'un kendisini verir */
        if (e.target === e.currentTarget) videoKapat();
      });
      videoKutusu().addEventListener('close', function () {
        Y.sec('#videoCerceve').src = '';
      });

      Y.sec('#ayarSaglayici').addEventListener('change', ayarAlanTazele);
      Y.sec('#ayarKaydet').addEventListener('click', ayarlariKaydet);
      Y.sec('#ayarIptal').addEventListener('click', function () { Y.sec('#ayarKutusu').close(); });
      Y.sec('#ayarSifirla').addEventListener('click', function () {
        if (!global.confirm('Tüm ilerleme ve koç oturumları silinecek. Onaylıyor musun?')) return;
        Limit.depo.sifirla();
        Y.sec('#ayarKutusu').close();
        Limit.sahne.ciz();
        Limit.koc.tazele();
        panelleriUygula();
        Limit.bildir('Demo sıfırlandı.');
      });

      /* 5b) Analitik kancaları — arayüz katmanları analitiği bilmez,
             yalnızca olay yayınlar; bağlama burada yapılır. */
      Limit.olay.dinle('soru:cevaplandi', function (v) {
        /* Tek kayıt, iki hedef: önce YEREL günlük (panelin birincil
           kaynağı, ağ olmadan da dolu), sonra Supabase (varsa). */
        var kayit = Limit.analitik.denemeKaydi(v);

        Limit.depo.denemeEkle(kayit);

        var ilerleme = Limit.depo.ilerlemeAl(v.soru.id);
        var alanlar = Object.assign({}, kayit, {
          ipucu_kademe: ilerleme ? ilerleme.ipucuKademe : 0,
          ekstra: { cozuldu: !!v.cozuldu }
        });
        Limit.analitik.olay('soru_cevap', alanlar);
      });

      Limit.olay.dinle('soru:degisti', function (v) {
        if (!v.soruId) return;
        var soru = Limit.veri.soru(v.soruId);
        if (soru) Limit.analitik.olay('soru_goruntuleme', Limit.analitik.soruAlanlari(soru));
      });

      Limit.olay.dinle('koc:yanit', function (v) {
        var alanlar = Limit.analitik.soruAlanlari(v.soru);
        alanlar.ipucu_kademe = v.kademe;
        alanlar.ekstra = { kaynak: v.kaynak };
        Limit.analitik.olay('koc_mesaj', alanlar);
      });

      /* 6) Klavye kısayolları */
      document.addEventListener('keydown', function (e) {
        var yaziyor = /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
        if (yaziyor) return;
        /* Bir kutu açıkken kısayollar arkadaki soruya işlemesin;
           Esc'i <dialog> zaten kendi karşılıyor. */
        if (videoKutusu().open || Y.sec('#ayarKutusu').open || Limit.koc.acikMi()) return;

        if (e.key === 'ArrowRight') Limit.uygulama.gez('sonraki');
        else if (e.key === 'ArrowLeft') Limit.uygulama.gez('onceki');
        else if (e.key.toLowerCase() === 'k') Limit.koc.ac('yardim');
        /* 'c' bilinçli olarak kullanılmıyor: C şıkkı kısayoluyla çakışırdı. */
        else if (e.key.toLowerCase() === 'ç') Limit.koc.ac('cozum');
        else if (e.key.toLowerCase() === 't') Limit.uygulama.tamSayfaAcKapa();
        else if (e.key.toLowerCase() === 'v') {
          var d = Limit.depo.al();
          if (d.aktifSoruId) videoAc(Limit.veri.soru(d.aktifSoruId));
        }
        else if (e.key === '+' || e.key === '=') Limit.uygulama.yakinlikDegistir(1);
        else if (e.key === '-' || e.key === '_') Limit.uygulama.yakinlikDegistir(-1);
        else if (/^[a-eA-E]$/.test(e.key)) {
          var d = Y.sec('.sik[data-harf="' + e.key.toUpperCase() + '"]');
          if (d && !d.disabled) d.click();
        }
      });

      /* 7) Geri/ileri düğmeleri */
      global.addEventListener('hashchange', function () {
        var a = adresOku();
        if (a.soruId && a.soruId !== Limit.depo.al().aktifSoruId) Limit.uygulama.soruAc(a.soruId);
      });



      /* --- Sunum yardımcısı: örnek istatistik verisi -------------
         index.html?demo=1 ile açılırsa panel örnek verilerle dolar.
         Sunumda paneli canlı göstermek için; beş soru çözmeyi
         beklemeye gerek kalmaz.

         Kayıtlar BELLEKTE durur (Limit.demoVeri); localStorage'a ve
         öğrencinin gerçek günlüğüne dokunulmaz. Setin kendisi ve
         hangi öğrenci profilini anlattığı src/demo-seti.js'te.

         Parametre verilmezse tek satırı bile çalışmaz.            */
      (function () {
        if (global.location.search.indexOf('demo=1') === -1) return;
        Limit.istatistikOrnekVeri = true;
        Limit.demoVeri = Limit.demoSeti.uret();
        Limit.depo.guncelle({ gorunum: 'istatistik' }, true);
        adresYaz(); istatistikDugmesiTazele(); Limit.sahne.ciz();
      })();



      console.info('[Limit] Sayısal demo hazır · sürüm ' + Limit.surum +
                   ' · ' + Limit.veri.sorular().length + ' soru yüklendi.');
    }
  };

  /* Önyükleme */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { Limit.uygulama.baglat(); });
  } else {
    Limit.uygulama.baglat();
  }

})(window);
