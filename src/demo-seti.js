/* =============================================================
   demo-seti.js — Sunum için örnek istatistik verisi
   -------------------------------------------------------------
   index.html?demo=1 ile açıldığında panelin dolu görünmesini
   sağlar: sunumda beş soru çözmeyi beklemeye gerek kalmaz.

   Üretilen kayıtlar YALNIZCA BELLEKTE döner. Bu dosya hiçbir yere
   yazmaz — çağıran taraf (app.js) diziyi Limit.demoVeri'ye koyar;
   localStorage'a ve öğrencinin gerçek günlüğüne dokunulmaz.

   Ayrı dosyada durmasının sebebi test edilebilirlik: koşum,
   uygulamayı açmadan uret() çağırıp setin ölçeğini ve profilini
   doğrulayabiliyor.

   -------------------------------------------------------------
   PROFİL — veri rastgele DEĞİL, bir öğrenci anlatır
   12 gün · 50 soru · 10 konu · 85 deneme.

     Vektörler II-III, Canlıların Temel Bileşenleri - III
       → kısa süre, yüksek ilk-deneme isabeti      (güçlü)
     Sayılar - VI, Periyodik Özellikler - II
       → hızlı ama isabetsiz              ("acele ediyorsun")
     Sayılar - VII, Canlıların Temel Bileşenleri - II,
     Elementleri Tanıyalım - I
       → yavaş ama isabetli               ("emin ama yavaş")
     Doğruda Açı - IV ve V
       → hem yavaş hem isabetsiz            ("kavram eksiği")

   Böylece hız–isabet haritasının DÖRT bölgesi de dolar.

   Zaman içinde hafif bir gelişim var: ilk günlerde ilk-deneme
   oranı ~%33 ve süreler ~190 sn, son günlerde ~%67 ve ~43 sn.
   Eğri düz değil; gerçek çalışmadaki gibi iyi ve kötü günler
   serpiştirilmiş.

   Konu adları UYDURULMAZ: kayıtlar gerçek soru kimlikleri
   üzerinden üretilir; konu / ünite / branş / zorluk alanlarını
   data/veri.js'ten analitik katmanı doldurur.

   Yükleme sırası: veri → cekirdek → veri-servis → analitik → BU
   ============================================================= */
