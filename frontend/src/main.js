import {mount} from 'svelte';
import '@wailsio/runtime';
import App from './App.svelte';
import {installOverlayScrollbars} from './lib/overlayScrollbars.mjs';
import {installDesktopBehavior} from './lib/desktopBehavior.mjs';
import './style.css';
mount(App,{target:document.getElementById('app')});
installOverlayScrollbars();

installDesktopBehavior();
