/* SLKB v1.5.18 - offline export: native XLSX + canvas certificate, no CDN/dependencies. */
(function(root){'use strict';
const enc=new TextEncoder();
const xml=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const filename=s=>String(s||'Tim').replace(/[^\p{L}\p{N}_-]+/gu,'-').slice(0,55);
const rank=state=>root.SLRules.rankTeams(state.teams,state.mode);
const date=id=>new Date(id||Date.now()).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'});
function col(n){let s='';for(let x=n+1;x;x=Math.floor((x-1)/26))s=String.fromCharCode(65+(x-1)%26)+s;return s;}
function sheet(rows){const widths=rows[0].map((_,c)=>Math.min(52,Math.max(13,...rows.slice(0,100).map(r=>String(r[c]??'').length+2))));
  const lines=rows.map((r,i)=>`<row r="${i+1}">${r.map((v,j)=>{const at=`${col(j)}${i+1}`;if(typeof v==='number'&&Number.isFinite(v))return `<c r="${at}"${i===0?' s="1"':''}><v>${v}</v></c>`;return `<c r="${at}" t="inlineStr"${i===0?' s="1"':''}><is><t>${xml(v)}</t></is></c>`}).join('')}</row>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${lines}</sheetData></worksheet>`;
}
let crcTable=null;function crc32(data){if(!crcTable){crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=(n&1)?(0xedb88320^(n>>>1)):(n>>>1);return n>>>0;});}let c=0xffffffff;for(const v of data)c=crcTable[(c^v)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
function u16(view,off,n){view.setUint16(off,n,true)}function u32(view,off,n){view.setUint32(off,n>>>0,true)}
function zip(files){const local=[],central=[];let pos=0;for(const [name,body] of files){const nameBytes=enc.encode(name),bytes=enc.encode(body),checksum=crc32(bytes);const lh=new Uint8Array(30+nameBytes.length+bytes.length),lv=new DataView(lh.buffer);u32(lv,0,0x04034b50);u16(lv,4,20);u16(lv,8,0);u32(lv,14,checksum);u32(lv,18,bytes.length);u32(lv,22,bytes.length);u16(lv,26,nameBytes.length);lh.set(nameBytes,30);lh.set(bytes,30+nameBytes.length);local.push(lh);
  const ch=new Uint8Array(46+nameBytes.length),cv=new DataView(ch.buffer);u32(cv,0,0x02014b50);u16(cv,4,20);u16(cv,6,20);u32(cv,16,checksum);u32(cv,20,bytes.length);u32(cv,24,bytes.length);u16(cv,28,nameBytes.length);u32(cv,42,pos);ch.set(nameBytes,46);central.push(ch);pos+=lh.length;
}const cSize=central.reduce((n,x)=>n+x.length,0),end=new Uint8Array(22),ev=new DataView(end.buffer);u32(ev,0,0x06054b50);u16(ev,8,files.length);u16(ev,10,files.length);u32(ev,12,cSize);u32(ev,16,pos);return new Blob([...local,...central,end],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});}
function download(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);}
function downloadXlsx(state,subject,startedAt){if(!state||!state.finished)throw Error('Pertandingan belum selesai');const ranking=rank(state),ended=state.endedAt||new Date().toISOString();
 const summary=[['Peringkat','Nama Tim/Kelompok','Skor Pengetahuan','Jawaban Benar','Jawaban Salah','Kotak Terakhir','Tertabrak','Akurasi (%)','Mode'],...ranking.map((t,i)=>[i+1,t.name,t.correct*10,t.correct,t.wrong,t.position,t.hits,Math.round((t.correct/(t.correct+t.wrong||1))*100),state.mode==='edukatif'?'Kompetisi Edukatif':'Klasik'])];
 const meta=[['Keterangan','Nilai'],['Game','Snake & Ladder Knowledge Battle — GID'],['Materi',subject],['Mulai',date(startedAt)],['Selesai',date(ended)],['Jumlah tim',state.teams.length],['Jumlah giliran',state.turn],['Aturan skor','Benar +10 poin, salah +0. Mode Edukatif: ular/tangga berlaku walaupun salah.'],['Juara 1',ranking[0]?.name||''],['Juara 2',ranking[1]?.name||''],['Juara 3',ranking[2]?.name||'']];
 const history=[['Giliran','Nama Tim','Hasil Dadu','Jawaban','Poin Giliran','Kotak Awal','Kotak Akhir','Mapel','Materi','ID Soal','Efek Papan','Waktu'],...state.history.map(h=>[h.turn,state.teams[h.team]?.name||'',h.roll,h.correct===null?'Dadu 6 ketiga hangus':h.correct?'Benar':'Salah',h.correct?10:0,h.from,h.to,h.subject||'',h.topic||'',h.questionId||'',(h.events||[]).map(e=>e.type).join(', '),h.answeredAt?date(h.answeredAt):''])];
 const files=[['[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${[1,2,3].map(i=>`<Override PartName="/xl/worksheets/sheet${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],['_rels/.rels',`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],['xl/workbook.xml',`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Peringkat Tim" sheetId="1" r:id="rId1"/><sheet name="Riwayat Giliran" sheetId="2" r:id="rId2"/><sheet name="Info Pertandingan" sheetId="3" r:id="rId3"/></sheets></workbook>`],['xl/_rels/workbook.xml.rels',`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${[1,2,3].map(i=>`<Relationship Id="rId${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i}.xml"/>`).join('')}<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],['xl/styles.xml',`<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Aptos"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF51258C"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs></styleSheet>`],['xl/worksheets/sheet1.xml',sheet(summary)],['xl/worksheets/sheet2.xml',sheet(history)],['xl/worksheets/sheet3.xml',sheet(meta)]];
 download(zip(files),'Rekap-SLKB-'+new Date().toISOString().slice(0,10)+'.xlsx');}
// SLKB v1.5.21 Premium Certificate Edition. Canvas-only, no external assets.
const CERT_W=3508, CERT_H=2480;
const PALETTES=[
 {light:'#FFE8A1',main:'#E4B65F',dark:'#956226',name:'EMAS'},
 {light:'#F4F7FF',main:'#BEC8DB',dark:'#67738A',name:'PERAK'},
 {light:'#F6D8BA',main:'#C9926E',dark:'#895137',name:'PERUNGGU'}
];
function line(ctx,x1,y1,x2,y2,color,width=3){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
function roundRect(ctx,x,y,w,h,r,fill,stroke,lw=1){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.lineWidth=lw;ctx.strokeStyle=stroke;ctx.stroke();}}
function fittedLines(ctx,text,maxWidth,maxLines=2){const words=String(text||'').trim().split(/\s+/);const rows=[];let current='';for(const word of words){const attempt=current?current+' '+word:word;if(ctx.measureText(attempt).width>maxWidth&&current){rows.push(current);current=word;}else current=attempt;}if(current)rows.push(current);return rows.slice(0,maxLines);}
function drawCenteredFit(ctx,text,x,y,maxWidth,initial,minSize,family='Georgia',weight='bold'){let fs=initial;while(fs>minSize){ctx.font=`${weight} ${fs}px ${family}`;if(ctx.measureText(text).width<=maxWidth)break;fs-=2;}ctx.fillText(text,x,y);return fs;}
function curvedCorner(ctx,x,y,sx,sy,accent){ctx.save();ctx.translate(x,y);ctx.scale(sx,sy);ctx.strokeStyle=accent;ctx.lineCap='round';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(0,185);ctx.lineTo(0,55);ctx.quadraticCurveTo(0,0,55,0);ctx.lineTo(185,0);ctx.stroke();for(let a=0;a<5;a++){const off=a*20;ctx.beginPath();ctx.moveTo(24+off,132-off*.40);ctx.quadraticCurveTo(55+off*.65,35+off*.30,140-off*.40,24+off);ctx.strokeStyle='rgba(245,216,147,.44)';ctx.lineWidth=2;ctx.stroke();}ctx.restore();}
function star(ctx,x,y,r,color,alpha=1,points=4){ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.beginPath();for(let i=0;i<points*2;i++){const a=-Math.PI/2+i*Math.PI/points;const radius=i%2?r*.23:r;const px=x+Math.cos(a)*radius,py=y+Math.sin(a)*radius;if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);}ctx.closePath();ctx.fill();ctx.restore();}
function laurels(ctx,cx,cy,size,accent){ctx.save();ctx.lineWidth=7;ctx.strokeStyle=accent;for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(cx+side*size*.62,cy+size*.52);ctx.bezierCurveTo(cx+side*size*1.04,cy+size*.08,cx+side*size*.97,cy-size*.44,cx+side*size*.55,cy-size*.75);ctx.stroke();for(let k=0;k<8;k++){const theta=-1.03+(k/7)*2.07;const ex=cx+side*(size*.84+Math.cos(theta)*size*.12);const ey=cy+Math.sin(theta)*size*.74;ctx.save();ctx.translate(ex,ey);ctx.rotate(side*(.35+theta*.3));ctx.beginPath();ctx.ellipse(0,0,size*.115,size*.043,0,0,Math.PI*2);ctx.fillStyle=accent;ctx.fill();ctx.restore();}}ctx.restore();}
function medal(ctx,cx,cy,rankIndex,accent){ctx.save();const cy2=cy;const rad=215;ctx.shadowColor='rgba(0,0,0,.35)';ctx.shadowBlur=34;ctx.shadowOffsetY=14;const ribbon=ctx.createLinearGradient(cx-160,cy2-255,cx+160,cy2+300);ribbon.addColorStop(0,'#845AB2');ribbon.addColorStop(.5,'#BCA2DF');ribbon.addColorStop(1,'#63428B');ctx.fillStyle=ribbon;ctx.beginPath();ctx.moveTo(cx-154,cy2-215);ctx.lineTo(cx-115,cy2+235);ctx.lineTo(cx-40,cy2+160);ctx.lineTo(cx+36,cy2+244);ctx.lineTo(cx+154,cy2-215);ctx.closePath();ctx.fill();ctx.shadowBlur=0;ctx.shadowOffsetY=0;
 laurels(ctx,cx,cy2,265,accent.main);
 const g=ctx.createRadialGradient(cx-70,cy2-90,15,cx,cy2,rad);g.addColorStop(0,accent.light);g.addColorStop(.52,accent.main);g.addColorStop(1,accent.dark);ctx.beginPath();ctx.arc(cx,cy2,rad,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();ctx.strokeStyle='#FAE8BC';ctx.lineWidth=14;ctx.stroke();ctx.beginPath();ctx.arc(cx,cy2,rad-28,0,Math.PI*2);ctx.strokeStyle='rgba(54,30,73,.45)';ctx.lineWidth=7;ctx.stroke();ctx.fillStyle='#3C245B';ctx.textAlign='center';ctx.font='bold 193px Georgia';ctx.fillText(String(rankIndex+1),cx,cy2+67);ctx.font='bold 31px Arial';ctx.letterSpacing='8px';ctx.fillText(accent.name,cx,cy2+127);ctx.letterSpacing='0px';ctx.restore();}
function metric(ctx,x,y,w,number,label,accent){roundRect(ctx,x,y,w,158,26,'rgba(240,225,255,.10)','rgba(246,213,148,.6)',3);ctx.textAlign='center';ctx.fillStyle='#E8DDF8';ctx.font='bold 29px Arial';ctx.fillText(label,x+w/2,y+48);ctx.fillStyle=accent.light;drawCenteredFit(ctx,String(number),x+w/2,y+121,w-28,64,36,'Arial');}
function trimLabel(value,n=140){const txt=String(value||'').replace(/\s+/g,' ').trim();return txt.length>n?txt.slice(0,n-1)+'…':txt;}
function drawCertificate(ctx,team,idx,subject,startedAt,state){
 const a=PALETTES[idx]||PALETTES[0],W=CERT_W,H=CERT_H,cx=W/2;
 // Background and soft atmospheric lighting.
 const bg=ctx.createLinearGradient(0,0,W,H);bg.addColorStop(0,'#160E2B');bg.addColorStop(.48,'#452276');bg.addColorStop(1,'#1D1233');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
 const halo=ctx.createRadialGradient(cx,1060,30,cx,1060,1450);halo.addColorStop(0,'rgba(169,109,230,.23)');halo.addColorStop(1,'rgba(100,51,145,0)');ctx.fillStyle=halo;ctx.fillRect(0,0,W,H);
 // Fine specks and subtle game motifs.
 for(let i=0;i<46;i++){const x=220+((i*739)%3040),y=170+((i*479)%2060);if(y>1040&&y<1670&&x>1050&&x<2460)continue;star(ctx,x,y,5+(i%4)*2,a.light,.17+(i%3)*.07,4);}
 // Double frame, classical corner ornaments.
 ctx.strokeStyle=a.main;ctx.lineWidth=18;ctx.strokeRect(62,62,W-124,H-124);ctx.strokeStyle='rgba(249,219,156,.84)';ctx.lineWidth=3;ctx.strokeRect(91,91,W-182,H-182);
 curvedCorner(ctx,125,125,1,1,a.light);curvedCorner(ctx,W-125,125,-1,1,a.light);curvedCorner(ctx,125,H-125,1,-1,a.light);curvedCorner(ctx,W-125,H-125,-1,-1,a.light);
 // Header.
 ctx.textAlign='center';ctx.fillStyle=a.light;ctx.font='bold 62px Georgia';ctx.fillText('GID  •  GURUUPGRADEID',cx,250);
 ctx.font='bold 28px Arial';ctx.letterSpacing='6px';ctx.fillStyle='#D8C4F0';ctx.fillText('EDUCATIONAL GAME ACHIEVEMENT AWARD',cx,305);ctx.letterSpacing='0px';
 line(ctx,1030,352,2478,352,a.main,3);star(ctx,cx,352,13,a.light,1,4);
 ctx.fillStyle='#FFF8EF';drawCenteredFit(ctx,'SERTIFIKAT PENGHARGAAN',cx,485,2950,129,92,'Georgia');
 ctx.fillStyle='#DED1F1';ctx.font='42px Arial';ctx.fillText('Diberikan kepada',cx,566);
 // Team name panel.
 const name=String(team.name||'Tim').trim();roundRect(ctx,525,619,2458,188,36,'rgba(125,78,174,.35)',a.main,5);
 ctx.fillStyle=a.light;ctx.textAlign='center';ctx.font='bold 103px Georgia';const rows=fittedLines(ctx,name,2270,2);if(rows.length===1){drawCenteredFit(ctx,rows[0],cx,743,2260,104,48,'Georgia');}else{ctx.font='bold 65px Georgia';const rs=fittedLines(ctx,name,2260,2);rs.forEach((r,i)=>drawCenteredFit(ctx,r,cx,704+i*70,2260,65,43,'Georgia'));}
 // Medal centered with celebratory micro-stars.
 medal(ctx,cx,1110,idx,a);
 for(const [dx,dy,size] of [[-395,-135,23],[350,-112,18],[-410,154,16],[404,167,25]])star(ctx,cx+dx,1110+dy,size,a.light,.9,4);
 ctx.fillStyle=a.light;ctx.font='bold 89px Georgia';ctx.textAlign='center';ctx.fillText('JUARA '+(idx+1),cx,1502);
 ctx.fillStyle='#FCF7FF';ctx.font='bold 46px Arial';ctx.fillText('Snake & Ladder Knowledge Battle',cx,1580);
 // Subject or multi-subject package descriptor, two-line limit.
 ctx.fillStyle='#E5D8F5';ctx.font='35px Arial';const subjectText=trimLabel(subject||'Paket pembelajaran',180);const subjectLines=fittedLines(ctx,subjectText,2710,2);subjectLines.forEach((v,i)=>ctx.fillText(v,cx,1648+i*43));
 // Statistical panels.
 const base=1755, mw=534, gap=36,total=3*mw+2*gap,off=(W-total)/2;
 metric(ctx,off,base,mw,team.correct*10,'POIN PENGETAHUAN',a);
 metric(ctx,off+mw+gap,base,mw,team.correct,'JAWABAN BENAR',a);
 metric(ctx,off+2*(mw+gap),base,mw,team.position,'KOTAK AKHIR',a);
 // Authentic issuer and event details. No fabricated teacher signature.
 line(ctx,490,1980,3018,1980,'rgba(250,215,142,.6)',3);
 ctx.fillStyle='#EEE3F5';ctx.textAlign='left';ctx.font='32px Arial';ctx.fillText('Tanggal: '+date(state.endedAt||startedAt),514,2057);
 ctx.font='27px Arial';ctx.fillStyle='#C6B7DD';ctx.fillText('Penghargaan tim berdasarkan hasil pertandingan yang tercatat.',514,2113);
 ctx.textAlign='right';ctx.fillStyle=a.light;ctx.font='bold 36px Georgia';ctx.fillText('GID • GuruUpgradeID',2990,2060);
 ctx.font='27px Arial';ctx.fillStyle='#DAC8ED';ctx.fillText('Diterbitkan otomatis oleh sistem',2990,2111);
 line(ctx,1200,2200,2308,2200,a.main,3);
 ctx.fillStyle=a.light;ctx.textAlign='center';ctx.font='32px Arial';ctx.fillText('Belajar • Berkarya • Berbagi • Menginspirasi',cx,2261);
 ctx.font='25px Arial';ctx.fillStyle='#B9A5D5';ctx.fillText('www.guruupgradeid.com',cx,2312);
}
async function downloadCertificate(state,idx,subject,startedAt){
 if(!state?.finished)throw Error('Selesaikan pertandingan dahulu.');
 if(!Number.isInteger(idx)||idx<0||idx>2)throw Error('Peringkat sertifikat tidak valid.');
 const t=rank(state)[idx];if(!t)throw Error('Peringkat tidak tersedia.');
 const canvas=document.createElement('canvas');canvas.width=CERT_W;canvas.height=CERT_H;
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('Perangkat tidak mendukung canvas.');
 drawCertificate(ctx,t,idx,subject,startedAt,state);
 const blob=await new Promise((resolve,reject)=>canvas.toBlob(v=>v?resolve(v):reject(new Error('Gagal menghasilkan PNG sertifikat.')),'image/png'));
 download(blob,`Sertifikat-Premium-Juara-${idx+1}-${filename(t.name)}.png`);
}
root.SLResultsExport={downloadXlsx,downloadCertificate};
})(window);
