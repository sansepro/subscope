import {mount} from 'svelte';
import '@wailsio/runtime';
import NodeWindow from './components/NodeWindow.svelte';
import {installOverlayScrollbars} from './lib/overlayScrollbars.mjs';
import {installDesktopBehavior} from './lib/desktopBehavior.mjs';
import './style.css';
mount(NodeWindow,{target:document.getElementById('app')});
installOverlayScrollbars();

installDesktopBehavior();
