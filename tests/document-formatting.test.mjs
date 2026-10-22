import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const JSZip=createRequire(import.meta.url)('jszip');
import {JSDOM} from 'jsdom';
const context=vm.createContext({console,TextEncoder,TextDecoder,Buffer,Uint8Array,ArrayBuffer,Blob,atob,btoa,setTimeout,clearTimeout});
for(const file of ['i18n.js','docx.js','document-builder.js'])vm.runInContext(await readFile('web/'+file,'utf8'),context);
const P=context.PolyDocs,code='<main>\n  <h1>Пример</h1>\n</main>\n';
const image='data:image/png;base64,'+(await readFile('web/institute-logo.png')).toString('base64');
const section={title:'Главный заголовок',subtitle:'Подзаголовок работы',text:'Основной текст документа.',code,codeCaption:'Исходный HTML',image,imageWidth:600,imageHeight:400,imageCaption:'Результат',imageDisplayWidth:120,imageDisplayHeight:60,imageFit:'stretch',imageAlign:'right',parts:[]};
const state={...P.defaults,student:'Тестовый студент',includeReport:true,sections:[section]};
test('two headings, exactly one visual blank line and unmodified code',()=>{
 const blocks=P.reportBlocks(state);assert.equal(blocks.slice(0,3).map(x=>x.kind).join(','),'h1,h2,text');
 for(const b of blocks.filter(x=>['h1','h2','caption','code'].includes(x.kind)))assert.equal(b.gapAfter,true);
 assert.equal(blocks.find(x=>x.kind==='code').text,code);
 const dom=new JSDOM(P.reportHTML(state));assert.equal(dom.window.document.querySelector('pre').textContent,code);assert.equal(dom.window.document.querySelectorAll('[data-gap-after]').length,5);assert.equal(dom.window.document.querySelector('img').style.width,'120mm');assert.equal(dom.window.document.querySelector('img').style.height,'60mm');dom.window.close();
});
test('image dimensions stay inside A4, proportional mode preserves ratio and stretch is explicit',()=>{
 const p=P.imageGeometry({...section,imageFit:'proportional'});assert.equal(p.width,120);assert.equal(p.height,80);
 const wide=P.imageGeometry({...section,imageDisplayWidth:999,imageDisplayHeight:999});assert.equal(wide.width,164);assert.equal(wide.height,220);
 const tall=P.imageGeometry({...section,imageWidth:100,imageHeight:1000,imageFit:'proportional'});assert.equal(tall.height,220);assert.equal(tall.width,22);
 assert.equal(P.partsOf(section)[0].imageDisplayWidth,120);
 const blocks=P.reportBlocks({...state,sections:[{...section,subtitle:'',parts:[{text:'Другой блок'}]}]});const anchors=blocks.filter(x=>x.anchor).map(x=>x.anchor);assert.equal(new Set(anchors).size,anchors.length);
});
test('Word exports solid native picture outlines, dimensions and one-line paragraph spacing',async()=>{
 const doc=await P.makeDocument(state,image.split(',')[1],context.docx);const bytes=await context.docx.Packer.toBuffer(doc);const zip=await JSZip.loadAsync(bytes);const xml=await zip.file('word/document.xml').async('string');
 const dom=new JSDOM(xml,{contentType:'application/xml'}),d=dom.window.document;
 const paras=[...d.getElementsByTagName('w:p')];
 for(const name of ['1. Главный заголовок','1.1. Подзаголовок работы']){
  const p=paras.find(p=>p.textContent===name);assert(p,name);assert.equal(p.getElementsByTagName('w:spacing')[0].getAttribute('w:after'),'280');
 }
 const listing=paras.find(p=>p.textContent==='Листинг 1.1 – Исходный HTML');assert.equal(listing.getElementsByTagName('w:rFonts')[0].getAttribute('w:ascii'),'Palatino Linotype');assert(listing.getElementsByTagName('w:b').length);assert.equal(listing.getElementsByTagName('w:spacing')[0].getAttribute('w:line'),'240');assert.equal(listing.getElementsByTagName('w:spacing')[0].getAttribute('w:after'),'240');const figure=paras.find(p=>p.textContent==='Рисунок 1.1 – Результат');assert(figure.getElementsByTagName('w:b').length);assert.equal(figure.getElementsByTagName('w:sz')[0].getAttribute('w:val'),'24');assert.equal(figure.getElementsByTagName('w:color')[0].getAttribute('w:val'),'000000');
 assert.equal(figure.getElementsByTagName('w:rFonts')[0].getAttribute('w:ascii'),'Times New Roman');const fs=figure.getElementsByTagName('w:spacing')[0];assert.equal(fs.getAttribute('w:before'),'0');assert.equal(fs.getAttribute('w:after'),'240');assert.equal(fs.getAttribute('w:line'),'240');assert.equal(figure.getElementsByTagName('w:jc')[0].getAttribute('w:val'),'center');
 const imagePara=paras.filter(p=>p.getElementsByTagName('pic:pic').length).at(-1);assert.equal(imagePara.getElementsByTagName('w:spacing')[0].getAttribute('w:after'),'57');
 const picture=[...d.getElementsByTagName('pic:pic')].at(-1);assert.equal(picture.getElementsByTagName('a:ln')[0].getAttribute('w'),'12700');assert.equal(picture.getElementsByTagName('a:srgbClr')[0].getAttribute('val'),'333333');
 const ext=picture.getElementsByTagName('a:ext')[0];assert(Math.abs(Number(ext.getAttribute('cx'))-120*36000)<10);assert(Math.abs(Number(ext.getAttribute('cy'))-60*36000)<10);
 assert(xml.includes('&lt;main&gt;'));assert(xml.includes('  &lt;h1&gt;Пример&lt;/h1&gt;'));
 if(process.env.FORMATTING_QA_DOCX)await writeFile(process.env.FORMATTING_QA_DOCX,bytes);
 dom.window.close();
});

test('all major sections start a new page regardless of legacy toggle and body is single spaced',async()=>{
 const data={...state,reportLineSpacing:'2',sections:[section,{...section,title:'День 2',newPage:false}],conclusion:'Вывод',sources:'Источник'};
 const blocks=P.reportBlocks(data);assert.equal(blocks.filter(x=>x.kind==='break').length,3);assert.match(P.reportCSS(data),/--report-line:1;/);
 const bytes=await context.docx.Packer.toBuffer(await P.makeDocument(data,image.split(',')[1],context.docx));const z=await JSZip.loadAsync(bytes);const dom=new JSDOM(await z.file('word/document.xml').async('string'),{contentType:'application/xml'});const paras=[...dom.window.document.getElementsByTagName('w:p')];
 const next=paras.find(p=>p.textContent==='2. День 2');assert(next.getElementsByTagName('w:pageBreakBefore').length);const body=paras.find(p=>p.textContent===section.text);assert.equal(body.getElementsByTagName('w:spacing')[0].getAttribute('w:line'),'240');dom.window.close();
});
