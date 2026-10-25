// A record of what went wrong in the browser, kept from before React loads,
// so a phone that paints the page but never hydrates can be diagnosed
// without a Web Inspector session. CLIENT_ERROR_SCRIPT, inline as the very
// first thing in the root layout's <head>, listens for uncaught errors,
// scripts that fail to load (capture phase: those don't bubble) and
// unhandled promise rejections, and keeps the last few in
// window.__landlyErrors and sessionStorage. HydrationMarker sets
// data-hydrated on <html> once React runs. With ?debug=1 in the URL a small
// bar at the bottom shows both; it never takes taps (pointer-events: none).
// Everyone else sees nothing.

export const CLIENT_ERRORS_KEY = 'landly_errors'
export const HYDRATED_ATTRIBUTE = 'data-hydrated'
export const DEBUG_BAR_ID = 'landly-debug-bar'
/** Errors kept (oldest dropped first). */
export const MAX_CLIENT_ERRORS = 20

/** Inline in <head>; plain ES5, no imports, never throws. */
export const CLIENT_ERROR_SCRIPT = `try{(function(w,d){
var L=w.__landlyErrors=w.__landlyErrors||[],debug=/[?&]debug=1(&|$)/.test(w.location.search),bar=null,checks=0;
function clip(v,n){return String(v==null?'':v).slice(0,n)}
function hydrated(){return d.documentElement.getAttribute('${HYDRATED_ATTRIBUTE}')==='true'}
function render(){if(!debug||!d.body)return;try{
if(!bar){bar=d.createElement('div');bar.id='${DEBUG_BAR_ID}';bar.setAttribute('aria-hidden','true');
bar.style.cssText='position:fixed;left:8px;right:8px;bottom:calc(8px + env(safe-area-inset-bottom));z-index:2147483647;pointer-events:none;font:600 11px/1.4 ui-monospace,Menlo,monospace;color:#fff;background:rgba(15,23,42,.88);border-radius:8px;padding:6px 10px;white-space:pre-wrap;word-break:break-word;max-height:40vh;overflow:hidden';
d.body.appendChild(bar)}
var last=L.length?L[L.length-1]:null;
bar.textContent='hydrated: '+(hydrated()?'yes':'no')+' \\u00b7 errors: '+L.length+(last?'\\n'+last.type+': '+last.message+(last.source?' @ '+last.source:''):'');
bar.style.background=hydrated()&&!L.length?'rgba(21,128,61,.88)':'rgba(185,28,28,.9)'}catch(e){}}
function push(type,message,source){
L.push({type:type,message:clip(message,500),source:clip(source,300),page:clip(w.location.pathname,200),at:new Date().toISOString()});
if(L.length>${MAX_CLIENT_ERRORS})L.splice(0,L.length-${MAX_CLIENT_ERRORS});
try{w.sessionStorage.setItem('${CLIENT_ERRORS_KEY}',JSON.stringify(L))}catch(e){}
render()}
w.__landlyReportError=push;
w.addEventListener('error',function(e){try{var t=e.target;
if(t&&t!==w&&(t.src||t.href)){push('resource','Failed to load '+(t.tagName||'').toLowerCase(),t.src||t.href);return}
push('error',e.message||(e.error&&e.error.message)||'Script error',e.filename?e.filename+':'+e.lineno+':'+e.colno:'')}catch(x){}},true);
w.addEventListener('unhandledrejection',function(e){try{var r=e.reason;push('unhandledrejection',r&&(r.stack||r.message)||r,'')}catch(x){}});
if(debug){var tick=function(){render();if(!hydrated()&&++checks<40)w.setTimeout(tick,500)};
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',tick);else tick()}
})(window,document)}catch(e){}`
