import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
test('help opens, dismisses, localizes and survives section header redraws',async()=>{
 const dom=new JSDOM(await readFile('web/index.html','utf8'),{runScripts:'outside-only'}),w=dom.window,d=w.document;
 w.eval(await readFile('web/section-help.js','utf8'));
 assert(d.querySelectorAll('.section-help-button').length>=9);assert.equal(d.querySelector('#paper .section-help-button'),null);
 let b=d.querySelector('[data-help-section="assignment"] button');b.click();assert.match(d.querySelector('[role="tooltip"]').textContent,/дисциплину/);b.click();assert.equal(d.querySelector('[role="tooltip"]'),null);
 b.dispatchEvent(new w.MouseEvent('mouseenter'));assert(d.querySelector('[role="tooltip"]'));b.dispatchEvent(new w.MouseEvent('mouseleave'));assert.equal(d.querySelector('[role="tooltip"]'),null);
 b.click();d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape'}));assert.equal(d.querySelector('[role="tooltip"]'),null);
 d.documentElement.lang='tg';b.click();assert.match(d.querySelector('[role="tooltip"]').textContent,/факултет/);d.body.click();assert.equal(d.querySelector('[role="tooltip"]'),null);
 d.getElementById('editorTitle').textContent='Редактор текста';await new Promise(r=>w.setTimeout(r,0));assert.equal(d.querySelectorAll('#editorTitle button').length,1);
 dom.window.close();
});
