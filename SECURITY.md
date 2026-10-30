# Güvenlik / Security

## Türkçe

### Güvenlik açığı bildirme

Bu projede şu anda özel bir güvenlik bildirim kanalı (ör. GitHub özel güvenlik açığı bildirimi) **tanımlı değildir**. Açığı herkese açık bir issue olarak bildirmeden önce, istismar ayrıntılarını ve gerçek verileri paylaşmaktan kaçının: issue'da yalnızca etkilenen bölümü ve genel etkiyi yazın, ayrıntıyı sorumlunun yanıtından sonra paylaşın. Bu proje gönüllü olarak, garanti ve yanıt süresi taahhüdü olmadan sürdürülür.

### Tasarım ve sınırlar

- Uygulama hesap, analitik veya uzak API kullanmaz; kütüphaneler `vendor/` içindedir.
- `serve.py` varsayılan olarak `127.0.0.1` adresine bağlanır, yalnızca GET/HEAD kabul eder, yalnızca `index.html`, `vendor/` ve `assets/` dosyalarını sunar; nokta ile başlayan yolları ve dizin listelemeyi reddeder. `--host` ile ağa açarsanız bunun sorumluluğu size aittir; sunucuda kimlik doğrulama yoktur.
- Doküman ve görev Markdown'ı DOMPurify ile temizlenir; görsel, video, iframe, form ve stil etiketleri kaldırılır. Doküman bağlantıları yalnızca http/https olduğunda tıklanabilir gösterilir; Markdown içindeki zararlı bağlantılar temizlenir. Logo yalnızca PNG/JPEG/WebP olarak doğrulanır ve boyutu sınırlandırılır.
- **Bilinen sınırlar:** silme kalıcıdır (çöp kutusu yok); veriler şifrelenmez; uygulama yedek almaz; aynı klasörün eşzamanlı düzenlenmesi güvenli değildir; Drive/OneDrive gibi senkronize klasörler içeriği o hizmete yükler. Veri klasörünüze yazma izni verdiğiniz tarayıcı oturumu o klasörün dosyalarını okuyup yazabilir; yalnızca güvendiğiniz klasörü seçin.

## English

### Reporting a vulnerability

This project currently has **no dedicated private vulnerability reporting channel** (such as GitHub private vulnerability reporting). Before opening a public issue, avoid posting exploit details or real data: describe only the affected area and general impact, and share details after the maintainer responds. The project is maintained voluntarily, with no warranty or response-time commitment.

### Design and limits

- The app uses no accounts, analytics or remote APIs; libraries are bundled in `vendor/`.
- `serve.py` binds to `127.0.0.1` by default, accepts only GET/HEAD, serves only `index.html`, `vendor/` and `assets/`, and rejects dot-prefixed paths and directory listings. If you expose it to the network with `--host`, that is your responsibility; the server has no authentication.
- Task and document Markdown is sanitized with DOMPurify; images, video, iframes, forms and style tags are removed. Document URL fields are rendered as clickable links only for http/https addresses; unsafe Markdown links are sanitized. A logo is validated as PNG/JPEG/WebP and size-limited.
- **Known limits:** deletion is permanent (no trash); data is not encrypted; the app makes no backups; simultaneous editing of one folder is unsafe; sync folders such as Drive/OneDrive upload content to that service. The browser session you grant write access to can read and write that folder's files; select only folders you trust.
