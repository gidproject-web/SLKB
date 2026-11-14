/* SLKB v1.6.0 — Lobby online; permainan online belum aktif. */
(() => {
  'use strict';
  const el=id=>document.getElementById(id);
  const savedKey='slkb_mp_lobby_session_v160';
  let session=null, channel=null, poll=null, busy=false, client=null;
  const setStatus=(message,isError=false)=>{const e=el('mpStatus');if(e){e.textContent=message;e.style.color=isError?'#b42338':'inherit';}};
  const loadSaved=()=>{try{return JSON.parse(sessionStorage.getItem(savedKey)||'null')}catch{return null}};
  const save=()=>{if(session)sessionStorage.setItem(savedKey,JSON.stringify(session));else sessionStorage.removeItem(savedKey)};
  const getClient=()=>{
    client=window.SLCloud?.client||null;
    if(!client)throw Error('Koneksi Cloud belum siap. Coba segarkan halaman; bila Bank Soal Cloud berfungsi, laporkan error Console F12.');
    return client;
  };
  // The existing Cloud module initializes asynchronously on page load.
  // Do not create a second Supabase client: wait for the shared one.
  async function waitForClient(){
    for(let i=0;i<40;i++){
      client=window.SLCloud?.client||null;
      if(client)return client;
      await new Promise(resolve=>setTimeout(resolve,250));
    }
    return getClient();
  }
  async function call(name,params){
    const readyClient=await waitForClient();
    const {data,error}=await readyClient.rpc('slkb_mp_'+name,params);
    if(error)throw Error(error.message||'Gagal menghubungi database multiplayer');
    return data;
  }
  function closeChannel(){if(channel&&client)client.removeChannel(channel).catch(()=>{});channel=null;if(poll)clearInterval(poll);poll=null;}
  async function refresh(){
    if(!session||busy)return;
    busy=true;
    try{
      const data=await call('snapshot',{p_code:session.code,p_token:session.token});
      renderLobby(data);setStatus(data.status==='ready'?'Lobby terkunci. Tahap permainan online akan hadir pada pembaruan berikutnya.':'Terhubung • Lobby diperbarui');
    }catch(error){setStatus(error.message,true)}finally{busy=false;}
  }
  async function notify(){
    try{if(channel)await channel.send({type:'broadcast',event:'updated',payload:{changed:true}})}catch{}
  }
  function openChannel(){
    closeChannel();if(!session)return;
    // Broadcast hanya sinyal refresh; data dan token tidak dikirim lewat kanal publik.
    try{channel=getClient().channel('slkb-lobby-'+session.code,{config:{broadcast:{self:false}}});
      channel.on('broadcast',{event:'updated'},()=>refresh()).subscribe();
    }catch{}
    poll=setInterval(refresh,5000);refresh();
  }
  const safeText=(s)=>String(s??'');
  function renderLobby(data){
    el('mpEntry').hidden=true;el('mpLobby').hidden=false;
    el('mpRoomCode').textContent=data.code;
    el('mpRoomState').textContent=data.status==='lobby'?'Menunggu tim':data.status==='ready'?'Siap untuk tahap permainan online':'Room ditutup';
    const list=el('mpPlayers');list.replaceChildren();
    (data.players||[]).forEach((p,i)=>{
      const row=document.createElement('div');row.className='mp-player';
      const text=document.createElement('span');text.textContent=`${i+1}. ${safeText(p.name)} — ${p.ready?'✅ Siap':'⏳ Belum siap'}`;row.append(text);
      if(data.is_host&&data.status==='lobby'){
        const kick=document.createElement('button');kick.className='back-btn';kick.type='button';kick.textContent='Keluarkan';
        kick.addEventListener('click',()=>action(async()=>{
          if(!confirm('Keluarkan '+p.name+' dari room?'))return;
          await call('remove',{p_code:session.code,p_token:session.token,p_player_id:p.id});await notify();await refresh();
        }));row.append(kick);
      }
      list.append(row);
    });
    el('mpLobbyCount').textContent=`${data.count}/4 tim`;
    el('mpHostActions').hidden=!data.is_host;
    el('mpGuestActions').hidden=!!data.is_host;
    el('mpReadyBtn').hidden=data.status!=='lobby';
    const me=(data.players||[]).find(p=>p.id===data.my_player_id);
    el('mpReadyBtn').textContent=me?.ready?'Batalkan Siap':'✅ Saya Siap';
    el('mpLockBtn').disabled=!(data.status==='lobby'&&data.count>=2&&(data.players||[]).every(p=>p.ready));
    el('mpLockBtn').hidden=data.status!=='lobby';
    el('mpLobbyNote').textContent=data.status==='ready'
       ?'✅ Semua peserta siap. Tahap v1.6.0 hanya Room & Lobby, belum memungkinkan melempar dadu bersama.'
       :'Guru dapat mengunci lobby setelah 2–4 tim siap. Tahap berikutnya akan menyinkronkan permainan.';
  }
  async function action(fn){try{setStatus('Memproses…');await fn()}catch(error){setStatus(error.message,true)}}
  function reset(){closeChannel();session=null;save();el('mpEntry').hidden=false;el('mpLobby').hidden=true;setStatus('Silakan buat atau gabung room.');}
  function wire(){
    session=loadSaved();if(session)openChannel();
    // Show readiness after the shared Cloud client has finished loading.
    void waitForClient().then(()=>{
      if(!session)setStatus('Supabase terhubung. Guru dapat membuat room setelah login; siswa dapat gabung dengan kode room.');
    }).catch(err=>{if(!session)setStatus(err.message,true)});
    const codeFromUrl=new URLSearchParams(location.search).get('room');
    if(codeFromUrl)el('mpJoinCode').value=codeFromUrl.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,9);
    el('mpCreateBtn').addEventListener('click',()=>action(async()=>{
      await waitForClient();
      if(!window.SLCloud?.user){
        await window.SLCloud?.refreshAuth?.();
      }
      if(!window.SLCloud?.user)throw Error('Akun guru belum terdeteksi. Buka Akun Guru & Cloud, login, lalu kembali ke Mabar Online.');
      const r=await call('create',{});
      session={code:r.code,token:r.token,host:true};save();openChannel();
    }));
    el('mpJoinForm').addEventListener('submit',e=>{e.preventDefault();action(async()=>{
      const r=await call('join',{p_code:el('mpJoinCode').value.trim().toUpperCase(),p_name:el('mpJoinName').value.trim()});
      session={code:r.code,token:r.token,host:false};save();openChannel();
    })});
    el('mpReadyBtn').addEventListener('click',()=>action(async()=>{
      const current=await call('snapshot',{p_code:session.code,p_token:session.token});
      const me=(current.players||[]).find(p=>p.id===current.my_player_id);
      await call('ready',{p_code:session.code,p_token:session.token,p_ready:!me?.ready});await notify();await refresh();
    }));
    el('mpLockBtn').addEventListener('click',()=>action(async()=>{
      await call('lock',{p_code:session.code,p_token:session.token});await notify();await refresh();
    }));
    el('mpLeaveBtn').addEventListener('click',()=>action(async()=>{
      if(!confirm(session.host?'Tutup room untuk semua peserta?':'Keluar dari room?'))return;
      await call('leave',{p_code:session.code,p_token:session.token});await notify();reset();
    }));
    el('mpCopyBtn').addEventListener('click',async()=>{
      const url=new URL(window.location.href);url.searchParams.set('room',session.code);url.hash='';
      try{await navigator.clipboard.writeText(url.toString());setStatus('Tautan undangan berhasil disalin.')}catch{prompt('Salin tautan room',url.toString())}
    });
    el('mpRefreshBtn').addEventListener('click',refresh);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
})();
