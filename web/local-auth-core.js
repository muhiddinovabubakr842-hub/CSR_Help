// Browser-local accounts. This is not a server security boundary.
(()=>{
 const usersKey='csr-local-users-v1',sessionKey='csr-local-session-v1';
 const read=(storage,key,fallback)=>JSON.parse(storage.getItem(key)||JSON.stringify(fallback));
 const users=()=>read(localStorage,usersKey,[]);
 const email=value=>String(value).trim().toLowerCase();
 const hex=bytes=>Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
 async function hash(password,salt){if(!globalThis.crypto?.subtle)throw Error('Откройте страницу в Chrome или Edge: требуется поддержка Web Crypto.');const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);return hex(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:210000,hash:'SHA-256'},key,256)))}
 function current(){try{const session=read(sessionStorage,sessionKey,null)||read(localStorage,sessionKey,null);if(!session)return null;const u=users().find(u=>u.id===session.userId);return u?{userId:u.id,name:u.name,email:u.email,local:true}:null}catch{return null}}
 async function register(name,address,password){name=String(name).trim();address=email(address);if(!name||name.length>100)throw Error('Введите имя длиной до 100 символов.');if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))throw Error('Введите корректную почту.');if(password.length<8||password.length>128)throw Error('Пароль должен содержать от 8 до 128 символов.');if(users().some(u=>u.email===address))throw Error('Эта почта уже зарегистрирована. Перейдите ко входу.');const salt=hex(crypto.getRandomValues(new Uint8Array(24))),digest=await hash(password,salt),list=users();if(list.some(u=>u.email===address))throw Error('Эта почта уже зарегистрирована.');list.push({id:crypto.randomUUID(),name,email:address,salt,digest});localStorage.setItem(usersKey,JSON.stringify(list));}
 async function login(address,password,remember){const u=users().find(u=>u.email===email(address));if(!u||await hash(password,u.salt)!==u.digest)throw Error('Неверная почта или пароль.');logout();(remember?localStorage:sessionStorage).setItem(sessionKey,JSON.stringify({userId:u.id}));return current()}
 function logout(){localStorage.removeItem(sessionKey);sessionStorage.removeItem(sessionKey)}
 globalThis.CSRLocalAuth={current,register,login,logout};
})();
