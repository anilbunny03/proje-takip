const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const source = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n').split('// ── INIT')[0];
function app() {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, {innerHTML:'',value:'',textContent:'',classList:{add(){},remove(){},toggle(){}},appendChild(){}});
    return elements.get(id);
  };
  const ctx = vm.createContext({console, URL, crypto:require('node:crypto').webcrypto, setTimeout(){}, window:{}, document:{getElementById:element,querySelectorAll:()=>[],createElement:()=>({})}});
  vm.runInContext(source, ctx);
  return {ctx,element,run:code=>vm.runInContext(code,ctx)};
}
test('dynamic JavaScript arguments preserve apostrophes without executing injected code',()=>{
  const a=app(); a.ctx.payload="STK');globalThis.pwned=true;//";
  const encoded=a.run('jsArg(payload)');
  assert.equal(typeof encoded,'string');
  const decoded=encoded.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
  assert.equal(vm.runInContext(decoded,a.ctx),a.ctx.payload);
  assert.equal(a.ctx.pwned,undefined);
});
test('unsafe link schemes rejected, HTTP(S) retained',()=>{
  const a=app();
  for(const value of ['javascript:alert(1)','data:text/html,test','//example.com','file:///C:/secret','https:\\evil.test']) {
    a.ctx.value=value; assert.equal(a.run('safeUrl(value)'), '');
  }
  assert.equal(a.run("safeUrl('https://example.org/a?q=1')"),'https://example.org/a?q=1');
});
test('metadata color cannot inject style or markup',()=>{
  const a=app(); assert.equal(a.run("safeColor('#123abc')"),'#123abc');
  assert.equal(a.run("safeColor('red; background:url(https://example.org)')"),'#5b6fc7');
});
test('date formatters never emit raw markup or invalid data',()=>{
  const a=app(); a.ctx.value='<img src=x onerror=alert(1)>';
  assert.equal(a.run('formatDate(value)'),'—');
  assert.equal(a.run("formatDate('2026-10-30')"),'30/10/2026');
  assert.equal(a.run("formatDateTime('2026-10-30 14:35')"),'30/10/2026 14:35');
});
test('new empty projects appear immediately in sidebar',()=>{
  const a=app(); a.run("S.projects=[{id:'p1',name:\"Kadın Dayanışması\",color:'#123456'}]; renderSidebar()");
  assert.match(a.element('s-projects').innerHTML,/Kadın Dayanışması/);
});
test('file read errors propagate instead of appearing as missing files',async()=>{
  const a=app(); a.ctx.dh={getFileHandle:async()=>{throw Object.assign(new Error('permission denied'),{name:'NotAllowedError'});}};
  await assert.rejects(a.run("fsRead(dh,'projects.md')"),/permission denied/);
  a.ctx.dh={getFileHandle:async()=>{throw Object.assign(new Error('missing'),{name:'NotFoundError'});}};
  assert.equal(await a.run("fsRead(dh,'projects.md')"),null);
});
test('document search applies to title and body',()=>{
  const a=app(); a.run("S.filterDocList='Belgeler'; S.query='hedef'; S.documents=[{id:'d1',title:'Hedef belge',_listName:'Belgeler'},{id:'d2',title:'Başka belge',_listName:'Belgeler'}];renderDocListView()");
  assert.match(a.element('doc-list-root').innerHTML,/Hedef belge/);
  assert.doesNotMatch(a.element('doc-list-root').innerHTML,/Başka belge/);
});
test('user-visible status labels Turkish, persisted identifiers unchanged',()=>{
  const a=app(); assert.equal(a.run("statusInfo('waiting-for-approval').label"),'Onay Bekliyor');
  assert.equal(a.run("statusInfo('in-progress').id"),'in-progress');
  assert.doesNotMatch(html,/>Yeni Task<|>Todo<|>In Progress<|>Waiting for Approval<|>Blocked<|>Done</);
});
test('blocked means cannot progress, without changing persisted status ID',()=>{
  const a=app();assert.equal(a.run("statusInfo('blocked').label"),'İlerleyemiyor');
  assert.equal(a.run("statusInfo('blocked').id"),'blocked');
  assert.equal((html.match(/<option value="blocked">İlerleyemiyor<\/option>/g)||[]).length,2);
});
test('tab uses a local project-board favicon instead of the clock icon',()=>{
  assert.ok(/<link[^>]+rel="icon"[^>]+href="assets\/favicon\.svg\?v=1"/.test(html));
  assert.ok(!html.includes("link.rel='icon'"),'old runtime clock favicon must not override the static icon');
  const svg=fs.readFileSync(path.join(root,'assets/favicon.svg'),'utf8');
  assert.match(svg,/<svg[^>]+viewBox="0 0 64 64"/);
  assert.doesNotMatch(svg,/<script|(?:href|src)=["']https?:\/\/|<foreignObject/);
});

test('no network-loaded script or stylesheet dependencies',()=>{
  assert.doesNotMatch(html, /(?:src|href)=["']https:\/\/(?:cdn\.jsdelivr\.net|fonts\.googleapis\.com)/);
});
test('Markdown frontmatter accepts Windows CRLF and UTF-8 BOM',()=>{
  const a=app();a.ctx.jsyaml=require(path.join(root,'vendor/jsyaml.min.js'));
  a.ctx.input='\uFEFF---\r\ntitle: Windows belge\r\n---\r\nİçerik';
  assert.equal(a.run('parseMd(input).fm.title'),'Windows belge');
  assert.equal(a.run('parseMd(input).body'),'İçerik');
});
test('malformed YAML stops loading instead of hiding records',()=>{
  const a=app(); a.ctx.jsyaml=require(path.join(root,'vendor/jsyaml.min.js'));
  assert.throws(()=>a.run("parseMd('---\\nprojects: [broken\\n---\\n')"));
});
test('document cancel discards edits rather than mutating saved state',()=>{
  const a=app();
  a.run("S.detailDoc={id:'d1',title:'Belge',body:'Kayıtlı içerik',url:'https://example.org'};S.docEditMode=true;");
  a.element('doc-body-edit').value='Kaydedilmemiş';
  a.element('fde-url').value='';
  a.ctx.DOMPurify={sanitize:s=>s}; a.ctx.marked={parse:s=>s};
  a.run('cancelDocEdit()');
  assert.equal(a.run('S.detailDoc.body'),'Kayıtlı içerik');
  assert.equal(a.run('S.detailDoc.url'),'https://example.org');
});
test('creating reserved project folder rejected before filesystem writes',async()=>{
  const a=app(); let writes=0;
  a.ctx.dh={getDirectoryHandle:async()=>{writes++; throw new Error('should not write');}};
  a.run('S.dir=dh'); a.element('fp-name').value='documents';
  await a.run('saveProject()'); assert.equal(writes,0);
});
test('task and document workflows persist actual Markdown files and reload',async()=>{
  const scratch=process.env.TRACKER_TEST_TMP||require('node:os').tmpdir();
  fs.mkdirSync(scratch,{recursive:true});
  const directory=fs.mkdtempSync(path.join(scratch,'tracker-regression-'));
  class Directory {
    constructor(dir) { this.path=dir; this.name=path.basename(dir); this.kind='directory'; }
    async getDirectoryHandle(name,options={}) {
      const dir=path.join(this.path,name);
      if(options.create) fs.mkdirSync(dir,{recursive:true});
      if(!fs.existsSync(dir)) throw Object.assign(new Error('missing'),{name:'NotFoundError'});
      return new Directory(dir);
    }
    async getFileHandle(name,options={}) {
      const file=path.join(this.path,name);
      if(!options.create&&!fs.existsSync(file)) throw Object.assign(new Error('missing'),{name:'NotFoundError'});
      return {kind:'file',getFile:async()=>({text:async()=>fs.readFileSync(file,'utf8')}),createWritable:async()=>{let value;return{write:async text=>{value=text;},close:async()=>fs.writeFileSync(file,value,'utf8')};}};
    }
    async removeEntry(name) { fs.rmSync(path.join(this.path,name)); }
    async *[Symbol.asyncIterator]() {
      for(const entry of fs.readdirSync(this.path,{withFileTypes:true})) yield [entry.name,entry.isDirectory()?new Directory(path.join(this.path,entry.name)):await this.getFileHandle(entry.name)];
    }
  }
  const a=app(); a.ctx.jsyaml=require(path.join(root,'vendor/jsyaml.min.js')); a.ctx.directory=new Directory(directory);
  try {
    a.run("S.dir=directory; S.projects=[{id:'p1',name:'Dayanışma',color:'#123456',archived:true}]");
    await a.run('persistProjects()');
    await a.run("persistTask({id:'task-test',title:'İlk görev',project:'Dayanışma',status:'todo',body:'**Yerel** kayıt'})");
    await a.run("persistTask({id:'task-b',title:'Başka görev',project:'Dayanışma',status:'done',body:'Korunacak'})");
    a.run("S.docLists=[{id:'dl-test',name:'Belgeler',color:'#123456'}]"); await a.run('persistDocLists()');
    await a.run("persistDocument({id:'doc-test',title:'Yönerge',body:'# Açıklama',_listName:'Belgeler',validity_status:'gecerli',url:'https://example.org'})");
    await a.run('loadAll()');
    assert.equal(a.run('S.tasks.length'),2); assert.equal(a.run('S.documents.length'),1);
    assert.equal(a.run('S.projects[0].archived'),true);
    const filename=a.run('S.tasks[0]._file');
    a.run("S.tasks[0].title='Güncel başlık'; S.tasks[0].status='done'"); await a.run('persistTask(S.tasks[0])');
    assert.equal(a.run('S.tasks[0]._file'),filename);
    const disk=fs.readFileSync(path.join(directory,'Dayanışma',filename),'utf8'); assert.match(disk,/Güncel başlık/);
    a.run("S.documents[0].url=''; S.documents[0].validity_status=''"); await a.run('persistDocument(S.documents[0])');
    await a.run('loadAll()'); assert.equal(a.run("S.documents[0].url||''"),'');
    a.ctx.confirm=()=>true; await a.run("deleteTaskById('task-test')"); await a.run('loadAll()');
    assert.equal(a.run('S.tasks.length'),1); assert.equal(a.run('S.tasks[0].id'),'task-b');
    assert.equal(a.run('S.documents.length'),1);
  } finally { fs.rmSync(directory,{recursive:true,force:true}); }
});

test('archive flag survives loading project registry',async()=>{
  const file=path.join(root,'vendor/jsyaml.min.js');
  assert.ok(fs.existsSync(file),'local YAML dependency required');
  const a=app(); a.ctx.jsyaml=require(file);
  a.ctx.dh={getFileHandle:async()=>({getFile:async()=>({text:async()=>`---\nprojects:\n  - id: p1\n    name: Eski Proje\n    color: '#123456'\n    archived: true\n---\n`})})};
  a.run('S.dir=dh'); await a.run('loadProjects()');
  assert.equal(a.run('S.projects[0].archived'),true);
});
