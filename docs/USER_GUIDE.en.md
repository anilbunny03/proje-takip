# User Guide

[Türkçe](USER_GUIDE.tr.md) · [README](../README.en.md)

The interface is in Turkish. Bold text in this guide shows the on-screen button labels (English meaning in parentheses).

## 1. Starting

1. Python 3 must be installed (3.10+ recommended). On Windows run `start.bat`; elsewhere `python3 serve.py --open`.
2. In a desktop Chromium browser such as Chrome or Edge, `http://localhost:8000/` opens.
3. To stop the server, close the command window or press `Ctrl+C`. Different port: `--port 8001`.

By default the server is reachable only from this computer. If you pass another address with `--host`, the app is exposed to the network and prints a warning; do that only if you know what you are doing.

## 2. Choosing a data folder

On first use, **Klasör Seç** ("Select folder"; or **Klasör Aç** at the top) opens organization setup first. Complete setup, then click **Klasör Aç** to pick the folder and grant browser write access. For a first run create a new, empty folder, preferably outside the app folder. The app asks you to pick the folder again each time it starts (browser permission is not assumed to persist).

### Folder layout

```
your-data-folder/
  projects.md              project list (name, color, description, archived flag)
  <Project Name>/          one folder per project
    task-title-xxxxxxxx.md      one file per task
  documents/
    doc-lists.md           document lists
    <List Name>/
      doc-title-xxxxxxxx.md     one file per document
  .tracker/
    settings.md            organization name, logo, appearance
```

Each file has a YAML header (between `---` lines) followed by Markdown text. You may edit files by hand; reload in the app with the **⟳** button.

## 3. Organization and appearance settings

- **In a new folder (no settings file)** the first step is a setup screen: organization name, optional logo, color palette (Mavi/Blue, Yeşil/Green, Mor/Purple, Altın/Gold) and appearance (Açık/Light, Koyu/Dark, Sistem/System).
- **Klasörümde ayar zaten var** ("My folder already has settings") lets you pick a folder that was set up earlier; settings are read from it.
- Logo: PNG, JPEG or WebP, up to 2 MB. The app shrinks it and embeds it in `.tracker/settings.md`, so settings travel with the folder.
- To change later use **Kurum ve Görünüm** ("Organization and appearance") at the top.

## 4. Projects and tasks

- Add a project with **＋** next to **Projeler** (Projects) in the sidebar (name, color, description). Projects can be archived; tasks of archived projects are hidden from the main view.
- **+ Yeni Görev** (New task): title, project, status, assignee, priority (Düşük/Low, Orta/Medium, Yüksek/High, Kritik/Critical), start and end date, Markdown description.
- Statuses: Yapılacak (To do), Devam Ediyor (In progress), Onay Bekliyor (Waiting for approval), İlerleyemiyor (Blocked), Tamamlandı (Done). In Kanban view drag cards to change status.
- End dates are colored: past due red, within 5 days yellow, otherwise green; hidden for completed tasks.
- **Kanban** / **Liste** (List) views, the **Ara…** (Search) box (title, assignee, text), project and assignee filters, and list sorting.
- Clicking a task opens a side panel: **Önizleme** (Preview), **Ham .md** (Raw .md) and **✏ Düzenle** (Edit).

## 5. Documents

- Create a list (a folder) with **＋** next to **Dokümanlar** (Documents). The name must be a valid folder name (no leading dot or underscore, no special characters).
- **+ Yeni Doküman** (New document): title, Markdown content, validity (Bulunmuyor/None, Geçerli/Valid, Süresiz Geçerli/Valid indefinitely, Süresi Dolmuş/Expired), issue and expiry date, optional http/https link.
- Markdown is sanitized: images, video, iframes, forms and style tags are removed; remote media is not loaded.

## 6. DOCX export

Open a document and use the **⬇ DOCX** button; the `.docx` is generated in the browser with `vendor/docx.js` and downloaded. Nothing is sent to a server or the internet.

## 7. Deletion, backups, sync

- **Deletion is permanent.** There is no trash; deleting a project deletes all its tasks, deleting a list deletes all its documents. Back up important folders yourself.
- Data is not encrypted. Keep sensitive information on an encrypted disk.
- Do not edit the same folder at the same time as someone else; the last save may overwrite the other's changes.
- If the folder is synced by Google Drive, OneDrive etc., its content is uploaded to that service.

## 8. Troubleshooting

- *"Chrome, Edge veya uyumlu bir Chromium tarayıcı kullanın"* (use Chrome, Edge or a compatible Chromium browser): the browser lacks folder access support.
- *Python not found:* install Python 3 and tick "Add python.exe to PATH".
- *Cannot bind to address:* if the port is taken use `--port 8001`.
- Folder-name error: the name must not start with a dot/underscore, contain `< > : " / \ | ? *`, or exceed 120 characters.
