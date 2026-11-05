import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const board=fs.readFileSync('src/app/edge-lab/board.jsx','utf8'),panel=fs.readFileSync('src/app/edge-lab/ncaaf-panel.jsx','utf8'),overview=fs.readFileSync('src/app/edge-lab/operations-overview.jsx','utf8');
test('Board ignores previous request completion',()=>assert.match(board,/if\(request.current!==controller\)return/));
test('Board releases request before abort in cleanup',()=>assert.match(board,/const previous=request.current;request.current=null;previous\?\.abort\(\)/));
test('Board old finally cannot clear a new request',()=>assert.match(board,/if\(request.current===controller\)\{request.current=null;setBusy\(false\);\}/));
test('NCAAF cleanup permits immediate remount',()=>assert.match(panel,/const previous=active.current;active.current=null;previous\?\.abort\(\)/));
test('NCAAF response and error ownership guarded',()=>{assert.match(panel,/if\(active.current===c\)\{setData/);assert.match(panel,/if\(active.current!==c\)return/);});
test('New diagnostic cleanup releases its own request',()=>assert.match(overview,/const previous=active.current;active.current=null;previous\?\.abort\(\)/));
