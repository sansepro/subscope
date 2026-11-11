import {defineConfig} from 'vite';
import {svelte} from '@sveltejs/vite-plugin-svelte';
import {resolve} from 'node:path';
export default defineConfig({
 plugins:[svelte()], base:'/',
 build:{outDir:'dist',emptyOutDir:true,target:'es2022',assetsInlineLimit:0,rollupOptions:{input:{main:resolve('index.html'),modal:resolve('modal.html')}}},
 server:{host:'127.0.0.1',port:9245,strictPort:true}
});
