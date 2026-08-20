/* =============================================================
   grafik.js — İstatistik görselleştirmeleri
   -------------------------------------------------------------
   Chart.js'i marka diline sokar. Kutudan çıkan görünüm bilinçli
   olarak KULLANILMAZ: varsayılan ızgaralar, mavi paleti ve koyu
   tooltip'i tam da kaçındığımız "jenerik dashboard" görüntüsüdür.

   ÖLÇÜT KURALI
   Bu dosya ölçüt HESAPLAMAZ. Tüm sayılar src/istatistik.js'ten
   gelir; böylece özet kartı ile grafik asla çelişemez.
   "İlk denemede doğru" orada deneme_no=1 VE koc_yardimi=false
   olarak tanımlıdır ve burada da aynen o alan çizilir.

   RENK ANLAMI — tüm grafiklerde AYNI
     yeşil  → ilk denemede doğru (hakimiyet)
     gümüş  → sonradan çözüldü (tekrar ya da yardımla)
     kızıl  → yanlış / henüz çözülmedi
   Renk anlamı grafikten grafiğe DEĞİŞMEZ. Süre grafiği doğruluk
   ölçmediği için nötr gümüş kullanır.

   DAYANIKLILIK
   Chart.js CDN'den gelir. Ağ yoksa kütüphane yüklenmez; o durumda
   grafik yerine aynı veriyi taşıyan bir tablo çizilir. Panel
   hiçbir koşulda boş kalmaz.
   ============================================================= */
