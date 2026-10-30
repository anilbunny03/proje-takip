import http.client
import sys
import threading
import unittest
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "tools"))

VENDOR = ["jsyaml.min.js", "marked.min.js", "docx.js", "purify.min.js"]


class VendorTests(unittest.TestCase):
    def test_vendor_files_real(self):
        for name in VENDOR:
            p = ROOT / "vendor" / name
            self.assertTrue(p.is_file(), name)
            self.assertGreater(p.stat().st_size, 10000, name)
        heads = {
            "jsyaml.min.js": "js-yaml 4.1.0",
            "marked.min.js": "marked v9.1.6",
            "purify.min.js": "DOMPurify",
        }
        for name, marker in heads.items():
            txt = (ROOT / "vendor" / name).read_text(encoding="utf-8")[:300]
            self.assertIn(marker, txt)

    def test_licenses(self):
        for n in ["js-yaml", "marked", "docx", "dompurify"]:
            self.assertTrue((ROOT / "vendor" / f"LICENSE-{n}.txt").is_file(), n)


class ServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import serve
        cls.serve = serve
        cls.srv = serve.make_server("127.0.0.1", 0, ROOT)
        cls.port = cls.srv.server_address[1]
        cls.t = threading.Thread(target=cls.srv.serve_forever, daemon=True)
        cls.t.start()

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()
        cls.srv.server_close()

    def req(self, method, path):
        c = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        c.request(method, path)
        r = c.getresponse()
        body = r.read()
        c.close()
        return r.status, body, r

    def test_default_bind_localhost(self):
        self.assertEqual(self.srv.server_address[0], "127.0.0.1")
        self.assertEqual(self.serve.DEFAULT_HOST, "127.0.0.1")
        self.assertEqual(self.serve.DEFAULT_PORT, 8000)

    def test_index_and_query(self):
        for p in ["/", "/index.html", "/index.html?v=1", "/?x=2"]:
            s, b, _ = self.req("GET", p)
            self.assertEqual(s, 200, p)
            self.assertIn(b"<html", b.lower())

    def test_vendor_served(self):
        s, b, r = self.req("GET", "/vendor/marked.min.js?v=1")
        self.assertEqual(s, 200)
        self.assertIn("javascript", r.getheader("Content-Type"))

    def test_project_favicon_served_locally(self):
        s, b, response = self.req("GET", "/assets/favicon.svg?v=1")
        self.assertEqual(s, 200)
        self.assertIn("image/svg+xml", response.getheader("Content-Type"))
        self.assertEqual(b, (ROOT / "assets" / "favicon.svg").read_bytes())

    def test_head(self):
        s, b, r = self.req("HEAD", "/index.html")
        self.assertEqual(s, 200)
        self.assertEqual(b, b"")
        self.assertTrue(int(r.getheader("Content-Length")) > 0)

    def test_other_methods_rejected(self):
        for m in ["POST", "PUT", "DELETE", "OPTIONS", "PATCH"]:
            s, _, _ = self.req(m, "/index.html")
            self.assertEqual(s, 405, m)

    def test_denied(self):
        for p in [
            "/projects", "/projects/", "/projects/x.md", "/_backups/", "/AGENTS.md",
            "/CLAUDE.md", "/serve.py", "/start.bat", "/README.md", "/tests/test_distribution.py",
            "/agent/", "/.claude/x", "/.git/config", "/index.html.bak", "/vendor/", "/vendor",
            "/vendor/.hidden", "/vendor/nope.js", "/assets/", "/tools/package.py",
        ]:
            s, _, _ = self.req("GET", p)
            self.assertIn(s, (403, 404), p)

    def test_traversal(self):
        for p in [
            "/../AGENTS.md", "/vendor/../AGENTS.md", "/vendor/%2e%2e/AGENTS.md",
            "/vendor/..%2fAGENTS.md", "/%2e%2e/%2e%2e/windows/win.ini",
            "/vendor/..%5cAGENTS.md", "/vendor\\..\\AGENTS.md", "/index.html%00.js",
            "/vendor/marked.min.js/../../AGENTS.md",
        ]:
            s, b, _ = self.req("GET", p)
            self.assertIn(s, (400, 403, 404), p)
            self.assertNotIn(b"Global Project Tracker", b, p)

    def test_no_listing(self):
        s, b, _ = self.req("GET", "/vendor/")
        self.assertNotIn(b"Directory listing", b)

    def test_security_headers(self):
        _, _, r = self.req("GET", "/index.html")
        self.assertEqual(r.getheader("X-Content-Type-Options"), "nosniff")


class PackageTests(unittest.TestCase):
    def test_cli_with_legacy_windows_console_encoding(self):
        import os
        import subprocess
        env = os.environ.copy()
        env['PYTHONIOENCODING'] = 'cp1252'
        env['PYTHONUTF8'] = '0'
        result = subprocess.run([sys.executable,'-B',str(ROOT/'tools'/'package.py')],env=env,capture_output=True,timeout=30)
        self.assertEqual(result.returncode,0,result.stderr.decode('utf-8',errors='replace'))
        self.assertIn('Oluşturuldu:',result.stdout.decode('utf-8'))

    def test_collect_includes_bilingual_docs_and_licenses(self):
        import os
        import tempfile
        import package
        with tempfile.TemporaryDirectory(dir=os.environ.get('TRACKER_TEST_TMP')) as directory:
            fixture = Path(directory)
            required = ['index.html','start.bat','serve.py','README.md','README.en.md','LICENSE','THIRD_PARTY_NOTICES.md','CHANGELOG.md','SECURITY.md','CONTRIBUTING.md']
            for name in required:
                (fixture / name).write_text('Fixture for packaging test',encoding='utf-8')
            (fixture / 'docs').mkdir()
            (fixture / 'docs' / 'USER_GUIDE.tr.md').write_text('Türkçe test fixture',encoding='utf-8')
            (fixture / 'docs' / 'USER_GUIDE.en.md').write_text('English test fixture',encoding='utf-8')
            names = {name for _,name in package.collect(fixture)}
            self.assertTrue(set(required).issubset(names), str(set(required)-names))
            self.assertIn('docs/USER_GUIDE.tr.md',names)
            self.assertIn('docs/USER_GUIDE.en.md',names)

    def test_build(self):
        import package
        out = package.build(ROOT, ROOT / "dist" / "Proje-Takip-Uygulamasi.zip")
        self.assertTrue(out.is_file())
        names = zipfile.ZipFile(out).namelist()
        self.assertIn("index.html", names)
        self.assertIn("start.bat", names)
        self.assertIn("serve.py", names)
        self.assertIn("README.md", names)
        for v in VENDOR:
            self.assertIn("vendor/" + v, names)
        allowed = ("index.html", "start.bat", "serve.py", "README.md", "README.en.md", "LICENSE", "THIRD_PARTY_NOTICES.md", "CHANGELOG.md", "SECURITY.md", "CONTRIBUTING.md", "vendor/", "assets/", "docs/")
        for n in names:
            self.assertTrue(n.startswith(allowed), n)
            self.assertFalse(any(part.startswith(".") for part in n.split("/")), n)
        banned = ("projects", "_backups", "tests", "agent", "tools", "AGENTS", "CLAUDE", ".bak", "dist")
        for n in names:
            for b in banned:
                self.assertNotIn(b, n, n)


if __name__ == "__main__":
    unittest.main()
