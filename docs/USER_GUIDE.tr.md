# Kullanım Kılavuzu

[English](USER_GUIDE.en.md) · [README](../README.md)

Arayüz Türkçedir; bu kılavuzdaki kalın yazılar ekrandaki düğme adlarıdır.

## 1. Başlatma

1. Python 3 kurulu olmalı (3.10+ önerilir). Windows'ta `start.bat`; diğer sistemlerde `python3 serve.py --open`.
2. Chrome, Edge gibi masaüstü Chromium tarayıcıda `http://localhost:8000/` açılır.
3. Sunucuyu durdurmak için komut penceresini kapatın veya `Ctrl+C` yapın. Farklı port: `--port 8001`.

Sunucu varsayılan olarak yalnızca bu bilgisayardan erişilebilir. `--host` ile başka bir adres verirseniz uygulama ağa açılır ve uyarı yazar; bunu yalnızca ne yaptığınızı biliyorsanız yapın.

## 2. Veri klasörü seçme

İlk kullanımda **Klasör Seç** (veya üstteki **Klasör Aç**) önce kurum kurulumunu açar. Kurulumu tamamlayın; sonra **Klasör Aç** ile klasörü seçip tarayıcıya yazma izni verin. İlk kez için yeni, boş bir klasör oluşturun; uygulama klasörünün dışında tutmanız önerilir. Uygulama her açılışta klasörü yeniden seçmenizi ister (tarayıcı izni kalıcı varsayılmaz).

### Klasör yapısı

```
veri-klasörünüz/
  projects.md              proje listesi (ad, renk, açıklama, arşiv durumu)
  <Proje Adı>/             her projenin klasörü
    gorev-basligi-xxxxxxxx.md   her görev bir dosya
  documents/
    doc-lists.md           doküman listeleri
    <Liste Adı>/
      belge-basligi-xxxxxxxx.md  her doküman bir dosya
  .tracker/
    settings.md            kurum adı, logo, görünüm ayarları
```

Her dosya, üstte YAML bilgi bloğu (`---` arası) ve altında Markdown metninden oluşur. Dosyaları elle de düzenleyebilirsiniz; uygulamada **⟳** düğmesiyle yeniden yükleyin.

## 3. Kurum ve görünüm ayarları

- **Yeni (ayar dosyası olmayan) klasörde** ilk adım kurulum ekranıdır: kurum adı, isteğe bağlı logo, renk paleti (Mavi, Yeşil, Mor, Altın) ve görünüm (Açık, Koyu, Sistem).
- **Klasörümde ayar zaten var** düğmesi, daha önce ayar yapılmış bir klasörü seçmenize izin verir; ayarlar o klasörden okunur.
- Logo: PNG, JPEG veya WebP; en çok 2 MB. Uygulama logoyu küçültüp `.tracker/settings.md` içine gömer, bu yüzden ayarlar klasörle birlikte taşınır.
- Sonradan değiştirmek için üstteki **Kurum ve Görünüm** düğmesi.

## 4. Projeler ve görevler

- Sol menüde **Projeler** yanındaki **＋** ile proje ekleyin (ad, renk, açıklama). Projeler arşivlenebilir; arşivlenen projelerin görevleri ana görünümde gizlenir.
- **+ Yeni Görev**: başlık, proje, durum, atanan kişi, öncelik (Düşük, Orta, Yüksek, Kritik), başlangıç ve bitiş tarihi, Markdown açıklama.
- Durumlar: Yapılacak, Devam Ediyor, Onay Bekliyor, İlerleyemiyor, Tamamlandı. Kanban görünümünde kartları sürükleyerek durum değiştirebilirsiniz.
- Bitiş tarihi renklidir: geçmiş kırmızı, 5 gün veya daha yakın sarı, diğerleri yeşil; tamamlanan görevlerde gösterilmez.
- **Kanban** / **Liste** görünümü, **Ara…** kutusu (başlık, atanan, metin), proje ve atanan filtresi ile liste sıralaması.
- Bir göreve tıklayınca yan panel açılır: **Önizleme**, **Ham .md** ve **✏ Düzenle**.

## 5. Dokümanlar

- **Dokümanlar** yanındaki **＋** ile liste (klasör) oluşturun; liste adı geçerli bir klasör adı olmalı (nokta veya alt çizgiyle başlamaz, özel karakter içermez).
- **+ Yeni Doküman**: başlık, Markdown içerik, geçerlilik (Bulunmuyor, Geçerli, Süresiz Geçerli, Süresi Dolmuş), veriliş ve bitiş tarihi, isteğe bağlı http/https bağlantısı.
- Markdown temizlenir: görsel, video, iframe, form ve stil etiketleri kaldırılır; uzak medya yüklenmez.

## 6. DOCX dışa aktarma

Bir dokümanı açıp **⬇ DOCX** düğmesini kullanın; `.docx` dosyası tarayıcıda, `vendor/docx.js` ile üretilir ve indirilir. Hiçbir şey sunucuya veya internete gönderilmez.

## 7. Silme, yedek, senkronizasyon

- **Silme kalıcıdır.** Çöp kutusu yoktur; proje silmek içindeki tüm görevleri, liste silmek tüm dokümanları siler. Önemli klasörleri kendiniz yedekleyin.
- Veriler şifrelenmez. Hassas bilgiyi şifreli bir diske koyun.
- Aynı klasörü aynı anda iki kişi düzenlemeyin; son kaydeden diğerinin değişikliğinin üstüne yazabilir.
- Klasör Google Drive, OneDrive vb. ile senkronize ediliyorsa içerik o hizmete yüklenir.

## 8. Sorun giderme

- *Chrome, Edge veya uyumlu bir Chromium tarayıcı kullanın:* tarayıcı klasör erişimini desteklemiyor.
- *Python bulunamadı:* Python 3 kurun, kurulumda "Add python.exe to PATH" seçin.
- *Adrese bağlanılamadı:* port doluysa `--port 8001` kullanın.
- Klasör adı hatası: ad nokta/alt çizgiyle başlamamalı, `< > : " / \ | ? *` içermemeli, 120 karakteri aşmamalı.
