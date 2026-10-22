import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {webcrypto} from 'node:crypto';import {readFile} from 'node:fs/promises';
test('local registration requires separate login; password is hashed; remembered login and logout work',async()=>{
 const storage=()=>{const map=new Map();return{getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)}};
 const localStorage=storage(),sessionStorage=storage(),context=vm.createContext({crypto:webcrypto,TextEncoder,localStorage,sessionStorage});vm.runInContext(await readFile('web/local-auth-core.js','utf8'),context);const auth=context.CSRLocalAuth;
 assert.equal(auth.current(),null);await auth.register('Студент','Student@example.test','example-pass-123');assert.equal(auth.current(),null);assert(!localStorage.getItem('csr-local-users-v1').includes('example-pass-123'));
 await assert.rejects(()=>auth.register('Другой','student@example.test','another-pass'),/уже зарегистрирована/);await assert.rejects(()=>auth.login('student@example.test','wrong',true),/Неверная/);
 const user=await auth.login('student@example.test','example-pass-123',true);assert.equal(user.name,'Студент');assert(localStorage.getItem('csr-local-session-v1'));assert.equal(sessionStorage.getItem('csr-local-session-v1'),null);auth.logout();assert.equal(auth.current(),null);
 await auth.login('student@example.test','example-pass-123',false);assert.equal(localStorage.getItem('csr-local-session-v1'),null);assert(sessionStorage.getItem('csr-local-session-v1'));auth.logout();assert.equal(auth.current(),null);
});

test('opening index as a local file presents registration on the same page',async()=>{
 const {JSDOM}=await import('jsdom');const dom=new JSDOM('<!doctype html><html><head></head><body><main id="editor">Editor</main></body></html>',{url:'file:///project/web/index.html',runScripts:'outside-only'});
 dom.window.CSRLocalAuth={current:()=>null};dom.window.eval(await readFile('web/local-gate.js','utf8'));await new Promise(r=>setTimeout(r,0));
 const d=dom.window.document;assert(d.documentElement.classList.contains('local-entry-locked'));assert(d.getElementById('localAccountForm'));assert(d.getElementById('localEmail'));assert(d.getElementById('localConfirm'));assert.equal(dom.window.location.pathname,'/project/web/index.html');dom.window.close();
});
