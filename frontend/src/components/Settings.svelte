<script>
 import {Settings2,Save,RotateCcw,ShieldCheck,Sun,Moon,Check,Shuffle} from 'lucide-svelte';
 import {defaults,normalizeSettings,saveSettings,createHeaders,generateAutoHeaders} from '../lib/settings.mjs';
 import {native} from '../lib/native.mjs';
 import {themeList,accentList,applyTheme,saveAppearance} from '../lib/themes.mjs';
 export let settings;
 export let theme='dark';
 export let accent='violet';
 let probe='',probing=false,preview='';
 const fields=[['appVersion','X-App-Version'],['deviceLocale','X-Device-Locale'],['deviceOs','X-Device-Os'],['deviceModel','X-Device-Model'],['userAgent','User-Agent'],['hwid','X-Hwid']];
 const samples={appVersion:'AUTO / 19.19.19',deviceLocale:'AUTO / RU',deviceOs:'AUTO / Windows',deviceModel:'AUTO / Xui_x86_64',userAgent:'AUTO / Happ/19.19.19/Windows/...',hwid:'AUTO / yxxxxxxxxxxxx'};
 const persist=()=>{settings={...settings};saveSettings(settings)};
 function selectMode(value){theme=value;saveAppearance({mode:theme,accent});applyTheme(theme,accent)}
 function selectAccent(value){accent=value;saveAppearance({mode:theme,accent});applyTheme(theme,accent)}
 function reset(){settings=normalizeSettings(defaults);saveSettings(settings);probe='';preview=''}
 function generate(){preview=Object.entries(createHeaders(settings)).map(([k,v])=>`${k}: ${v}`).join('\n')}
 async function testHeaders(){probing=true;probe='';try{const sent=createHeaders(settings),res=await native.subscription('https://httpbingo.org/anything',sent);const value=JSON.parse(res.text),got=value.headers||{};probe=Object.entries(sent).map(([key,val])=>{const effective=Object.entries(got).find(([name])=>name.toLowerCase()===key.toLowerCase())?.[1];const text=Array.isArray(effective)?effective[0]:effective;return `${key} · ${String(text??'').trim()===val?'OK':'MISMATCH'}`}).join('\n')}catch(e){probe=e.message||String(e)}finally{probing=false}}
</script>
<div class="comparison-intro"><div class="section-eyebrow">ОФОРМЛЕНИЕ / ТЕМА</div></div>
<div class="appearance-modes" role="group" aria-label="Тема">
 {#each themeList as t (t.id)}<button class:active={theme===t.id} on:click={()=>selectMode(t.id)} aria-pressed={theme===t.id}>{#if t.id==='dark'}<Moon size={18}/>{:else}<Sun size={18}/>{/if}<span>{t.name}</span>{#if theme===t.id}<Check size={15} class="appearance-check"/>{/if}</button>{/each}
</div>
<div class="comparison-intro"><div class="section-eyebrow">АКЦЕНТ / {accentList.length}</div></div>
<div class="accent-grid" role="group" aria-label="Акцент">{#each accentList as a (a.id)}<button class:active={accent===a.id} on:click={()=>selectAccent(a.id)} aria-pressed={accent===a.id}><i style:background={theme==='light'?a.light:a.dark}></i><span>{a.name}</span>{#if accent===a.id}<Check size={13}/>{/if}</button>{/each}</div>
<div class="comparison-intro"><div class="section-eyebrow"><Settings2 size={14}/> HTTP / HEADERS</div><div class="micro">AUTO</div></div>
<div class="settings-grid">{#each fields as [key,label] (key)}<label><span>{label}</span><input bind:value={settings[key]} placeholder={samples[key]} on:input={persist} spellcheck="false" autocomplete="off"/></label>{/each}</div>
<label class="setting-extra"><span>EXTRA HEADERS</span><textarea bind:value={settings.extraHeaders} on:input={persist} spellcheck="false" placeholder="X-Custom-Header: value"></textarea></label>
<div class="settings-actions"><button class="primary" on:click={()=>saveSettings(settings)}><Save size={15}/> СОХРАНИТЬ</button><button class="soft" on:click={reset}><RotateCcw size={15}/> AUTO</button><button class="soft" on:click={generate}><Shuffle size={15}/> ПРИМЕР</button><button class="soft" disabled={probing} on:click={testHeaders}>{#if probing}<span class="spinner"></span>{:else}<ShieldCheck size={15}/>{/if} ТЕСТ HEADERS</button></div>
{#if preview}<pre class="headers-result">{preview}</pre>{/if}{#if probe}<pre class="headers-result">{probe}</pre>{/if}
