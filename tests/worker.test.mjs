import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
const origin='https://example.test',auth={'oai-authenticated-user-id':'test-user','oai-authenticated-user-email':'student@example.test','oai-authenticated-user-full-name':encodeURIComponent('Студент'),'oai-authenticated-user-full-name-encoding':'percent-encoded-utf-8'};
test('guest sees landing, editor and editor script require identity',async()=>{
 const page=await worker.fetch(new Request(origin+'/'),{});
 assert.equal(page.status,200);assert.match(await page.text(),/Продолжить как гость/);
 const editor=await worker.fetch(new Request(origin+'/editor'),{});
 assert.equal(editor.status,302);assert.match(editor.headers.get('location'),/signin-with-chatgpt/);
 assert.equal((await worker.fetch(new Request(origin+'/app.js'),{})).status,401);
});
test('signed in editor includes escaped identity, import and instructions',async()=>{
 const r=await worker.fetch(new Request(origin+'/editor',{headers:auth}),{});
 assert.equal(r.status,200);const text=await r.text();
 assert.match(text,/globalThis.PolySession=/);assert.match(text,/Word-файл/);
 assert.match(text,/Скрыть верхний и нижний колонтитулы/);assert.equal(r.headers.get('cache-control'),'private, no-store');
});
test('session varies by request and no secret is returned',async()=>{
 const a=await (await worker.fetch(new Request(origin+'/api/session',{headers:auth}),{})).json();
 const b=await (await worker.fetch(new Request(origin+'/api/session'),{})).json();
 assert.equal(a.user.name,'Студент');assert.equal(b.user,null);assert.equal(a.aiReady,undefined);
});
test('removed AI route cannot receive document text',async()=>{
 const r=await worker.fetch(new Request(origin+'/api/assistant',{method:'POST',headers:{...auth,origin},body:'private document text'}),{});assert.equal(r.status,404);
});
test('identity text cannot break out of the bootstrap script',async()=>{
 const r=await worker.fetch(new Request(origin+'/editor',{headers:{...auth,'oai-authenticated-user-full-name':'</script><script>alert(1)</script>'}}),{});
 const text=await r.text();assert(!text.includes('</script><script>alert(1)'));assert(text.includes('\\u003c'));
});

test('guest routes expose preview only and cannot load editing/export modules',async()=>{
 for(const route of ['/login','/register','/guest'])assert.equal((await worker.fetch(new Request(origin+route),{})).status,200);
 const preview=await (await worker.fetch(new Request(origin+'/guest'),{})).text();assert.match(preview,/Гостевой режим/);assert.match(preview,/<fieldset disabled>/);assert(!preview.includes('src="/app.js"'));
 for(const route of ['/docx.js','/word-import.js','/app.js','/jszip.min.js']){assert.equal((await worker.fetch(new Request(origin+route),{})).status,401);const signed=await worker.fetch(new Request(origin+route,{headers:auth}),{});assert.equal(signed.status,200);assert.equal(signed.headers.get('cache-control'),'private, no-store')}
 assert.equal((await worker.fetch(new Request(origin+'/editor?authenticated=true',{headers:{cookie:'user=admin'}}),{})).status,302);
});