(function (global) {
  'use strict';

  var Limit = global.Limit;

  var GUN_SAYISI = 12;
  var SIKLAR = ['A', 'B', 'C', 'D', 'E'];

  /* Çalışma programı. Her satır: soru kimliği, gün (0 = en eski),
     denemeler.

     Adım dili — BÜYÜK harf koçsuz, küçük harf koç yardımıyla:
       'D40'  doğru, 40 sn, yardımsız
       'Y55'  yanlış, 55 sn, yardımsız
       'd90'  doğru, 90 sn, koç yardımıyla
       'y70'  yanlış, 70 sn, koç yardımıyla                     */
  var PROGRAM = [
    /* --- KAVRAM EKSİĞİ: yavaş ve isabetsiz --------------------
       İlk günler. Uzun süre, çok deneme, sık koç yardımı. */

    /* Doğruda Açı - IV · ort. 185 sn · ilk denemede %20 */
    ['GEO-T4-S7',  0, ['Y95', 'y150', 'd210']],
    ['GEO-T4-S8',  0, ['Y110', 'y170', 'd195']],
    ['GEO-T4-S9',  0, ['D165']],
    ['GEO-T4-S10', 1, ['Y120', 'd170']],
    ['GEO-T4-S11', 2, ['Y130', 'y185']],            /* çözülemedi */

    /* Doğruda Açı - V · ort. 165 sn · ilk denemede %17 */
    ['GEO-T5-S1', 1, ['Y100', 'y160', 'd180']],
    ['GEO-T5-S2', 2, ['Y115', 'd155']],
    ['GEO-T5-S3', 3, ['D140']],
    ['GEO-T5-S4', 3, ['Y125', 'y175']],             /* çözülemedi */
    ['GEO-T5-S5', 4, ['Y130', 'y190']],             /* çözülemedi */
    ['GEO-T5-S6', 4, ['Y105', 'd185']],

    /* --- EMİN AMA YAVAŞ: uzun süre, yüksek isabet ------------- */

    /* Sayılar - VII · ort. 145 sn · ilk denemede %67 */
    ['MAT-T7-S1', 1, ['D150']],
    ['MAT-T7-S2', 2, ['D130']],
    ['MAT-T7-S3', 4, ['Y90', 'd160']],
    ['MAT-T7-S4', 4, ['D145']],
    ['MAT-T7-S5', 5, ['D155']],
    ['MAT-T7-S6', 5, ['Y100', 'Y140', 'D130']],     /* yardımsız ısrar */

    /* Canlıların Temel Bileşenleri - II · ort. 120 sn · %60 */
    ['BIY-T6-S6',  5, ['D115']],
    ['BIY-T6-S7',  6, ['D125']],
    ['BIY-T6-S8',  6, ['Y80', 'd140']],
    ['BIY-T6-S9',  6, ['D110']],
    ['BIY-T6-S10', 7, ['Y75', 'Y95', 'D110']],

    /* Elementleri Tanıyalım - I · ort. 105 sn · ilk denemede %50
       S4 bilerek böyle: koçtan yardım alıp İLK denemede doğru
       bulmuş. Ölçüt gereği bu "ilk denemede doğru" SAYILMAZ —
       kartın altındaki tanımın karşılığı veride de bulunsun. */
    ['KIM-T7-S1', 7, ['D100']],
    ['KIM-T7-S2', 7, ['Y70', 'd120']],
    ['KIM-T7-S3', 8, ['D95']],
    ['KIM-T7-S4', 8, ['d105']],

    /* --- ACELE EDİYORSUN: hızlı ama isabetsiz ----------------- */

    /* Sayılar - VI · ort. 55 sn · ilk denemede %33 */
    ['MAT-T6-S7',  3,  ['Y25', 'Y35', 'd70']],
    ['MAT-T6-S9',  5,  ['Y20', 'y40', 'd60']],
    ['MAT-T6-S8',  6,  ['D45']],
    ['MAT-T6-S10', 9,  ['D40']],
    ['MAT-T6-S11', 9,  ['Y22', 'D55']],
    ['MAT-T6-S12', 10, ['Y28', 'Y38', 'D60']],

    /* Periyodik Özellikler - II · ort. 50 sn · ilk denemede %25 */
    ['KIM-T6-S5', 4, ['Y20', 'D50']],
    ['KIM-T6-S6', 8, ['D40']],
    ['KIM-T6-S7', 8, ['Y25', 'y45', 'd60']],
    ['KIM-T6-S8', 8, ['Y22', 'Y30']],               /* çözülemedi */

    /* --- HIZLI VE İSABETLİ: son günlerde toparlanma ----------- */

    /* Vektörler - III · ort. 62 sn · ilk denemede %50 */
    ['FIZ-T3-S1', 9,  ['D55']],
    ['FIZ-T3-S2', 9,  ['Y40', 'D80']],
    ['FIZ-T3-S3', 10, ['D48']],
    ['FIZ-T3-S4', 10, ['Y35', 'D65']],

    /* Vektörler - II · ort. 45 sn · ilk denemede %75 */
    ['FIZ-T2-S5', 10, ['D42']],
    ['FIZ-T2-S6', 11, ['D38']],
    ['FIZ-T2-S7', 11, ['Y30', 'D55']],
    ['FIZ-T2-S8', 11, ['D45']],

    /* Canlıların Temel Bileşenleri - III · ort. 38 sn · %83 */
    ['BIY-T7-S1', 7,  ['D40']],
    ['BIY-T7-S2', 9,  ['D35']],
    ['BIY-T7-S3', 10, ['D32']],
    ['BIY-T7-S4', 11, ['D36']],
    ['BIY-T7-S5', 11, ['Y28', 'D50']],
    ['BIY-T7-S6', 11, ['D35']]
  ];

  /* Çeldirici seçimi rastgele değil: öğrenciler en çok doğru
     şıkkın komşularını işaretler, tekrar denerken başka bir şıkka
     kayarlar. Böylece çeldirici analizi anlamlı veri bulur. */
  function celdirici(soru, sira) {
    var d = SIKLAR.indexOf(soru.dogru);
    return SIKLAR[(d + 1 + sira) % SIKLAR.length];
  }

  Limit.demoSeti = {

    GUN_SAYISI: GUN_SAYISI,

    /** Örnek deneme kayıtlarını üretir. Hiçbir yere yazmaz. */
    uret: function () {
      var kayitlar = [];

      /* Gün 0 = GUN_SAYISI-1 gün önce. Saat yerel öğlen: gün sınırı
         yerel hesaplandığı için kayıtlar hangi saat diliminde
         açılırsa açılsın aynı güne düşer. */
      var baslangic = new Date();
      baslangic.setDate(baslangic.getDate() - (GUN_SAYISI - 1));
      baslangic.setHours(12, 0, 0, 0);

      /* Aynı gün içindeki denemeler üst üste binmesin */
      var gunSayaci = {};
      function zaman(gun) {
        gunSayaci[gun] = (gunSayaci[gun] || 0) + 1;
        var t = new Date(baslangic.getTime() + gun * 864e5);
        t.setMinutes(t.getMinutes() + gunSayaci[gun] * 4);
        return t.toISOString();
      }

      PROGRAM.forEach(function (satir) {
        var soru = Limit.veri.soru(satir[0]);
        if (!soru) return;
        var gun = satir[1];

        satir[2].forEach(function (adim, i) {
          var harf = adim.charAt(0);
          var dogruMu = harf === 'D' || harf === 'd';
          var koc = harf === harf.toLowerCase();
          var sure = parseInt(adim.slice(1), 10);

          var kayit = Limit.analitik.denemeKaydi({
            soru: soru,
            secim: dogruMu ? soru.dogru : celdirici(soru, i),
            dogruMu: dogruMu,
            sureSn: sure,
            denemeNo: i + 1,
            cozuldu: dogruMu
          });

          /* denemeKaydi koç durumunu depodaki ipucu kademesinden
             okur; demo depoya dokunmadığı için burada elle yazılır
             ve ölçüt aynı tanımla yeniden türetilir:
             ilk denemede doğru = deneme_no 1 VE koç yardımı yok. */
          kayit.koc_yardimi = koc;
          kayit.ilk_denemede = dogruMu ? (i === 0 && !koc) : null;
          kayit.zaman = zaman(gun);

          kayitlar.push(kayit);
        });
      });

      return kayitlar;
    }
  };

})(window);
