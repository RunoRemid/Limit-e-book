/* =============================================================
   ui-koc.js — "Limit Koç" açılır penceresi
   -------------------------------------------------------------
   Sabit yan panel kaldırıldı: ana ekran soruya kalsın diye koç
   yalnızca çağrıldığında modal olarak gelir.

   İKİ GİRİŞ KAPISI, İKİ KİP
     ac('yardim') → Sokratik ipucu. Cevabı asla vermez.
     ac('cozum')  → Öğrenci çözümü görmeyi seçti; koç soruyu
                    adım adım çözer ve cevabı yazar.

   Kip mesaj başınadır: "Koç çözsün" tek seferlik bir çözüm
   isteğidir; sonrasında öğrencinin yazdığı mesajlar yeniden
   Sokratik kipe döner.
   ============================================================= */
(function (global) {
  'use strict';

  var Limit = global.Limit;
  var Y = Limit.yrd;

  var kutu, akis, giris, oneriKap, altBilgi;
  var bekliyor = false;

  /* ----------------------------------------------------------- */
  function aktifSoru() {
    var id = Limit.depo.al().aktifSoruId;
    return id ? Limit.veri.soru(id) : null;
  }

  function acikMi() { return !!(kutu && kutu.open); }

  function balonEkle(rol, metin, kalici) {
    var sinif = rol === 'ogrenci' ? 'balon balon--ogrenci'
              : rol === 'sistem' ? 'balon balon--sistem'
              : 'balon balon--koc';

    var balon = Y.el('div', { class: sinif });
    if (rol === 'koc') balon.appendChild(Y.el('span', { class: 'balon__etiket', metin: 'Limit Koç' }));
    balon.appendChild(document.createTextNode(metin));

    akis.appendChild(balon);
    akis.scrollTop = akis.scrollHeight;

    if (kalici !== false) {
      var soru = aktifSoru();
      if (soru && rol !== 'sistem') Limit.depo.sohbetEkle(soru.id, rol, metin);
    }
    return balon;
  }

  function yaziyorGoster() {
    var b = Y.el('div', { class: 'balon balon--koc', id: 'yaziyorBalonu' }, [
      Y.el('span', { class: 'yaziyor' }, [Y.el('span'), Y.el('span'), Y.el('span')])
    ]);
    akis.appendChild(b);
    akis.scrollTop = akis.scrollHeight;
    return b;
  }

  function yaziyorGizle() {
    var b = Y.sec('#yaziyorBalonu');
    if (b) b.remove();
  }

  /* ----------------------------------------------------------- */
  function onerileriCiz() {
    Y.bosalt(oneriKap);
    var soru = aktifSoru();
    if (!soru) return;

    var ilerleme = Limit.depo.ilerlemeAl(soru.id);
    Limit.ai.oneriler(soru, ilerleme).forEach(function (metin) {
      oneriKap.appendChild(Y.el('button', {
        class: 'oneri',
        metin: metin,
        onclick: function () { gonder(metin); }
      }));
    });
  }

  function altBilgiTazele(kip) {
    var ayar = Limit.depo.al().ayarlar;
    var uzak = ayar.aiSaglayici === 'uzak' && ayar.aiUcNokta;
    var motor = uzak
      ? ((global.LimitAyar && global.LimitAyar.aiModel) || 'gpt-4o-mini')
      : 'çevrimdışı motor';
    var kipAdi = kip === 'cozum' ? 'Tam çözüm' : 'Sokratik yardım';
    altBilgi.textContent = kipAdi + ' · ' + motor;
  }

  /* ----------------------------------------------------------- */
  function gonder(metin, kip) {
    var soru = aktifSoru();
    if (!soru) { Limit.bildir('Önce bir soru aç.'); return; }
    metin = (metin || '').trim();
    if (!metin || bekliyor) return;

    kip = kip === 'cozum' ? 'cozum' : 'yardim';
    altBilgiTazele(kip);
    kutu.setAttribute('data-kip', kip);

    balonEkle('ogrenci', metin);
    giris.value = '';
    giris.style.height = 'auto';

    bekliyor = true;
    yaziyorGoster();

    var kayit = Limit.depo.ilerlemeAl(soru.id) || {};
    var gecmis = Limit.depo.sohbetAl(soru.id).slice(-8, -1);

    Limit.ai.sor({
      soru: soru,
      mesaj: metin,
      gecmis: gecmis,
      kip: kip,
      baglam: {
        kademe: kayit.ipucuKademe || 0,
        secim: kayit.secim || null,
        denemeler: kayit.denemeler || [],
        dogruMu: kayit.dogruMu,
        gecenSure: kayit.sureSn || 0
      }
    }).then(function (yanit) {
      yaziyorGizle();
      balonEkle('koc', yanit.metin);
      Limit.depo.ilerlemeYaz(soru.id, { ipucuKademe: yanit.kademe });
      Limit.olay.yayinla('koc:yanit', {
        soru: soru, kademe: yanit.kademe, kaynak: yanit.kaynak, kip: kip
      });
      if (yanit.kaynak === 'yerel-yedek') {
        balonEkle('sistem', 'Uzak servise ulaşılamadı; çevrimdışı koç motoruna geçildi.', false);
      }
      if (yanit.kaynak === 'yerel-suzgec') {
        balonEkle('sistem', 'Gelen yanıt cevabı sızdırdığı için engellendi.', false);
      }
    }).catch(function (h) {
      yaziyorGizle();
      balonEkle('sistem', 'Koça ulaşılamadı: ' + h.message, false);
    }).then(function () {
      bekliyor = false;
      onerileriCiz();
      if (acikMi()) giris.focus();
    });
  }

  /* ----------------------------------------------------------- */
  function oturumuYukle() {
    Y.bosalt(akis);
    var soru = aktifSoru();
    if (!soru) return;

    var gecmis = Limit.depo.sohbetAl(soru.id);
    if (gecmis.length) {
      gecmis.forEach(function (m) { balonEkle(m.rol, m.metin, false); });
    } else {
      balonEkle('koc', Limit.ai.acilis(soru, Limit.depo.ilerlemeAl(soru.id)));
    }
    onerileriCiz();
    akis.scrollTop = akis.scrollHeight;
  }

  /* ----------------------------------------------------------- */
  function ac(kip) {
    var soru = aktifSoru();
    if (!soru) { Limit.bildir('Önce bir soru aç.'); return; }

    kip = kip === 'cozum' ? 'cozum' : 'yardim';
    kutu.setAttribute('data-kip', kip);
    altBilgiTazele(kip);

    if (!acikMi()) {
      if (typeof kutu.showModal === 'function') kutu.showModal();
      else kutu.setAttribute('open', 'open');
      oturumuYukle();
    }

    if (kip === 'cozum') {
      /* Tek seferlik çözüm isteği; sonraki mesajlar yine Sokratik. */
      gonder('Bu soruyu adım adım çözer misin?', 'cozum');
    } else {
      setTimeout(function () { if (acikMi()) giris.focus(); }, 120);
    }
  }

  function kapat() {
    if (!kutu) return;
    if (typeof kutu.close === 'function' && kutu.open) kutu.close();
    else kutu.removeAttribute('open');
  }

  /* ----------------------------------------------------------- */
  Limit.koc = {
    baglat: function () {
      kutu = Y.sec('#kocKutusu');
      akis = Y.sec('#kocAkis');
      giris = Y.sec('#kocGiris');
      oneriKap = Y.sec('#kocOneriler');
      altBilgi = Y.sec('#kocAltBilgi');

      Y.sec('#kocGonder').addEventListener('click', function () { gonder(giris.value); });
      Y.sec('#kocKapat').addEventListener('click', kapat);

      giris.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          gonder(giris.value);
        }
      });

      giris.addEventListener('input', function () {
        giris.style.height = 'auto';
        giris.style.height = Math.min(giris.scrollHeight, 140) + 'px';
      });

      Y.sec('#kocTemizle').addEventListener('click', function () {
        var soru = aktifSoru();
        if (!soru) return;
        Limit.depo.sohbetSil(soru.id);
        Limit.depo.ilerlemeYaz(soru.id, { ipucuKademe: 0 });
        oturumuYukle();
        Limit.bildir('Koç oturumu sıfırlandı.');
      });

      /* Perdeye tıklayınca kapan */
      kutu.addEventListener('click', function (e) {
        if (e.target === e.currentTarget) kapat();
      });

      /* Soru değişirse açık oturumu tazele (kutu kapalıysa boşuna çizme) */
      Limit.olay.dinle('soru:degisti', function () {
        if (acikMi()) oturumuYukle();
      });

      Limit.olay.dinle('durum:degisti', function () {
        if (acikMi()) altBilgiTazele(kutu.getAttribute('data-kip'));
      });
    },

    ac: ac,
    kapat: kapat,
    acikMi: acikMi,
    tazele: oturumuYukle
  };

})(window);
