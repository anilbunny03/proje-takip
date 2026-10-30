# Değişiklik Günlüğü / Changelog

## [1.0.1] — CI düzeltmesi / CI fix

- TR: GitHub Actions geçici klasör değişkeni adım düzeyine taşındı; Linux/Windows iş akışı doğrulama hatası düzeltildi. Uygulama davranışı değişmedi.
- EN: Moved the GitHub Actions temporary-directory variable to step scope, fixing Linux/Windows workflow validation. Application behavior is unchanged.

## [1.0.0] — İlk sürüm / Initial release

### Türkçe

- Yerel, hesapsız Proje Takip Uygulaması: veriler seçtiğiniz klasörde Markdown dosyaları olarak saklanır.
- Kanban ve liste görünümü; projeler, görevler, öncelik, tarihler, atanan kişiler, arama ve filtreler.
- Durumlar: Yapılacak, Devam Ediyor, Onay Bekliyor, İlerleyemiyor, Tamamlandı.
- Doküman listeleri, geçerlilik durumu, Markdown önizleme ve yerel `.docx` dışa aktarma.
- Kurum adı, isteğe bağlı logo, renk paleti ve açık/koyu görünüm (`.tracker/settings.md`).
- Yalnızca yerel adrese bağlanan, yalnızca uygulama dosyalarını sunan `serve.py` ve Windows için `start.bat`.
- Dağıtım zip'i oluşturan `tools/package.py`. Türkçe ve İngilizce belgeler. MIT lisansı.

### English

- Local, account-free Proje Takip Uygulaması (Local Project Tracker): data is stored as Markdown files in a folder you choose.
- Kanban and list views; projects, tasks, priority, dates, assignees, search and filters.
- Statuses: Yapılacak (To do), Devam Ediyor (In progress), Onay Bekliyor (Waiting for approval), İlerleyemiyor (Blocked), Tamamlandı (Done).
- Document lists, validity status, Markdown preview and local `.docx` export.
- Organization name, optional logo, color palette and light/dark appearance (`.tracker/settings.md`).
- `serve.py`, which binds to the local address only and serves only app files, and `start.bat` for Windows.
- `tools/package.py` builds the distribution zip. Turkish and English documentation. MIT license.
