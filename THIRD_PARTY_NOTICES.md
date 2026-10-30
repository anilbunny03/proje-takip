# Üçüncü Taraf Bildirimleri / Third-Party Notices

Bu uygulama, `vendor/` klasöründe aşağıdaki hazır (derlenmiş/küçültülmüş) kütüphaneleri dağıtır. Tam lisans metinleri ilgili `vendor/LICENSE-*.txt` dosyalarındadır. Uygulama bunları çalışma zamanında internetten indirmez.

This application ships the following prebuilt (bundled/minified) libraries in `vendor/`. Full license texts are in the matching `vendor/LICENSE-*.txt` files. The app does not download them from the internet at runtime.

| Kütüphane / Library | Sürüm / Version | Dosya / File | Lisans / License | Telif / Copyright | Lisans metni / License text |
|---|---|---|---|---|---|
| js-yaml | 4.1.0 | `vendor/jsyaml.min.js` | MIT | Vitaly Puzrin | [`vendor/LICENSE-js-yaml.txt`](vendor/LICENSE-js-yaml.txt) |
| marked | 9.1.6 | `vendor/marked.min.js` | MIT | MarkedJS; Christopher Jeffrey | [`vendor/LICENSE-marked.txt`](vendor/LICENSE-marked.txt) |
| DOMPurify | 3.2.6 | `vendor/purify.min.js` | Apache-2.0 veya / or MPL-2.0 | Cure53 and other contributors | [`vendor/LICENSE-dompurify.txt`](vendor/LICENSE-dompurify.txt) |
| docx | 7.8.2 | `vendor/docx.js` | MIT | Dolan | [`vendor/LICENSE-docx.txt`](vendor/LICENSE-docx.txt) |

Docx 7.8.2 derlemesi `https://cdn.jsdelivr.net/npm/docx@7.8.2/build/index.js` ile SHA-256 düzeyinde eşleştirildi. Ek paket atıfları [`vendor/index.js.LICENSE.txt`](vendor/index.js.LICENSE.txt) içinde korunur. / The docx bundle was verified byte-for-byte against that pinned upstream URL. Additional bundled notices are preserved in the linked file.

Ek bileşen lisansları / Additional component licenses:
- buffer: MIT, [`vendor/LICENSE-buffer.txt`](vendor/LICENSE-buffer.txt) (license text retrieved from `buffer@6.0.3/LICENSE`).
- ieee754: BSD-3-Clause, [`vendor/LICENSE-ieee754.txt`](vendor/LICENSE-ieee754.txt) (license text retrieved from `ieee754@1.2.1/LICENSE`).
- String.fromCodePoint polyfill: MIT, [`vendor/LICENSE-fromcodepoint.txt`](vendor/LICENSE-fromcodepoint.txt) (license text retrieved from `string.fromcodepoint@0.2.1/LICENSE-MIT.txt`).

Bu lisans metni kaynakları, derlemedeki bileşenlerin tam sürümlerine ilişkin bir iddia değildir. / These license-text source versions do not assert the exact component versions embedded in the bundle.

Proje kodunun kendisi [MIT](LICENSE) lisanslıdır. / The project's own code is under the [MIT](LICENSE) license.