(function (global) {
  'use strict';

  var Limit = global.Limit;
  var Y = Limit.yrd;

  /* Token'lardan okunan marka renkleri — burada sabit renk üretilmez. */
  function jeton(ad, yedek) {
    var d = getComputedStyle(document.documentElement).getPropertyValue(ad).trim();
    return d || yedek;
  }

  var RENK = null;
  function renkler() {
    if (RENK) return RENK;
    RENK = {
      hakimiyet: jeton('--dogru', '#0F8A5F'),
      sonradan:  jeton('--gumus-orta', '#999999'),
      yanlis:    jeton('--kizil-zemin', '#9C0000'),
      notr:      jeton('--gumus-koyu', '#525252'),
      cizgi:     jeton('--cizgi', '#E4E5E8'),
      metin:     jeton('--metin-orta', '#5A5C64'),
      murekkep:  jeton('--murekkep', '#24252A'),
      yuzey:     jeton('--yuzey', '#FFFFFF')
    };
    return RENK;
  }

  function hareketVar() {
    return !global.matchMedia ||
           !global.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function chartVarMi() { return typeof global.Chart !== 'undefined'; }

  /* ----------------------------------------------------------- */
  /* Chart.js ortak teması                                        */
  /* ----------------------------------------------------------- */
  function temaKur() {
    if (!chartVarMi()) return;
    var C = global.Chart, r = renkler();

    C.defaults.font.family =
      getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';
    C.defaults.font.size = 12;
    C.defaults.color = r.metin;
    C.defaults.animation = hareketVar() ? { duration: 320, easing: 'easeOutQuart' } : false;

    /* Varsayılan koyu tooltip yerine marka yüzeyi */
    C.defaults.plugins.tooltip.backgroundColor = r.yuzey;
    C.defaults.plugins.tooltip.titleColor = r.murekkep;
    C.defaults.plugins.tooltip.bodyColor = r.metin;
    C.defaults.plugins.tooltip.borderColor = r.cizgi;
    C.defaults.plugins.tooltip.borderWidth = 1;
    C.defaults.plugins.tooltip.cornerRadius = 6;
    C.defaults.plugins.tooltip.padding = 10;
    C.defaults.plugins.tooltip.displayColors = true;
    C.defaults.plugins.tooltip.boxWidth = 10;
    C.defaults.plugins.tooltip.boxHeight = 10;

    /* Kendi göstergemizi (legend) HTML olarak çiziyoruz */
    C.defaults.plugins.legend.display = false;
  }

  /* Bar uçlarına sayı yazan küçük eklenti — renge bağlı kalmamak için. */
  var sayiEklentisi = {
    id: 'ucSayilari',
    afterDatasetsDraw: function (grafik, arg, secenek) {
      if (!secenek || secenek.acik === false) return;
      var ctx = grafik.ctx;
      var r = renkler();
      ctx.save();
      ctx.font = '600 11px ' + (global.Chart.defaults.font.family);
      ctx.fillStyle = r.metin;
      ctx.textBaseline = 'middle';

      grafik.data.datasets.forEach(function (veriSeti, i) {
        var meta = grafik.getDatasetMeta(i);
        if (meta.hidden) return;
        meta.data.forEach(function (nokta, j) {
          var deger = veriSeti.data[j];
          if (!deger) return;                       /* 0 yazma */
          var yatay = grafik.options.indexAxis === 'y';
          ctx.textAlign = yatay ? 'center' : 'center';
          var x = yatay ? nokta.x - (nokta.width || 0) / 2 : nokta.x;
          var y = yatay ? nokta.y : nokta.y - 9;
          if (yatay && (nokta.width || 0) < 18) return;  /* sığmıyorsa yazma */
          ctx.fillText(String(deger), x, y);
        });
      });
      ctx.restore();
    }
  };

  /* Neredeyse görünmez ızgara */
  function eksenIzgara(goster) {
    return {
      display: !!goster,
      color: renkler().cizgi,
      drawTicks: false
    };
  }

  /* ----------------------------------------------------------- */
  /* Yardımcılar                                                  */
  /* ----------------------------------------------------------- */
  function etiket(k) {
    return k.yeterliOrneklem ? k.konu : k.konu + ' (az veri)';
  }

  /* Yetersiz örneklemli konu soluk çizilir: sıfır gibi görünmesin,
     ama tam ağırlıkla da okunmasın. */
  function saydam(renk, k) {
    return k.yeterliOrneklem ? renk : renk + '66';
  }

  function gosterge(ogeler) {
    return Y.el('ul', { class: 'grafik-gosterge' }, ogeler.map(function (o) {
      return Y.el('li', {}, [
        Y.el('span', { class: 'grafik-gosterge__kutu', style: 'background:' + o.renk }),
        Y.el('span', { metin: o.ad })
      ]);
    }));
  }

  function ozetMetni(metin) {
    return Y.el('p', { class: 'grafik-ozet', metin: metin });
  }

  /* Chart.js yoksa aynı veriyi taşıyan tablo — hem yedek hem
     ekran okuyucu dostu. */
  function tablo(basliklar, satirlar) {
    return Y.el('div', { class: 'grafik-tablo-sarmal' }, [
      Y.el('table', { class: 'grafik-tablo' }, [
        Y.el('thead', {}, [
          Y.el('tr', {}, basliklar.map(function (b) {
            return Y.el('th', { metin: b });
          }))
        ]),
        Y.el('tbody', {}, satirlar.map(function (s) {
          return Y.el('tr', {}, s.map(function (h, i) {
            return Y.el(i === 0 ? 'th' : 'td', { metin: String(h) });
          }));
        }))
      ])
    ]);
  }

  function tuval(yukseklik) {
    return Y.el('div', {
      class: 'grafik-tuval',
      style: 'height:' + yukseklik + 'px'
    }, [Y.el('canvas')]);
  }

  function ciz(kap, yapilandirma) {
    var c = kap.querySelector('canvas');
    return new global.Chart(c.getContext('2d'), yapilandirma);
  }

  /* ===========================================================
     1) Konu bazında doğru ve yanlış — yatay yığılmış bar
     -----------------------------------------------------------
     İkili doğru/yanlış yerine ÜÇLÜ ayrım kullanılıyor: sınırsız
     denemede herkesin her sorusu sonunda "doğru" olacağı için
     ikili gösterim özet kartıyla çelişirdi.
     =========================================================== */
  function konuBarı(konular) {
    var r = renkler();
    var govde = Y.el('div', {});

    var toplamIlk = konular.reduce(function (t, k) { return t + k.ilkDenemede; }, 0);
    var toplamDenenen = konular.reduce(function (t, k) { return t + k.denenen; }, 0);

    govde.appendChild(ozetMetni(
      konular.length + ' konuda toplam ' + toplamDenenen + ' soru denendi; ' +
      toplamIlk + " tanesi ilk denemede yardımsız çözüldü. En yüksek oran: " +
      (konular.slice().sort(function (a, b) {
        return b.ilkDenemeYuzde - a.ilkDenemeYuzde;
      })[0] || {}).konu + '.'
    ));

    govde.appendChild(gosterge([
      { ad: 'İlk denemede doğru', renk: r.hakimiyet },
      { ad: 'Sonradan çözüldü', renk: r.sonradan },
      { ad: 'Henüz çözülmedi', renk: r.yanlis }
    ]));

    if (!chartVarMi()) {
      govde.appendChild(tablo(
        ['Konu', 'İlk denemede', 'Sonradan', 'Çözülmedi'],
        konular.map(function (k) {
          return [etiket(k), k.ilkDenemede, k.sonradanCozulen, k.cozulemeyen];
        })
      ));
      return govde;
    }

    var kap = tuval(Math.max(160, konular.length * 46 + 40));
    govde.appendChild(kap);

    setTimeout(function () {
      ciz(kap, {
        type: 'bar',
        data: {
          labels: konular.map(etiket),
          datasets: [
            { label: 'İlk denemede doğru', data: konular.map(function (k) { return k.ilkDenemede; }),
              backgroundColor: konular.map(function (k) { return saydam(r.hakimiyet, k); }) },
            { label: 'Sonradan çözüldü', data: konular.map(function (k) { return k.sonradanCozulen; }),
              backgroundColor: konular.map(function (k) { return saydam(r.sonradan, k); }) },
            { label: 'Henüz çözülmedi', data: konular.map(function (k) { return k.cozulemeyen; }),
              backgroundColor: konular.map(function (k) { return saydam(r.yanlis, k); }) }
          ]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          borderRadius: 3,
          barPercentage: 0.62,
          scales: {
            x: { stacked: true, beginAtZero: true, grid: eksenIzgara(true),
                 border: { display: false },
                 ticks: { precision: 0, padding: 6 } },
            y: { stacked: true, grid: eksenIzgara(false),
                 border: { display: false },
                 /* Uzun konu adları sol kenardan kırpılıyordu:
                    eksene pay bırakılıp punto bir tık küçültüldü. */
                 ticks: { padding: 10, autoSkip: false, font: { size: 11 } } }
          },
          layout: { padding: { left: 6, right: 8 } },
          plugins: {
            ucSayilari: { acik: true },
            tooltip: {
              callbacks: {
                label: function (b) { return b.dataset.label + ': ' + b.raw + ' soru'; }
              }
            }
          }
        },
        plugins: [sayiEklentisi]
      });
    }, 0);

    return govde;
  }

  /* ===========================================================
     2) Yanlışların konu dağılımı — halka
     -----------------------------------------------------------
     Dilimlerin hepsi "yanlış" olduğu için renk anlamı korunur:
     tek bir kızıl rampa kullanılır, konular açıklıkla ayrışır.
     Böylece "kızıl = yanlış" kodu bozulmaz.
     =========================================================== */
  function yanlisHalka(konular) {
    var r = renkler();
    var veri = konular.filter(function (k) { return k.yanlisDeneme > 0; })
                      .sort(function (a, b) { return b.yanlisDeneme - a.yanlisDeneme; });
    var govde = Y.el('div', {});

    if (!veri.length) {
      govde.appendChild(ozetMetni('Henüz yanlış işaretlemen yok — bu grafiği görebilmek için biraz daha soru çözmen gerekiyor.'));
      return govde;
    }

    var toplam = veri.reduce(function (t, k) { return t + k.yanlisDeneme; }, 0);
    var enUst = veri[0];

    govde.appendChild(ozetMetni(
      'Toplam ' + toplam + ' yanlış işaretlemenin ' +
      Math.round(100 * enUst.yanlisDeneme / toplam) + "%'i " + enUst.konu +
      ' konusunda. Buradan başlamak en çok kazandırır.'
    ));

    /* Kızıl rampa: en çok yanlış en koyu. Ayrım renkten değil
       açıklıktan ve etiketten geliyor. */
    var tonlar = veri.map(function (k, i) {
      var oran = veri.length === 1 ? 0 : i / (veri.length - 1);
      var acilma = Math.round(oran * 145);
      return 'rgb(' + (156 + acilma * 0.62) + ',' + (acilma * 0.72) + ',' + (acilma * 0.72) + ')';
    });

    govde.appendChild(gosterge(veri.map(function (k, i) {
      return { ad: etiket(k) + ' · ' + k.yanlisDeneme, renk: tonlar[i] };
    })));

    if (!chartVarMi()) {
      govde.appendChild(tablo(['Konu', 'Yanlış işaretleme'],
        veri.map(function (k) { return [etiket(k), k.yanlisDeneme]; })));
      return govde;
    }

    var kap = tuval(240);
    govde.appendChild(kap);

    setTimeout(function () {
      ciz(kap, {
        type: 'doughnut',
        data: {
          labels: veri.map(etiket),
          datasets: [{
            data: veri.map(function (k) { return k.yanlisDeneme; }),
            backgroundColor: tonlar,
            borderColor: r.yuzey,
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '58%',
          plugins: {
            ucSayilari: { acik: false },
            tooltip: {
              callbacks: {
                label: function (b) {
                  return b.label + ': ' + b.raw + ' yanlış (%' +
                         Math.round(100 * b.raw / toplam) + ')';
                }
              }
            }
          }
        }
      });
    }, 0);

    return govde;
  }

  /* ===========================================================
     3) Konu bazında ortalama çözüm süresi — bar
     -----------------------------------------------------------
     Süre doğruluk ölçmez; bu yüzden nötr gümüş. Kızıl/yeşil
     kullanmak "yavaş = yanlış" gibi yanlış bir anlam üretirdi.
     =========================================================== */
  function sureBarı(konular) {
    var r = renkler();
    var veri = konular.filter(function (k) { return k.ortalamaSure !== null; })
                      .sort(function (a, b) { return b.ortalamaSure - a.ortalamaSure; });
    var govde = Y.el('div', {});

    if (!veri.length) {
      govde.appendChild(ozetMetni('Süre ortalaması için henüz çözülmüş soru yok.'));
      return govde;
    }

    var enYavas = veri[0], enHizli = veri[veri.length - 1];
    govde.appendChild(ozetMetni(
      'En çok vakit alan konu ' + enYavas.konu + ' (' + enYavas.ortalamaSure + ' sn), ' +
      'en hızlı çözdüğün konu ' + enHizli.konu + ' (' + enHizli.ortalamaSure + ' sn). ' +
      'Süre tek başına iyi ya da kötü değildir — bir sonraki grafik hızı isabetle birlikte okur.'
    ));

    govde.appendChild(gosterge([
      { ad: 'Doğruyu bulana kadar geçen ortalama süre (sn)', renk: r.notr }
    ]));

    if (!chartVarMi()) {
      govde.appendChild(tablo(['Konu', 'Ortalama süre (sn)'],
        veri.map(function (k) { return [etiket(k), k.ortalamaSure]; })));
      return govde;
    }

    var kap = tuval(Math.max(180, veri.length * 44 + 50));
    govde.appendChild(kap);

    setTimeout(function () {
      ciz(kap, {
        type: 'bar',
        data: {
          labels: veri.map(etiket),
          datasets: [{
            label: 'Ortalama süre',
            data: veri.map(function (k) { return k.ortalamaSure; }),
            backgroundColor: veri.map(function (k) { return saydam(r.notr, k); })
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          borderRadius: 3,
          barPercentage: 0.55,
          scales: {
            x: { beginAtZero: true, grid: eksenIzgara(true), border: { display: false },
                 ticks: { padding: 6, callback: function (d) { return d + ' sn'; } } },
            y: { grid: eksenIzgara(false), border: { display: false },
                 ticks: { padding: 10, autoSkip: false, font: { size: 11 } } }
          },
          layout: { padding: { left: 6, right: 8 } },
          plugins: {
            ucSayilari: { acik: true },
            tooltip: {
              callbacks: { label: function (b) { return b.raw + ' saniye'; } }
            }
          }
        },
        plugins: [sayiEklentisi]
      });
    }, 0);

    return govde;
  }

  /* ----------------------------------------------------------- */
  Limit.grafik = {
    temaKur: temaKur,
    chartVarMi: chartVarMi,
    konuBari: konuBarı,
    yanlisHalka: yanlisHalka,
    sureBari: sureBarı
  };

})(window);
