import React, { useEffect } from 'react';
import { RENPY, unmaskTagsInText, RENPH_TEST_RE, OLD_RENPH_TEST_RE, TRANSLATOR_CREDIT } from './prenpy';
import { normalizeLineEndings, restoreLineEndings, debounce, clamp, yieldToMain } from './utils';
import { Store } from './storage';
import { LANG_TO_CODE } from './languages';
import { 
  translateBatchGeminiFree,
  translateBatchDeepSeek, 
  translateBatchOpenAI, 
  translateBatchDeepL, 
  translateBatchLingva, 
  translateBatchGoogle 
} from './engines';
import { downloadZip } from './zip';
import { buildMatcher, findAllInText, replaceAll, nextIndex, sortMatches } from './findreplace';
import * as Common from './translation-common';
import { exportToTxt, importFromTxt } from './txt-io';

export default function App() {
  useEffect(() => {
    const PROJECT_ID = 'default';
    const MOBILE_MQ = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia('(max-width: 1020px), (pointer: coarse)') : null;
    const IS_MOBILE_UI = !!(MOBILE_MQ && MOBILE_MQ.matches);
    const PERF = {
      overscan: IS_MOBILE_UI ? 4 : 10,
      importYieldEvery: IS_MOBILE_UI ? 1 : 3,
      translatePaintEvery: IS_MOBILE_UI ? 2 : 1,
      tmRenderLimit: IS_MOBILE_UI ? 160 : 400,
      tmYieldEvery: IS_MOBILE_UI ? 40 : 120,
      sidebarRefreshMs: IS_MOBILE_UI ? 180 : 80,
      tableSearchMs: IS_MOBILE_UI ? 220 : 120,
      saveDebounceMs: IS_MOBILE_UI ? 1600 : 800,
    };

    const el = (id: string) => document.getElementById(id) as any;

    const ui = {
      btnOpenFiles: el('btnOpenFiles'),
      btnOpenFolder: el('btnOpenFolder'),
      btnExportFile: el('btnExportFile'),
      btnExportZip: el('btnExportZip'),
      btnExportTxt: el('btnExportTxt'),
      btnImportTxt: el('btnImportTxt'),
      btnFind: el('btnFind'),
      btnTM: el('btnTM'),
      btnClear: el('btnClear'),
      btnReload: el('btnReload'),

      fileInput: el('fileInput'),
      folderInput: el('folderInput'),
      txtImportInput: el('txtImportInput'),
      fileFilter: el('fileFilter'),
      fileList: el('fileList'),
      fileBadge: el('fileBadge'),

      statFiles: el('statFiles'),
      statStrings: el('statStrings'),
      statTranslated: el('statTranslated'),

      engineSelect: el('engineSelect'),
      targetLangSelect: el('targetLangSelect'),
      extractMode: el('extractMode'),
      batchSize: el('batchSize'),
      apiKey: el('inputDeepseekApiKey'),
      openaiApiKey: el('inputOpenaiApiKey'),
      deepseekKeyRow: el('deepseekKeyRow'),
      openaiKeyRow: el('openaiKeyRow'),
      geminiKeyRow: el('geminiKeyRow'),
      deeplKeyRow: el('deeplKeyRow'),
      saveKeysRow: el('saveKeysRow'),
      useTMFirst: el('useTMFirst'),
      autoSave: el('autoSave'),

      btnTranslateMissing: el('btnTranslateMissing'),
      btnTranslateSelected: el('btnTranslateSelected'),

      rowFilter: el('rowFilter'),
      tableSearch: el('tableSearch'),
      showWarnings: el('showWarnings'),

      gridBody: el('gridBody'),
      tableWrap: el('tableWrap'),
      selAll: el('selAll'),

      statusLeft: el('statusLeft'),
      statusRight: el('statusRight'),
      log: el('log'),

      modalBackdrop: el('modalBackdrop'),
      findModal: el('findModal'),
      tmModal: el('tmModal'),

      findQuery: el('findQuery'),
      replaceQuery: el('replaceQuery'),
      findCase: el('findCase'),
      findRegex: el('findRegex'),
      findScope: el('findScope'),
      findRows: el('findRows'),
      findStats: el('findStats'),
      btnFindPrev: el('btnFindPrev'),
      btnFindNext: el('btnFindNext'),
      btnReplaceOne: el('btnReplaceOne'),
      btnReplaceAll: el('btnReplaceAll'),

      tmSearch: el('tmSearch'),
      tmList: el('tmList'),
      btnTmExport: el('btnTmExport'),
      btnTmImport: el('btnTmImport'),
      btnTmClear: el('btnTmClear'),
      btnTmFillMissing: el('btnTmFillMissing'),
      tmImportInput: el('tmImportInput'),
      
      btnUndo: el('btnUndo'),
      btnRedo: el('btnRedo'),
      btnCopyOriginal: el('btnCopyOriginal'),
      btnCopyTranslate: el('btnCopyTranslate'),
    };

    const state = {
      project: { id: PROJECT_ID, name: 'Hikami_Project', createdAt: new Date().toISOString() },
      files: new Map<string, any>(),
      activePath: null as string | null,
      activeView: [] as number[],
      activeSelected: new Set<number>(),
      busy: false,
      find: {
        matches: [] as any[],
        cursor: -1,
      },
      virtual: {
        rowHeight: 80,
        overscan: PERF.overscan,
        lastStart: -1,
        lastEnd: -1,
        viewIndexByRow: new Map<number, number>(),
      },
      editor: {
        focusRow: -1,
        focusPrev: '',
        applying: false,
      },
      history: {
        undo: [] as any[],
        redo: [] as any[],
        limit: 5000,
      },
    };

    function log(msg: string, level = 'info') {
      const div = document.createElement('div');
      div.className = 'item ' + (level === 'warn' ? 'warn' : level === 'err' ? 'err' : '');
      div.textContent = String(msg);
      if (ui.log) {
        ui.log.prepend(div);
      }
    }

    function setStatus(left: string | null, right: string | null = '') {
      if (left != null && ui.statusLeft) ui.statusLeft.textContent = String(left);
      if (right != null && ui.statusRight) ui.statusRight.textContent = String(right);
    }

    function setBusy(v: boolean) {
      state.busy = !!v;
      const dis = state.busy || !state.activePath;
      if (ui.btnTranslateMissing) ui.btnTranslateMissing.disabled = dis;
      if (ui.btnTranslateSelected) ui.btnTranslateSelected.disabled = dis;
      if (ui.btnExportFile) ui.btnExportFile.disabled = !state.activePath || state.busy;
      if (ui.btnExportZip) ui.btnExportZip.disabled = state.files.size === 0 || state.busy;
      if (ui.btnExportTxt) ui.btnExportTxt.disabled = !state.activePath || state.busy;
      if (ui.btnImportTxt) ui.btnImportTxt.disabled = !state.activePath || state.busy;
      if (ui.btnTmFillMissing) ui.btnTmFillMissing.disabled = !state.activePath || state.busy;
    }

    function openModal(modalEl: HTMLElement) {
      if (ui.modalBackdrop) ui.modalBackdrop.hidden = false;
      modalEl.hidden = false;
      document.body.style.overflow = 'hidden';
    }

    function closeModal(modalEl: HTMLElement) {
      modalEl.hidden = true;
      if (ui.modalBackdrop) ui.modalBackdrop.hidden = true;
      document.body.style.overflow = '';
    }

    function parseCleanErrorMessage(errText: string): string {
      try {
        const jsonStart = errText.indexOf('{');
        if (jsonStart !== -1) {
          const rawJson = errText.slice(jsonStart);
          const obj = JSON.parse(rawJson);
          
          if (obj.error && typeof obj.error === 'object') {
            let msg = obj.error.message || '';
            if (obj.error.status) msg += `\nTrạng thái: ${obj.error.status}`;
            if (obj.error.code) msg += `\nMã lỗi: ${obj.error.code}`;
            if (msg) return msg;
          }
          if (obj.error && typeof obj.error === 'object') {
            const msg = obj.error.message;
            if (msg) return msg;
          }
          if (obj.message) return String(obj.message);
        }
      } catch (e) {
        // ignore parse error, fallback to raw message
      }
      
      return errText
        .replace(/^Gemini HTTP \d+:\s*/i, '')
        .replace(/^OpenAI HTTP \d+:\s*/i, '')
        .replace(/^DeepSeek HTTP \d+:\s*/i, '')
        .replace(/^DeepL HTTP \d+:\s*/i, '');
    }

    function showErrorModal(providerName: string, errorMessage: string) {
      if (ui.modalBackdrop) ui.modalBackdrop.hidden = false;
      const modal = el('errorModal');
      if (modal) {
        modal.hidden = false;
        const providerEl = el('errorProvider');
        const detailsEl = el('errorDetailsBox');
        if (providerEl) providerEl.textContent = providerName;
        if (detailsEl) detailsEl.textContent = parseCleanErrorMessage(errorMessage);
        document.body.style.overflow = 'hidden';
      }
    }

    function showConfirm(message: string): Promise<boolean> {
      return new Promise((resolve) => {
        const backdrop = document.createElement('div');
        backdrop.style.position = 'fixed';
        backdrop.style.inset = '0';
        backdrop.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        backdrop.style.zIndex = '1000';
        backdrop.style.display = 'flex';
        backdrop.style.alignItems = 'center';
        backdrop.style.justifyContent = 'center';
        backdrop.style.backdropFilter = 'blur(4px)';

        const panel = document.createElement('div');
        panel.style.background = 'rgba(15, 23, 34, 0.98)';
        panel.style.border = '1px solid rgba(124, 92, 255, 0.6)';
        panel.style.borderRadius = '16px';
        panel.style.padding = '24px';
        panel.style.width = 'min(420px, 90vw)';
        panel.style.boxShadow = '0 20px 50px rgba(0, 0, 0, 0.6)';
        panel.style.textAlign = 'center';

        const text = document.createElement('div');
        text.style.fontSize = '14px';
        text.style.color = '#e6edf3';
        text.style.marginBottom = '24px';
        text.style.lineHeight = '1.6';
        text.style.fontWeight = '500';
        text.textContent = message;

        const btnRow = document.createElement('div');
        btnRow.style.display = 'flex';
        btnRow.style.gap = '12px';
        btnRow.style.justifyContent = 'center';

        const btnCancel = document.createElement('button');
        btnCancel.className = 'btn';
        btnCancel.textContent = 'Hủy';
        btnCancel.style.padding = '10px 20px';
        btnCancel.style.fontSize = '13px';
        btnCancel.style.borderRadius = '10px';
        btnCancel.style.flex = '1';

        const btnOk = document.createElement('button');
        btnOk.className = 'btn btn-primary';
        btnOk.textContent = 'Xác nhận';
        btnOk.style.padding = '10px 20px';
        btnOk.style.fontSize = '13px';
        btnOk.style.borderRadius = '10px';
        btnOk.style.flex = '1';

        btnRow.appendChild(btnCancel);
        btnRow.appendChild(btnOk);
        panel.appendChild(text);
        panel.appendChild(btnRow);
        backdrop.appendChild(panel);
        document.body.appendChild(backdrop);

        const cleanup = (val: boolean) => {
          document.body.removeChild(backdrop);
          resolve(val);
        };

        btnCancel.addEventListener('click', () => cleanup(false));
        btnOk.addEventListener('click', () => cleanup(true));

        backdrop.addEventListener('click', (e) => {
          if (e.target === backdrop) cleanup(false);
        });
      });
    }

    function updateUndoRedoButtons() {
      if (ui.btnUndo) ui.btnUndo.disabled = state.history.undo.length === 0 || state.busy;
      if (ui.btnRedo) ui.btnRedo.disabled = state.history.redo.length === 0 || state.busy;
    }

    function pushHistory(action: any) {
      state.history.undo.push(action);
      if (state.history.undo.length > state.history.limit) state.history.undo.shift();
      state.history.redo.length = 0;
      updateUndoRedoButtons();
    }

    function getActiveFile() {
      const p = state.activePath;
      if (!p) return null;
      return state.files.get(p) || null;
    }

    function updateRowDOM(rowIndex: number) {
      const r = ui.gridBody?.querySelector(`tr[data-idx="${rowIndex}"]`);
      if (!r) return;

      const f = getActiveFile();
      if (!f) return;
      const d = f.dialogs[rowIndex];
      if (!d) return;

      const ta = r.querySelector('.trInput') as HTMLTextAreaElement | null;
      if (ta && ta.value !== String(d.translated ?? '')) ta.value = String(d.translated ?? '');

      r.classList.toggle('flagged', !!d.flagged);
      const flagBtn = r.querySelector('.flagBtn');
      if (flagBtn) flagBtn.classList.toggle('on', !!d.flagged);

      const status = r.querySelector('.metaStatus');
      if (status) {
        const warnOn = !!ui.showWarnings?.checked;
        const v = String(d.translated ?? '');
        const hasTr = v.trim().length > 0;
        const warn = warnOn && (RENPH_TEST_RE.test(v) || OLD_RENPH_TEST_RE.test(v));

        status.className = 'metaStatus ' + (warn ? 'meta-warn' : hasTr ? 'meta-ok' : 'meta-none');
        status.textContent = warn ? 'PLACEHOLDER' : (hasTr ? 'OK' : '—');
      }
    }

    function applyAction(action: any, dir: 'undo' | 'redo') {
      const f = state.files.get(action.path);
      if (!f) return;
      const d = f.dialogs[action.row];
      if (!d) return;

      const value = (dir === 'undo') ? action.prev : action.next;

      state.editor.applying = true;
      try {
        let countChanged = false;
        if (action.field === 'translated') {
          const prevValue = d.translated;
          d.translated = value;
          countChanged = adjustFileTranslatedCount(f, prevValue, value);
          const t = String(value ?? '').trim();
          if (t && ui.targetLangSelect) {
            Store.tmPut(ui.targetLangSelect.value, String(d.maskedQuote ?? ''), t, { source: dir }).catch(()=>{});
          }
        } else if (action.field === 'flagged') {
          d.flagged = !!value;
        }

        if (action.path === state.activePath) {
          updateRowDOM(action.row);
          refreshActiveGridAfterMutation();
        }

        if (countChanged) scheduleRefreshSidebar();
        else updateProjectStats();
        if (ui.autoSave?.checked) scheduleSaveActiveFile();
      } finally {
        state.editor.applying = false;
      }
    }

    function undo() {
      if (!state.history.undo.length || state.busy) return;
      const a = state.history.undo.pop();
      applyAction(a, 'undo');
      state.history.redo.push(a);
      updateUndoRedoButtons();
    }

    function redo() {
      if (!state.history.redo.length || state.busy) return;
      const a = state.history.redo.pop();
      applyAction(a, 'redo');
      state.history.undo.push(a);
      updateUndoRedoButtons();
    }

    async function copyToClipboard(text: string, count: number | null = null) {
      try {
        await navigator.clipboard.writeText(String(text ?? ''));
        const copiedCount = Number.isFinite(count) ? Math.max(0, count!) : 1;
        setStatus(`Copied ${copiedCount} string${copiedCount === 1 ? '' : 's'} to clipboard.`, '');
      } catch {
        log('Clipboard copy failed (browser blocked).', 'warn');
      }
    }

    function getRowsForCopyActions() {
      const f = getActiveFile();
      if (!f) return [];

      const selected = Array.from(state.activeSelected.values())
        .filter((row) => Number.isInteger(row) && row >= 0 && row < f.dialogs.length)
        .sort((a, b) => a - b);
      if (selected.length) return selected;

      if (Number.isInteger(state.editor.focusRow) && state.editor.focusRow >= 0 && state.editor.focusRow < f.dialogs.length) {
        return [state.editor.focusRow];
      }

      return [];
    }

    function buildClipboardText(rows: number[], picker: (row: number) => any) {
      return rows.map((row) => String(picker(row) ?? '')).join('\n');
    }

    async function copyOriginal() {
      const f = getActiveFile();
      if (!f) return;
      const rows = getRowsForCopyActions();
      if (!rows.length) return;
      await copyToClipboard(buildClipboardText(rows, (row) => f.dialogs[row]?.quote), rows.length);
    }

    async function copyTranslate() {
      const f = getActiveFile();
      if (!f) return;
      const rows = getRowsForCopyActions();
      if (!rows.length) return;
      await copyToClipboard(buildClipboardText(rows, (row) => f.dialogs[row]?.translated), rows.length);
    }

    function getMetaKind(d: any) {
      const tr = String(d.translated ?? '');
      if (!tr.trim()) return 'empty';
      if (RENPH_TEST_RE.test(tr) || OLD_RENPH_TEST_RE.test(tr)) return 'error';
      return 'ok';
    }

    function toggleFlag(rowIndex: number) {
      const f = getActiveFile();
      if (!f) return;
      const d = f.dialogs[rowIndex];
      if (!d) return;

      const prev = !!d.flagged;
      const next = !prev;
      d.flagged = next;

      pushHistory({
        path: state.activePath,
        row: rowIndex,
        field: 'flagged',
        prev,
        next,
        ts: Date.now(),
        source: 'flag',
      });

      updateRowDOM(rowIndex);
      if (ui.autoSave?.checked) scheduleSaveActiveFile();
    }

    document.addEventListener('click', (e: any) => {
      const t = e.target;
      if (t && t.matches && t.matches('[data-close]')) {
        const id = t.getAttribute('data-close');
        const m = el(id);
        if (m) closeModal(m);
      }
      if (t === ui.modalBackdrop) {
        if (ui.findModal && !ui.findModal.hidden) closeModal(ui.findModal);
        if (ui.tmModal && !ui.tmModal.hidden) closeModal(ui.tmModal);
        const errorModal = el('errorModal');
        if (errorModal && !errorModal.hidden) closeModal(errorModal);
      }
    });

    function hasTranslatedValue(value: any) {
      return String(value ?? '').trim().length > 0;
    }

    function getFileTotalCount(f: any) {
      return Number.isFinite(f?.totalCount) ? f.totalCount : Array.isArray(f?.dialogs) ? f.dialogs.length : 0;
    }

    function getFileTranslatedCount(f: any) {
      if (Number.isFinite(f?.translatedCount)) return f.translatedCount;
      if (!Array.isArray(f?.dialogs)) return 0;
      let count = 0;
      for (const d of f.dialogs) if (hasTranslatedValue(d?.translated)) count++;
      return count;
    }

    function syncFileMeta(f: any) {
      if (!f) return;
      f.totalCount = Array.isArray(f.dialogs) ? f.dialogs.length : 0;
      f.translatedCount = getFileTranslatedCount(f);
    }

    function adjustFileTranslatedCount(f: any, prevValue: any, nextValue: any) {
      if (!f) return false;
      const prevFilled = hasTranslatedValue(prevValue);
      const nextFilled = hasTranslatedValue(nextValue);
      if (prevFilled === nextFilled) return false;
      const base = Number.isFinite(f.translatedCount) ? f.translatedCount : getFileTranslatedCount(f);
      f.translatedCount = Math.max(0, base + (nextFilled ? 1 : -1));
      return true;
    }

    function shouldRebuildActiveView() {
      return (ui.rowFilter && ui.rowFilter.value !== 'all') || String(ui.tableSearch?.value || '').trim().length > 0;
    }

    function refreshActiveGridAfterMutation() {
      if (!state.activePath) return;
      if (shouldRebuildActiveView()) {
        renderTable({ resetSel: false, resetScroll: false });
        return;
      }
      renderVirtual(true);
      updateSelAllUI();
      setStatus(`${state.activePath} — ${state.activeView.length} rows shown`, null);
    }

    const scheduleRefreshSidebar = debounce(() => {
      updateProjectStats();
      renderFileList();
    }, PERF.sidebarRefreshMs);

    function updateProjectStats() {
      let strings = 0;
      let translated = 0;
      for (const f of state.files.values()) {
        strings += getFileTotalCount(f);
        translated += getFileTranslatedCount(f);
      }
      if (ui.statFiles) ui.statFiles.textContent = String(state.files.size);
      if (ui.statStrings) ui.statStrings.textContent = String(strings);
      if (ui.statTranslated) ui.statTranslated.textContent = String(translated);
      if (ui.fileBadge) ui.fileBadge.textContent = String(state.files.size);
    }

    function renderFileList() {
      const filter = String(ui.fileFilter?.value || '').toLowerCase().trim();
      if (!ui.fileList) return;
      ui.fileList.replaceChildren();
      const paths = Array.from(state.files.keys()).sort((a, b) => a.localeCompare(b));
      let shown = 0;

      for (const p of paths) {
        if (filter && !p.toLowerCase().includes(filter)) continue;
        const f = state.files.get(p);
        if (!f) continue;

        const item = document.createElement('div');
        item.className = 'file-item' + (p === state.activePath ? ' active' : '');
        item.tabIndex = 0;
        item.setAttribute('role', 'option');

        const pathEl = document.createElement('div');
        pathEl.className = 'file-path';
        pathEl.title = p;
        pathEl.textContent = p;

        const meta = document.createElement('div');
        meta.className = 'file-meta';

        const translated = getFileTranslatedCount(f);

        const pill1 = document.createElement('span');
        pill1.className = 'pill';
        pill1.textContent = `${f.dialogs.length} strings`;

        const pill2 = document.createElement('span');
        pill2.className = 'pill';
        pill2.textContent = `${translated} translated`;

        const actions = document.createElement('div');
        actions.className = 'file-actions';

        const btnDelete = document.createElement('button');
        btnDelete.type = 'button';
        btnDelete.className = 'file-delete';
        btnDelete.textContent = 'Delete';
        btnDelete.setAttribute('aria-label', `Delete ${p}`);
        btnDelete.title = `Delete ${p}`;
        btnDelete.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          await deleteFile(p);
        });

        actions.appendChild(btnDelete);
        meta.append(pill1, pill2, actions);
        item.append(pathEl, meta);

        item.addEventListener('click', () => openFile(p));
        item.addEventListener('keydown', async (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openFile(p);
            return;
          }
          if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            await deleteFile(p);
          }
        });

        ui.fileList.appendChild(item);
        shown++;
      }

      if (ui.fileBadge) ui.fileBadge.textContent = String(shown);
    }

    function computeActiveView() {
      const path = state.activePath;
      if (!path) { state.activeView = []; return; }
      const f = state.files.get(path);
      if (!f) { state.activeView = []; return; }

      const filterMode = ui.rowFilter?.value || 'all';
      const q = String(ui.tableSearch?.value || '').trim().toLowerCase();
      
      const out = [];
      for (let i = 0; i < f.dialogs.length; i++) {
        const d = f.dialogs[i];
        const hasTr = d.translated && String(d.translated).trim();
      
        if (filterMode === 'translated' && !hasTr) continue;
        if (filterMode === 'untranslated' && hasTr) continue;
        if (filterMode === 'flag' && !d.flagged) continue;
        if (filterMode === 'error' && getMetaKind(d) !== 'error') continue;
      
        if (q) {
          const src = String(d.quote || '').toLowerCase();
          const tr = String(d.translated || '').toLowerCase();
          if (!src.includes(q) && !tr.includes(q)) continue;
        }
      
        out.push(i);
      }

      state.activeView = out;
      state.virtual.viewIndexByRow = new Map();
      for (let pos = 0; pos < out.length; pos++) state.virtual.viewIndexByRow.set(out[pos], pos);
    }

    function resetSelection() {
      state.activeSelected.clear();
      if (ui.selAll) {
        ui.selAll.checked = false;
        ui.selAll.indeterminate = false;
      }
    }

    function makeSpacer(heightPx: number) {
      const tr = document.createElement('tr');
      tr.className = 'spacer';
      const td = document.createElement('td');
      td.colSpan = 5;
      td.style.height = `${Math.max(0, Math.floor(heightPx))}px`;
      tr.appendChild(td);
      return tr;
    }

    function renderRow(f: any, idx: number, warnOn: boolean) {
      const d = f.dialogs[idx];
      const trText = d.translated ?? '';
      const row = document.createElement('tr');
      row.className = 'tr-row' + (state.activeSelected.has(idx) ? ' selected' : '');
      row.classList.toggle('flagged', !!d.flagged);
      row.dataset.idx = String(idx);

      const tdSel = document.createElement('td');
      tdSel.className = 'col-sel';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'rowSel';
      cb.checked = state.activeSelected.has(idx);
      tdSel.appendChild(cb);

      const tdNo = document.createElement('td');
      tdNo.className = 'col-no';
      tdNo.textContent = String(idx + 1);

      const tdSrc = document.createElement('td');
      tdSrc.className = 'cell-src col-src';
      tdSrc.title = String(d.quote ?? '');
      const srcBox = document.createElement('div');
      srcBox.className = 'srcText';
      srcBox.textContent = String(d.quote ?? '');
      tdSrc.appendChild(srcBox);

      const tdTr = document.createElement('td');
      tdTr.className = 'cell-tr col-tr';
      const ta = document.createElement('textarea');
      ta.spellcheck = false;
      ta.className = 'trInput';
      ta.value = String(trText ?? '');
      tdTr.appendChild(ta);

      const tdMeta = document.createElement('td');
      tdMeta.className = 'col-meta';

      const flagBtn = document.createElement('button');
      flagBtn.type = 'button';
      flagBtn.className = 'flagBtn' + (d.flagged ? ' on' : '');
      flagBtn.title = d.flagged ? 'Unflag' : 'Flag';
      flagBtn.textContent = 'Flag';
      flagBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        toggleFlag(idx);

        if (ui.rowFilter?.value === 'flag') {
          renderTable({ resetSel: false, resetScroll: false });
        } else {
          updateRowDOM(idx);
        }
      });

      const status = document.createElement('span');
      status.className = 'metaStatus';

      function refreshMeta() {
        const v = String(d.translated ?? '');
        const hasTr = v.trim().length > 0;
        const warnOn2 = !!ui.showWarnings?.checked || ui.rowFilter?.value === 'error';
        const err = warnOn2 && (RENPH_TEST_RE.test(v) || OLD_RENPH_TEST_RE.test(v));

        row.classList.toggle('flagged', !!d.flagged);
        row.classList.toggle('is-error', !!err);

        flagBtn.classList.toggle('on', !!d.flagged);
        flagBtn.title = d.flagged ? 'Unflag' : 'Flag';

        status.className = 'metaStatus ' + (err ? 'meta-warn' : hasTr ? 'meta-ok' : 'meta-none');
        status.textContent = err ? 'ERROR' : (hasTr ? 'OK' : '—');
      }

      tdMeta.append(flagBtn, status);
      refreshMeta();
      
      {
        const v = String(trText ?? '');
        const hasTr2 = v.trim().length > 0;
        const warn2 = warnOn && (RENPH_TEST_RE.test(v) || OLD_RENPH_TEST_RE.test(v));
        status.className = 'metaStatus ' + (warn2 ? 'meta-warn' : hasTr2 ? 'meta-ok' : 'meta-none');
        status.textContent = warn2 ? 'PLACEHOLDER' : (hasTr2 ? 'OK' : '—');
      }

      row.append(tdSel, tdNo, tdSrc, tdTr, tdMeta);

      cb.addEventListener('change', () => {
        if (cb.checked) state.activeSelected.add(idx);
        else state.activeSelected.delete(idx);
        row.classList.toggle('selected', cb.checked);
        updateSelAllUI();
      });

      row.addEventListener('click', (ev: any) => {
        if (ev.target?.closest?.('textarea,input,button')) return;
        cb.checked = !cb.checked;
        cb.dispatchEvent(new Event('change'));
      });

      ta.addEventListener('focus', () => {
        row.classList.add('selected');
        state.editor.focusRow = idx;
        state.editor.focusPrev = ta.value; 
      });
      
      ta.addEventListener('blur', () => {
        row.classList.toggle('selected', cb.checked);
      
        if (state.editor.applying) return;
      
        const prev = String(state.editor.focusPrev ?? '');
        const next = String(ta.value ?? '');
        if (prev !== next) {
          pushHistory({
            path: state.activePath,
            row: idx,
            field: 'translated',
            prev,
            next,
            ts: Date.now(),
            source: 'manual',
          });
          state.editor.focusPrev = next;
          updateUndoRedoButtons();
        }
      });
      
      ta.addEventListener('input', () => {
        const v = ta.value;
        const prevValue = d.translated;
        d.translated = v;
        const countChanged = adjustFileTranslatedCount(f, prevValue, v);
      
        if (ui.autoSave?.checked) scheduleSaveActiveFile();
        scheduleUpdateTM(idx, v);
      
        const warnNow = !!ui.showWarnings?.checked && (RENPH_TEST_RE.test(v) || OLD_RENPH_TEST_RE.test(v));
        const hasNow = String(v).trim().length > 0;
        status.className = 'metaStatus ' + (warnNow ? 'meta-warn' : hasNow ? 'meta-ok' : 'meta-none');
        status.textContent = warnNow ? 'PLACEHOLDER' : (hasNow ? 'OK' : '—');
      
        if (countChanged) scheduleRefreshSidebar();
        else updateProjectStats();
        refreshMeta();
        updateSelAllUI();
      });

      return row;
    }

    function renderVirtual(force = false) {
      const path = state.activePath;
      if (!path) return;
      const f = state.files.get(path);
      if (!f) return;
      const total = state.activeView.length;

      const wrap = ui.tableWrap;
      if (!wrap) return;
      const rowH = state.virtual.rowHeight;
      const overscan = state.virtual.overscan;
      const top = wrap.scrollTop;
      const vh = wrap.clientHeight || 1;
      const start = Math.max(0, Math.floor(top / rowH) - overscan);
      const end = Math.min(total, Math.ceil((top + vh) / rowH) + overscan);

      if (!force && start === state.virtual.lastStart && end === state.virtual.lastEnd) return;
      state.virtual.lastStart = start;
      state.virtual.lastEnd = end;

      const warnOn = !!ui.showWarnings?.checked;
      const frag = document.createDocumentFragment();

      if (start > 0) frag.appendChild(makeSpacer(start * rowH));

      for (let pos = start; pos < end; pos++) {
        const idx = state.activeView[pos];
        frag.appendChild(renderRow(f, idx, warnOn));
      }

      if (end < total) frag.appendChild(makeSpacer((total - end) * rowH));

      if (ui.gridBody) ui.gridBody.replaceChildren(frag);
    }

    function renderTable({ resetSel = true, resetScroll = true } = {}) {
      if (resetSel) resetSelection();
      computeActiveView();
      state.virtual.lastStart = -1;
      state.virtual.lastEnd = -1;

      if (resetScroll && ui.tableWrap) ui.tableWrap.scrollTop = 0;
      renderVirtual(true);
      
      updateSelAllUI();

      const path = state.activePath;
      if (!path) return;
      const count = state.activeView.length;
      setStatus(`${path} — ${count} strings shown`, '');
    }

    let raf = 0;
    if (ui.tableWrap) {
      ui.tableWrap.addEventListener('scroll', () => {
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          renderVirtual(false);
        });
      }, { passive: true });
    }

    window.addEventListener('resize', debounce(() => {
      state.virtual.lastStart = -1;
      state.virtual.lastEnd = -1;
      renderVirtual(true);
      updateSelAllUI();
    }, 100));

    function updateSelAllUI() {
      const total = state.activeView.length;
      if (!ui.selAll) return;
      if (!total) {
        ui.selAll.checked = false;
        ui.selAll.indeterminate = false;
        return;
      }

      let inView = 0;
      for (const idx of state.activeView) if (state.activeSelected.has(idx)) inView++;

      ui.selAll.checked = inView === total;
      ui.selAll.indeterminate = inView > 0 && inView < total;
    }

    if (ui.selAll) {
      ui.selAll.addEventListener('change', () => {
        const v = ui.selAll.checked;

        if (!state.activePath) return;

        if (v) {
          for (const idx of state.activeView) state.activeSelected.add(idx);
        } else {
          for (const idx of state.activeView) state.activeSelected.delete(idx);
        }

        updateSelAllUI();
        renderVirtual(true);
      });
    }

    const scheduleSaveActiveFile = debounce(async () => {
      const p = state.activePath;
      if (!p) return;
      const f = state.files.get(p);
      if (!f) return;

      const payload = {
        path: f.path,
        source: f.source,
        eol: f.eol,
        dialogs: f.dialogs.map((d: any) => ({
          lineIndex: d.lineIndex,
          contentStart: d.contentStart,
          contentEnd: d.contentEnd,
          quoteChar: d.quoteChar,
          isTriple: d.isTriple,
          prefix: d.prefix,
          quote: d.quote,
          maskedQuote: d.maskedQuote,
          placeholderMap: d.placeholderMap,
          translated: d.translated ?? null,
          flagged: !!d.flagged,
        })),
      };

      try {
        await Store.saveFile(PROJECT_ID, f.path, payload);
        setStatus(`${f.path} — saved`, '');
      } catch (e: any) {
        log('Save failed: ' + (e?.message || e), 'err');
      }
    }, PERF.saveDebounceMs);

    const scheduleUpdateTM = debounce(async (idx: number, value: string) => {
      const p = state.activePath;
      if (!p) return;
      const f = state.files.get(p);
      if (!f) return;
      const d = f.dialogs[idx];
      const target = ui.targetLangSelect?.value || 'Vietnamese';
      const t = String(value ?? '').trim();
      if (!t) return;

      try {
        await Store.tmPut(target, String(d.maskedQuote ?? ''), t, { source: 'manual' });
      } catch (e) {}
    }, 600);

    async function hydrateFromStorage() {
      try {
        const { project, files } = await Store.loadProject(PROJECT_ID);
        if (project) state.project = project;
        for (const f of files) {
          const dialogs = Array.isArray(f.dialogs) ? f.dialogs : [];
          state.files.set(f.path, {
            path: f.path,
            source: String(f.source ?? ''),
            eol: f.eol || '\n',
            dialogs: dialogs.map(x => ({ ...x })),
          });
        }
        updateProjectStats();
        renderFileList();

        if (state.files.size > 0 && !state.activePath) {
          openFile(Array.from(state.files.keys()).sort()[0]);
        }

        enableActions();
        updateUndoRedoButtons();
        setStatus(state.files.size ? 'Project loaded from local storage.' : 'No project loaded.', '');
      } catch (e) {
        setStatus('Storage unavailable.', '');
      }
    }

    function applyExtractMode() {
      if (ui.extractMode) {
        RENPY.setMode(ui.extractMode.value);
      }
    }

    function splitNameExt(name: string) {
      const i = name.lastIndexOf('.');
      if (i <= 0) return { base: name, ext: '' };
      return { base: name.slice(0, i), ext: name.slice(i) };
    }

    function uniquePath(rawPath: string) {
      const norm = String(rawPath || '').replaceAll('\\', '/');
      if (!state.files.has(norm)) return norm;

      const parts = norm.split('/');
      const filename = parts.pop() || 'file.rpy';
      const { base, ext } = splitNameExt(filename);

      let k = 2;
      while (state.files.has([...parts, `${base} (${k})${ext}`].join('/'))) k++;
      return [...parts, `${base} (${k})${ext}`].join('/');
    }

    async function importFiles(fileList: FileList) {
      applyExtractMode();

      const items = Array.from(fileList || []).filter(f => f && (f.name || '').toLowerCase().endsWith('.rpy'));
      if (!items.length) return;

      setBusy(true);
      setStatus('Importing files…', '');
      let imported = 0;

      for (const file of items) {
        const text = await file.text();
        const { text: normalized, eol } = normalizeLineEndings(text);
        const dialogs = RENPY.extractDialogs(normalized);

        const rawPath = (file as any).webkitRelativePath || file.name;
        const path = uniquePath(rawPath);
        const fileState = { path, source: normalized, eol, dialogs };
        syncFileMeta(fileState);
        state.files.set(path, fileState);

        if (ui.autoSave?.checked) {
          await Store.saveFile(PROJECT_ID, path, {
            path,
            source: normalized,
            eol,
            dialogs: dialogs.map(d => ({
              lineIndex: d.lineIndex,
              contentStart: d.contentStart,
              contentEnd: d.contentEnd,
              quoteChar: d.quoteChar,
              isTriple: d.isTriple,
              prefix: d.prefix,
              quote: d.quote,
              maskedQuote: d.maskedQuote,
              placeholderMap: d.placeholderMap,
              translated: d.translated ?? null,
              flagged: !!d.flagged,
            })),
          });
        }

        imported++;

        if (imported % PERF.importYieldEvery === 0) await yieldToMain();
      }

      await Store.saveProject(state.project);

      updateProjectStats();
      renderFileList();

      if (!state.activePath && state.files.size) openFile(Array.from(state.files.keys()).sort()[0]);

      setStatus(`Imported ${imported} file(s).`, '');
      setBusy(false);
    }

    async function deleteFile(path: string, { askConfirm = true } = {}) {
      const normalizedPath = String(path || '');
      if (!normalizedPath || !state.files.has(normalizedPath)) return;
      if (askConfirm) {
        const confirmed = await showConfirm(`Xác nhận xóa tệp ${normalizedPath}?`);
        if (!confirmed) return;
      }

      const wasActive = normalizedPath === state.activePath;
      const remainingPaths = Array.from(state.files.keys())
        .filter((p) => p !== normalizedPath)
        .sort((a, b) => a.localeCompare(b));

      setBusy(true);
      try {
        state.activeSelected.clear();
        state.files.delete(normalizedPath);
        try {
          await Store.deleteFile(PROJECT_ID, normalizedPath);
          await Store.saveProject(state.project);
        } catch {}

        if (wasActive) {
          state.activePath = remainingPaths[0] || null;
        }

        updateProjectStats();
        renderFileList();

        if (state.activePath) {
          renderTable();
        } else {
          if (ui.gridBody) ui.gridBody.innerHTML = '';
          setStatus('No file open.', '');
        }

        enableActions();
        updateUndoRedoButtons();
        setStatus(`Deleted ${normalizedPath}.`, '');
      } finally {
        setBusy(false);
      }
    }

    function openFile(path: string) {
      state.activePath = path;
      renderFileList();
      renderTable();
      setBusy(false);
    }

    ui.btnOpenFiles?.addEventListener('click', () => ui.fileInput?.click());
    ui.btnOpenFolder?.addEventListener('click', () => ui.folderInput?.click());
    
    ui.fileInput?.addEventListener('change', async () => { 
      if (ui.fileInput.files) {
        await importFiles(ui.fileInput.files); 
        ui.fileInput.value = ''; 
      }
    });
    
    ui.folderInput?.addEventListener('change', async () => { 
      if (ui.folderInput.files) {
        await importFiles(ui.folderInput.files); 
        ui.folderInput.value = ''; 
      }
    });

    ui.fileFilter?.addEventListener('input', renderFileList);
    ui.btnReload?.addEventListener('click', async () => { await hydrateFromStorage(); });

    ui.rowFilter?.addEventListener('change', renderTable);
    ui.tableSearch?.addEventListener('input', debounce(renderTable, PERF.tableSearchMs));
    ui.showWarnings?.addEventListener('change', () => renderTable({ resetSel: false, resetScroll: false }));

    ui.extractMode?.addEventListener('change', () => {
      applyExtractMode();
      const p = state.activePath;
      if (p) {
        const f = state.files.get(p);
        if (f) {
          f.dialogs = RENPY.extractDialogs(f.source);
          syncFileMeta(f);
          if (ui.autoSave?.checked) scheduleSaveActiveFile();
          renderTable();
          scheduleRefreshSidebar();
          log('Re-extracted current file using mode: ' + RENPY.getMode());
        }
      }
    });

    if (ui.btnUndo) ui.btnUndo.addEventListener('click', undo);
    if (ui.btnRedo) ui.btnRedo.addEventListener('click', redo);
    if (ui.btnCopyOriginal) ui.btnCopyOriginal.addEventListener('click', copyOriginal);
    if (ui.btnCopyTranslate) ui.btnCopyTranslate.addEventListener('click', copyTranslate);

    document.addEventListener('keydown', (e) => {
      const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod) return;

      if (document.activeElement && document.activeElement.classList?.contains('trInput')) return;

      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
    });

    function syncEngineUI() {
      if (!ui.engineSelect) return;
      const engine = Common.normalizeEngineId(ui.engineSelect.value);
      const provider = Common.getEngineProvider(engine);

      // Hide all rows initially
      if (ui.geminiKeyRow) ui.geminiKeyRow.style.display = 'none';
      if (ui.deepseekKeyRow) ui.deepseekKeyRow.style.display = 'none';
      if (ui.openaiKeyRow) ui.openaiKeyRow.style.display = 'none';
      if (ui.deeplKeyRow) ui.deeplKeyRow.style.display = 'none';
      if (ui.saveKeysRow) ui.saveKeysRow.style.display = 'none';

      let needsKey = false;
      if (provider === 'gemini' && !Common.isGeminiFreeEngine(engine)) {
        if (ui.geminiKeyRow) ui.geminiKeyRow.style.display = '';
        needsKey = true;
      } else if (provider === 'deepseek') {
        if (ui.deepseekKeyRow) ui.deepseekKeyRow.style.display = '';
        needsKey = true;
      } else if (provider === 'openai') {
        if (ui.openaiKeyRow) ui.openaiKeyRow.style.display = '';
        needsKey = true;
      } else if (provider === 'deepl') {
        if (ui.deeplKeyRow) ui.deeplKeyRow.style.display = '';
        needsKey = true;
      }

      if (needsKey && ui.saveKeysRow) {
        ui.saveKeysRow.style.display = '';
      }
    }

    function loadSavedApiKeys() {
      const gemini = localStorage.getItem('vntrans_gemini_api_key') || '';
      const deepseek = localStorage.getItem('vntrans_deepseek_api_key') || '';
      const openai = localStorage.getItem('vntrans_openai_api_key') || '';
      const deepl = localStorage.getItem('vntrans_deepl_api_key') || '';

      const inputGemini = el('inputGeminiApiKey');
      const inputDeepseek = el('inputDeepseekApiKey');
      const inputOpenai = el('inputOpenaiApiKey');
      const inputDeepl = el('inputDeeplApiKey');

      if (inputGemini) inputGemini.value = gemini;
      if (inputDeepseek) inputDeepseek.value = deepseek;
      if (inputOpenai) inputOpenai.value = openai;
      if (inputDeepl) inputDeepl.value = deepl;
    }

    function saveApiKeys() {
      const gemini = String(el('inputGeminiApiKey')?.value || '').trim();
      const deepseek = String(el('inputDeepseekApiKey')?.value || '').trim();
      const openai = String(el('inputOpenaiApiKey')?.value || '').trim();
      const deepl = String(el('inputDeeplApiKey')?.value || '').trim();

      localStorage.setItem('vntrans_gemini_api_key', gemini);
      localStorage.setItem('vntrans_deepseek_api_key', deepseek);
      localStorage.setItem('vntrans_openai_api_key', openai);
      localStorage.setItem('vntrans_deepl_api_key', deepl);

      log('Đã lưu tất cả API Key của bạn thành công vào trình duyệt!', 'info');
      setStatus('Thành công: Đã lưu API Key!', '');
    }

    // Load keys as early as possible
    loadSavedApiKeys();

    const saveBtn = el('btnSaveApiKeys');
    if (saveBtn) {
      saveBtn.addEventListener('click', saveApiKeys);
    }

    if (ui.engineSelect) {
      Common.fillEngineSelect(ui.engineSelect, ui.engineSelect.value);
      ui.engineSelect.value = Common.normalizeEngineId(ui.engineSelect.value);
      ui.engineSelect.addEventListener('change', syncEngineUI);
      syncEngineUI();
    }
    if (ui.targetLangSelect) {
      Common.fillTargetSelect(ui.targetLangSelect, ui.targetLangSelect.value || 'Vietnamese', 'label');
    }

    async function fillMissingFromTM(path: string) {
      const f = state.files.get(path);
      if (!f) return 0;
      const target = ui.targetLangSelect?.value || 'Vietnamese';
      const pending: [number, string][] = [];
      for (let i = 0; i < f.dialogs.length; i++) {
        const d = f.dialogs[i];
        if (hasTranslatedValue(d.translated)) continue;
        pending.push([i, String(d.maskedQuote ?? '')]);
      }
      if (!pending.length) return 0;

      const hits = await Store.tmGetMany(target, pending.map(([, key]) => key));
      let filled = 0;
      for (let i = 0; i < pending.length; i++) {
        const [rowIndex, key] = pending[i];
        const hit = hits.get(key);
        if (hit && hasTranslatedValue(hit.translation)) {
          const d = f.dialogs[rowIndex];
          const prevValue = d.translated;
          d.translated = String(hit.translation);
          adjustFileTranslatedCount(f, prevValue, d.translated);
          filled++;
        }
        if ((i + 1) % PERF.tmYieldEvery === 0) await yieldToMain();
      }
      return filled;
    }

    async function translateDialogs(path: string, indices: number[]) {
      const f = state.files.get(path);
      if (!f) return;

      const targetLang = ui.targetLangSelect?.value || 'Vietnamese';
      const engine = Common.normalizeEngineId(ui.engineSelect?.value || 'gemini-free');
      
      const geminiApiKey = String((document.getElementById('inputGeminiApiKey') as HTMLInputElement)?.value || '').trim();
      const deepseekApiKey = String((document.getElementById('inputDeepseekApiKey') as HTMLInputElement)?.value || '').trim();
      const openaiApiKey = String((document.getElementById('inputOpenaiApiKey') as HTMLInputElement)?.value || '').trim();
      const deeplApiKey = String((document.getElementById('inputDeeplApiKey') as HTMLInputElement)?.value || '').trim();
      
      const provider = Common.getEngineProvider(engine);
      const batch = clamp(Number(ui.batchSize?.value || 30), 1, 80);

      // Input constraints
      if (engine === 'deepseek' && !deepseekApiKey) throw new Error('Missing DeepSeek API key.');
      if (engine === 'deepl' && !deeplApiKey) throw new Error('Missing DeepL API key.');
      if (provider === 'gemini' && !Common.isGeminiFreeEngine(engine) && !geminiApiKey) throw new Error('Missing Google AI Studio / Gemini API key.');
      if (provider === 'openai' && !openaiApiKey) throw new Error('Missing OpenAI API key.');

      const list = indices.map(i => ({ idx: i, d: f.dialogs[i] })).filter(x => x.d);
      if (!list.length) return;

      setBusy(true);
      setStatus(`Translating ${list.length} line(s)…`, `${engine} → ${targetLang}`);
      log(`Translate: ${engine} → ${targetLang} (${list.length} items)`);

      let done = 0;
      let batchCount = 0;
      let sidebarDirty = false;

      try {
        for (let start = 0; start < list.length; start += batch) {
          const slice = list.slice(start, start + batch);
          let translated: string[];
          const dialogsOnly = slice.map(x => x.d);
          
          if (Common.isGeminiFreeEngine(engine)) {
            translated = await translateBatchGeminiFree(dialogsOnly, targetLang, engine);
          } else if (engine === 'deepseek') {
            translated = await translateBatchDeepSeek(dialogsOnly, targetLang, deepseekApiKey);
          } else if (engine === 'deepl') {
            translated = await translateBatchDeepL(dialogsOnly, targetLang, deeplApiKey);
          } else if (Common.isOpenAIEngine(engine)) {
            const activeApiKey = Common.getEngineProvider(engine) === 'gemini' ? geminiApiKey : openaiApiKey;
            translated = await translateBatchOpenAI(dialogsOnly, targetLang, activeApiKey, engine);
          } else if (engine === 'google') {
            translated = await translateBatchGoogle(dialogsOnly, targetLang);
          } else {
            translated = await translateBatchLingva(dialogsOnly, targetLang);
          }
          
          for (let i = 0; i < slice.length; i++) {
            const { idx, d } = slice[i];
            const prev = String(d.translated ?? '');
          
            const out = String(translated[i] ?? '');
            const unmasked = unmaskTagsInText(out, d.placeholderMap);
            d.translated = unmasked;
            if (adjustFileTranslatedCount(f, prev, unmasked)) sidebarDirty = true;
          
            pushHistory({ path, row: idx, field: 'translated', prev, next: String(unmasked ?? ''), ts: Date.now(), source: engine });
          
            if (ui.autoSave?.checked && hasTranslatedValue(unmasked)) {
              Store.tmPut(targetLang, String(d.maskedQuote ?? ''), String(unmasked), { source: engine }).catch(()=>{});
            }
          }

          done += slice.length;
          batchCount++;
          setStatus(`Translating… ${done}/${list.length}`, `${engine} → ${targetLang}`);

          const shouldPaint = done === list.length || (batchCount % PERF.translatePaintEvery === 0);
          if (shouldPaint) {
            refreshActiveGridAfterMutation();
            updateUndoRedoButtons();
            if (sidebarDirty) {
              scheduleRefreshSidebar();
              sidebarDirty = false;
            } else {
              updateProjectStats();
            }
            await yieldToMain();
          }

          if (ui.autoSave?.checked) scheduleSaveActiveFile();
        }
        setStatus(`Done. Translated ${done} line(s).`, '');
      } catch (err: any) {
        const rawErrMsg = err.message || String(err);
        const providerName = Common.getProviderErrorLabel(engine);
        log(`Translation failed [${providerName}]: ` + rawErrMsg, 'err');
        setStatus('Error occurred during translation.', '');
        showErrorModal(providerName, rawErrMsg);
      } finally {
        if (sidebarDirty) scheduleRefreshSidebar();
        setBusy(false);
      }
    }

    ui.btnTranslateMissing?.addEventListener('click', async () => {
      const p = state.activePath;
      if (!p) return;
      const f = state.files.get(p);
      if (!f) return;

      if (ui.useTMFirst?.checked) {
        setBusy(true);
        setStatus('Applying TM…', '');
        const filled = await fillMissingFromTM(p);
        if (filled) {
          log(`TM filled: ${filled} lines`);
          scheduleRefreshSidebar();
          refreshActiveGridAfterMutation();
          if (ui.autoSave?.checked) scheduleSaveActiveFile();
        }
        setBusy(false);
      }

      const missing = [];
      for (let i = 0; i < f.dialogs.length; i++) {
        const d = f.dialogs[i];
        if (!d.translated || !String(d.translated).trim()) missing.push(i);
      }
      await translateDialogs(p, missing);
    });

    ui.btnTranslateSelected?.addEventListener('click', async () => {
      const p = state.activePath;
      if (!p) return;
      const indices = Array.from(state.activeSelected.values()).sort((a,b)=>a-b);
      await translateDialogs(p, indices);
    });

    function makeDownload(name: string, text: string) {
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
    }

    ui.btnExportFile?.addEventListener('click', () => {
      const p = state.activePath;
      if (!p) return;
      const f = state.files.get(p);
      if (!f) return;

      const out = RENPY.applyTranslations(f.source, f.dialogs, '\n', TRANSLATOR_CREDIT);
      const restored = restoreLineEndings(out, f.eol);
      const base = p.split('/').pop();
      makeDownload(base || 'translated.rpy', restored);
    });

    ui.btnExportZip?.addEventListener('click', () => {
      const files: any[] = [];
      for (const f of state.files.values()) {
        const out = RENPY.applyTranslations(f.source, f.dialogs, '\n', TRANSLATOR_CREDIT);
        const restored = restoreLineEndings(out, f.eol);
        files.push({ name: String(f.path).replaceAll('\\\\','/'), data: new TextEncoder().encode(restored) });
      }
      downloadZip('hikami-translate-export.zip', files);
    });

    ui.btnExportTxt?.addEventListener('click', () => {
      const p = state.activePath;
      if (!p) return;
      const f = state.files.get(p);
      if (!f) return;

      const base = p.split('/').pop() || 'file';
      const txtFilename = base.replace(/\.rpy$/i, '') + '.txt';
      const out = exportToTxt(f.dialogs, base);
      makeDownload(txtFilename, out);
      log(`Exported dialogue as text file: ${txtFilename}`);
    });

    ui.btnImportTxt?.addEventListener('click', () => {
      if (ui.txtImportInput) ui.txtImportInput.click();
    });

    ui.txtImportInput?.addEventListener('change', async () => {
      const p = state.activePath;
      if (!p) return;
      const f = state.files.get(p);
      if (!f) return;

      const file = ui.txtImportInput.files?.[0];
      if (!file) return;

      setBusy(true);
      setStatus('Importing text translations…', '');
      try {
        const text = await file.text();
        const { updatedCount, updatedDialogs } = importFromTxt(text, f.dialogs);
        
        if (updatedCount > 0) {
          f.dialogs = updatedDialogs;
          syncFileMeta(f);
          
          if (ui.autoSave?.checked) {
            scheduleSaveActiveFile();
          }
          
          refreshActiveGridAfterMutation();
          scheduleRefreshSidebar();
          
          log(`Import completed. Updated ${updatedCount} dialogue translation(s).`);
          setStatus(`Successfully loaded ${updatedCount} translation(s) from ${file.name}!`, '');
        } else {
          setStatus('No new or changed translations found in the .txt file.', '');
          log('Text import: No differences found.');
        }
      } catch (e: any) {
        log('Text import failed: ' + (e?.message || e), 'err');
        setStatus('Failed to import text file.', '');
      } finally {
        ui.txtImportInput.value = '';
        setBusy(false);
      }
    });

    ui.btnClear?.addEventListener('click', async () => {
      const confirmed = await showConfirm('Bạn có chắc chắn muốn xóa toàn bộ dự án cục bộ và bộ nhớ dịch thuật (TM) của ngôn ngữ hiện tại không?');
      if (!confirmed) return;
      const target = ui.targetLangSelect?.value || 'Vietnamese';
      try {
        await Store.deleteProject(PROJECT_ID);
        await Store.tmClear(target);
      } catch {}
      state.files.clear();
      state.activePath = null;
      if (ui.gridBody) ui.gridBody.innerHTML = '';
      updateProjectStats();
      renderFileList();
      enableActions();
      updateUndoRedoButtons();
      setStatus('Cleared.', '');
    });

    function enableActions() {
      const hasFile = !!state.activePath;
      if (ui.btnTranslateMissing) ui.btnTranslateMissing.disabled = !hasFile;
      if (ui.btnTranslateSelected) ui.btnTranslateSelected.disabled = !hasFile;
      if (ui.btnExportFile) ui.btnExportFile.disabled = !hasFile;
      if (ui.btnExportZip) ui.btnExportZip.disabled = state.files.size === 0;
      if (ui.btnExportTxt) ui.btnExportTxt.disabled = !hasFile;
      if (ui.btnImportTxt) ui.btnImportTxt.disabled = !hasFile;
      if (ui.btnTmFillMissing) ui.btnTmFillMissing.disabled = !hasFile;
    }

    ui.btnFind?.addEventListener('click', () => {
      if (!state.activePath) return;
      state.find.matches = [];
      state.find.cursor = -1;
      if (ui.findStats) ui.findStats.textContent = '0 matches.';
      if (ui.findModal) {
        openModal(ui.findModal);
        ui.findQuery?.focus();
      }
    });

    ui.btnTM?.addEventListener('click', async () => {
      if (ui.tmModal) {
        openModal(ui.tmModal);
        await renderTM();
      }
    });

    ui.btnTmFillMissing?.addEventListener('click', async () => {
      const p = state.activePath;
      if (!p) return;
      setBusy(true);
      setStatus('Applying TM…', '');
      const filled = await fillMissingFromTM(p);
      setBusy(false);
      refreshActiveGridAfterMutation();
      scheduleRefreshSidebar();
      if (ui.findStats) ui.findStats.textContent = '';
      log(`TM filled: ${filled}`);
      if (ui.autoSave?.checked) scheduleSaveActiveFile();
    });

    async function renderTM() {
      const target = ui.targetLangSelect?.value || 'Vietnamese';
      const q = String(ui.tmSearch?.value || '').toLowerCase().trim();
      const list = await Store.tmList(target, 2000);
      if (!ui.tmList) return;
      ui.tmList.replaceChildren();
      const frag = document.createDocumentFragment();
      let shown = 0;

      for (const e of list) {
        const src = String(e.sourceMasked ?? '');
        const tr = String(e.translation ?? '');
        if (q && !src.toLowerCase().includes(q) && !tr.toLowerCase().includes(q)) continue;

        const item = document.createElement('div');
        item.className = 'tm-item';

        const top = document.createElement('div');
        top.className = 'tm-top';

        const k = document.createElement('div');
        k.className = 'tm-k';

        const key = String(e.key ?? '');
        const updatedAt = String(e.updatedAt ?? '');
        const count = String(e.count ?? 1);
        k.textContent = `${key} · ${updatedAt} · x${count}`;

        const actions = document.createElement('div');
        actions.className = 'tm-actions';

        const del = document.createElement('button');
        del.className = 'btn';
        del.type = 'button';
        del.textContent = 'Delete';
        del.addEventListener('click', async () => {
          await Store.tmDelete(key);
          await renderTM();
        });

        actions.appendChild(del);
        top.append(k, actions);

        const srcEl = document.createElement('div');
        srcEl.className = 'tm-src';
        srcEl.textContent = src;

        const trEl = document.createElement('div');
        trEl.className = 'tm-tr';
        trEl.textContent = tr;

        item.append(top, srcEl, trEl);
        frag.appendChild(item);

        shown++;
        if (shown % PERF.tmYieldEvery === 0) {
          ui.tmList.appendChild(frag);
          await yieldToMain();
        }
        if (shown >= PERF.tmRenderLimit) break;
      }

      ui.tmList.appendChild(frag);
    }

    if (ui.tmSearch) {
      ui.tmSearch.addEventListener('input', debounce(renderTM, PERF.tableSearchMs));
    }

    ui.btnTmExport?.addEventListener('click', async () => {
      const target = ui.targetLangSelect?.value || 'Vietnamese';
      const json = await Store.tmExport(target);
      makeDownload(`tm-${target.toLowerCase()}.json`, json);
    });

    ui.btnTmImport?.addEventListener('click', () => ui.tmImportInput?.click());
    
    ui.tmImportInput?.addEventListener('change', async () => {
      const f = ui.tmImportInput.files?.[0];
      if (!f) return;
      const txt = await f.text();
      try {
        const n = await Store.tmImport(txt);
        log(`Imported TM entries: ${n}`);
      } catch (e: any) {
        log('TM import failed: ' + (e?.message || e), 'err');
      }
      ui.tmImportInput.value = '';
      await renderTM();
    });

    ui.btnTmClear?.addEventListener('click', async () => {
      const target = ui.targetLangSelect?.value || 'Vietnamese';
      const confirmed = await showConfirm(`Bạn có chắc chắn muốn xóa tất cả bộ nhớ dịch thuật (TM) của ngôn ngữ mục tiêu: ${target} không?`);
      if (!confirmed) return;
      await Store.tmClear(target);
      await renderTM();
    });

    function computeFindMatches() {
      const p = state.activePath;
      if (!p) return [];
      const f = state.files.get(p);
      if (!f) return [];

      const q = ui.findQuery?.value || '';
      const re = buildMatcher(q, ui.findRegex?.checked, ui.findCase?.checked);
      if (!re) return [];

      const scope = ui.findScope?.value || 'translation';
      const rowsMode = ui.findRows?.value || 'all';

      if (scope === 'source') {
        log('Replace does not modify Source. Switch scope to Translation or Both.', 'warn');
        return [];
      }

      let candidates = [];
      if (rowsMode === 'selected') candidates = Array.from(state.activeSelected.values());
      else if (rowsMode === 'filtered') candidates = state.activeView.slice();
      else candidates = f.dialogs.map((_: any, i: number) => i);

      const matches = [];
      for (const i of candidates) {
        const d = f.dialogs[i];
        if (!d) continue;
        if (scope === 'source' || scope === 'both') {
          for (const m of findAllInText(d.quote || '', re)) matches.push({ row: i, field: 'source', index: m.index, len: m.len });
        }
        if (scope === 'translation' || scope === 'both') {
          for (const m of findAllInText(d.translated || '', re)) matches.push({ row: i, field: 'translation', index: m.index, len: m.len });
        }
      }
      return sortMatches(matches);
    }

    function focusMatch(m: any) {
      const p = state.activePath;
      if (!p) return;

      let pos = state.virtual.viewIndexByRow.get(m.row);
      if (pos == null) {
        if (ui.rowFilter) ui.rowFilter.value = 'all';
        if (ui.tableSearch) ui.tableSearch.value = '';
        renderTable({ resetSel: false, resetScroll: false });
        pos = state.virtual.viewIndexByRow.get(m.row);
      }
      if (pos == null) return;

      const wrap = ui.tableWrap;
      if (!wrap) return;
      const rowH = state.virtual.rowHeight;
      const targetTop = Math.max(0, pos * rowH - (wrap.clientHeight / 2) + (rowH / 2));
      wrap.scrollTo({ top: targetTop, behavior: 'smooth' });

      let tries = 0;
      const tryFocus = () => {
        tries++;
        renderVirtual(true);
        const r2 = ui.gridBody?.querySelector(`tr[data-idx="${m.row}"]`);
        if (!r2) {
          if (tries < 30) requestAnimationFrame(tryFocus);
          return;
        }
        if (m.field === 'translation') {
          const ta = r2.querySelector('.trInput') as HTMLTextAreaElement | null;
          if (ta) {
            ta.focus();
            const start = m.index;
            const end = m.index + m.len;
            ta.setSelectionRange(start, end);
          }
        }
      };
      requestAnimationFrame(tryFocus);
    }

    function updateFindUI() {
      const total = state.find.matches.length;
      if (ui.findStats) {
        ui.findStats.textContent = total ? `${total} matches. (${state.find.cursor + 1}/${total})` : '0 matches.';
      }
    }

    function ensureMatches() {
      state.find.matches = computeFindMatches();
      state.find.cursor = state.find.matches.length ? 0 : -1;
      updateFindUI();
      if (state.find.cursor >= 0) focusMatch(state.find.matches[state.find.cursor]);
    }

    if (ui.findQuery) ui.findQuery.addEventListener('input', debounce(ensureMatches, 180));
    if (ui.findCase) ui.findCase.addEventListener('change', ensureMatches);
    if (ui.findRegex) ui.findRegex.addEventListener('change', ensureMatches);
    if (ui.findScope) ui.findScope.addEventListener('change', ensureMatches);
    if (ui.findRows) ui.findRows.addEventListener('change', ensureMatches);

    ui.btnFindNext?.addEventListener('click', () => {
      const total = state.find.matches.length;
      if (!total) return;
      state.find.cursor = nextIndex(total, state.find.cursor, +1);
      updateFindUI();
      focusMatch(state.find.matches[state.find.cursor]);
    });

    ui.btnFindPrev?.addEventListener('click', () => {
      const total = state.find.matches.length;
      if (!total) return;
      state.find.cursor = nextIndex(total, state.find.cursor, -1);
      updateFindUI();
      focusMatch(state.find.matches[state.find.cursor]);
    });

    ui.btnReplaceAll?.addEventListener('click', async () => {
      const p = state.activePath;
      if (!p) return;
      const f = state.files.get(p);
      if (!f) return;

      const q = ui.findQuery?.value || '';
      const re = buildMatcher(q, ui.findRegex?.checked, ui.findCase?.checked);
      if (!re) return;

      const scope = ui.findScope?.value || 'translation';
      const rowsMode = ui.findRows?.value || 'all';

      if (scope === 'source') {
        log('Replace does not modify Source. Switch scope to Translation or Both.', 'warn');
        return;
      }

      let candidates = [];
      if (rowsMode === 'selected') candidates = Array.from(state.activeSelected.values());
      else if (rowsMode === 'filtered') candidates = state.activeView.slice();
      else candidates = f.dialogs.map((_: any, i: number) => i);

      let replaced = 0;
      const rep = ui.replaceQuery?.value || '';

      const target = ui.targetLangSelect?.value || 'Vietnamese';
      for (const i of candidates) {
        const d = f.dialogs[i];
        if (!d) continue;

        if (scope === 'translation' || scope === 'both') {
          const before = d.translated || '';
          const after = replaceAll(before, re, rep);
          if (after !== before) replaced++;
          d.translated = after;
          adjustFileTranslatedCount(f, before, after);
          if (String(after).trim()) Store.tmPut(target, String(d.maskedQuote ?? ''), String(after), { source: 'findreplace' }).catch(()=>{});
        }
      }

      refreshActiveGridAfterMutation();
      scheduleRefreshSidebar();
      ensureMatches();

      if (ui.autoSave?.checked) scheduleSaveActiveFile();
      log(`Replace all: ${replaced} replacements`);
    });

    ui.btnReplaceOne?.addEventListener('click', async () => {
      if (state.find.cursor < 0) return;
      const m = state.find.matches[state.find.cursor];
      if (m.field !== 'translation') {
        log('Replace works on Translation field. Change scope to Translation or Both.', 'warn');
        return;
      }
      const p = state.activePath;
      if (!p) return;
      const f = state.files.get(p);
      const d = f.dialogs[m.row];
      const q = ui.findQuery?.value || '';
      const re = buildMatcher(q, ui.findRegex?.checked, ui.findCase?.checked);
      if (!re) return;
      const rep = ui.replaceQuery?.value || '';

      const text = String(d.translated || '');
      re.lastIndex = 0;
      let mm;
      let found = null;
      while ((mm = re.exec(text)) !== null) {
        if (mm.index === m.index) { found = mm; break; }
        if (mm[0].length === 0) re.lastIndex++;
      }
      if (!found) { ensureMatches(); return; }
      const before = text.slice(0, found.index);
      const after = text.slice(found.index + found[0].length);
      const out = before + String(rep ?? '') + after;
      const prevValue = d.translated;
      d.translated = out;
      adjustFileTranslatedCount(f, prevValue, out);

      const target = ui.targetLangSelect?.value || 'Vietnamese';
      Store.tmPut(target, String(d.maskedQuote ?? ''), String(out), { source: 'findreplace' }).catch(()=>{});
      if (ui.autoSave?.checked) scheduleSaveActiveFile();
      refreshActiveGridAfterMutation();
      scheduleRefreshSidebar();
      ensureMatches();
    });

    if (ui.btnExportFile) ui.btnExportFile.disabled = true;
    if (ui.btnExportZip) ui.btnExportZip.disabled = true;
    if (ui.btnExportTxt) ui.btnExportTxt.disabled = true;
    if (ui.btnImportTxt) ui.btnImportTxt.disabled = true;
    if (ui.btnTranslateMissing) ui.btnTranslateMissing.disabled = true;
    if (ui.btnTranslateSelected) ui.btnTranslateSelected.disabled = true;

    if (ui.targetLangSelect) {
      ui.targetLangSelect.addEventListener('change', async () => {
        if (ui.tmModal && !ui.tmModal.hidden) await renderTM();
      });
    }

    hydrateFromStorage().then(() => {
      enableActions();
    });

    return () => {
      window.removeEventListener('resize', () => {});
    };
  }, []);

  return (
    <>
      <header className="topbar">
        <a href="/" style={{ textDecoration: 'none', border: 'none', outline: 'none' }}>
          <div className="brand">
            <div className="logo" aria-hidden="true">
              <img src="https://files.catbox.moe/a1ymtq.jpg" alt="Logo" referrerPolicy="no-referrer" />
            </div>
            <div className="brand-text">
              <div className="brand-title" style={{ color: '#fff', textDecoration: 'none' }}>
                Hikami Renpy Translator
              </div>
              <div className="brand-subtitle">Pro Ren’Py Localization</div>
            </div>
          </div>
        </a>

        <div className="top-actions">
          <button className="btn" id="btnOpenFiles">Open Files</button>
          <button className="btn" id="btnOpenFolder">Open Folder</button>
          <button className="btn" id="btnExportFile" disabled>Export File</button>
          <button className="btn" id="btnExportZip" disabled>Export ZIP</button>
          <button className="btn" id="btnExportTxt" disabled>Export TXT</button>
          <button className="btn" id="btnImportTxt" disabled>Import TXT</button>
          <div className="sep"></div>
          <button id="btnUndo" className="btn" disabled>Undo</button>
          <button id="btnRedo" className="btn" disabled>Redo</button>
          <button id="btnCopyOriginal" className="btn">Copy Src</button>
          <button id="btnCopyTranslate" className="btn">Copy Tl</button>
          <button className="btn" id="btnFind">Find/Replace</button>
          <button className="btn" id="btnTM">Trans Mem</button>
          <div className="sep"></div>
          <button className="btn btn-danger" id="btnClear">Clear</button>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <div className="panel">
            <div className="panel-title">Project</div>
            <div className="kv">
              <div className="k">Files</div><div className="v" id="statFiles">0</div>
              <div className="k">Strings</div><div className="v" id="statStrings">0</div>
              <div className="k">Translated</div><div className="v" id="statTranslated">0</div>
            </div>
            <div className="row gap">
              <input className="input" id="fileFilter" placeholder="Filter files…" />
              <button className="btn btn-ghost" id="btnReload">Reload</button>
            </div>
          </div>

          <div className="panel files">
            <div className="panel-title">
              <span>Files</span>
              <span className="badge" id="fileBadge">0</span>
            </div>
            <div className="file-list" id="fileList" role="listbox" aria-label="Files"></div>
          </div>

          <div className="panel">
            <div className="panel-title">Translate</div>

            <div className="row gap" style={{ marginBottom: '8px' }}>
              <label className="label">Engine</label>
              <select className="select" id="engineSelect"></select>
            </div>

            <div className="row gap" style={{ marginBottom: '8px' }}>
              <label className="label">Target</label>
              <select className="select" id="targetLangSelect"></select>
            </div>

            <div className="row gap" style={{ marginBottom: '8px' }}>
              <label className="label">Extract mode</label>
              <select className="select" id="extractMode">
                <option value="safe">Safe (Recommended)</option>
                <option value="balanced">Balanced</option>
                <option value="aggressive">Aggressive</option>
              </select>
            </div>

            <div className="row gap" style={{ marginBottom: '12px' }}>
              <label className="label">Batch Size</label>
              <input className="input" id="batchSize" type="number" min="1" max="100" defaultValue="30" />
            </div>

            <div className="row gap" style={{ marginBottom: '8px' }}>
              <label className="check">
                <input type="checkbox" id="useTMFirst" defaultChecked />
                <span>Fill missing from TM before MT</span>
              </label>
            </div>

            <div className="row gap" style={{ marginBottom: '12px' }}>
              <label className="check">
                <input type="checkbox" id="autoSave" defaultChecked />
                <span>Auto-save changes</span>
              </label>
            </div>

            <div className="row gap" style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <button className="btn btn-primary" id="btnTranslateMissing" style={{ flex: 1 }} disabled>Translate Untranslated</button>
              <button className="btn" id="btnTranslateSelected" style={{ flex: 1 }} disabled>Translate Selected</button>
            </div>

            {/* Gemini Aistudio configuration row */}
            <div className="row gap" id="geminiKeyRow" style={{ display: 'none', marginTop: '8px' }}>
              <label className="label" style={{ fontWeight: '600' }}>Gemini Aistudio</label>
              <input className="input" id="inputGeminiApiKey" placeholder="Nhập Gemini/AI Studio API Key" type="password" />
            </div>

            {/* DeepSeek key configuration row */}
            <div className="row gap" id="deepseekKeyRow" style={{ display: 'none', marginTop: '8px' }}>
              <label className="label" style={{ fontWeight: '600' }}>DeepSeek Key</label>
              <input className="input" id="inputDeepseekApiKey" placeholder="Nhập DeepSeek API Key" type="password" />
            </div>

            {/* OpenAI key configuration row */}
            <div className="row gap" id="openaiKeyRow" style={{ display: 'none', marginTop: '8px' }}>
              <label className="label" style={{ fontWeight: '600' }}>OpenAI Key</label>
              <input className="input" id="inputOpenaiApiKey" placeholder="Nhập OpenAI API Key" type="password" />
            </div>

            {/* DeepL key configuration row */}
            <div className="row gap" id="deeplKeyRow" style={{ display: 'none', marginTop: '8px' }}>
              <label className="label" style={{ fontWeight: '600' }}>DeepL Key</label>
              <input className="input" id="inputDeeplApiKey" placeholder="Nhập DeepL API Key" type="password" />
            </div>

            {/* Save API Keys Button */}
            <div className="row gap" id="saveKeysRow" style={{ display: 'none', marginTop: '8px' }}>
              <button className="btn btn-primary" id="btnSaveApiKeys" style={{ width: '100%', marginTop: '4px' }}>
                💾 Lưu API Key
              </button>
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">View Options</div>
            <div className="row gap" style={{ marginBottom: '8px' }}>
              <label className="label">Filter</label>
              <select className="select" id="rowFilter">
                <option value="all">All Lines</option>
                <option value="untranslated">Untranslated Only</option>
                <option value="translated">Translated Only</option>
                <option value="flag">Flagged Lines</option>
                <option value="error">Placeholder Errors</option>
              </select>
            </div>
            
            <div className="row gap" style={{ marginBottom: '8px' }}>
              <input className="input" id="tableSearch" placeholder="Search in source/translation…" />
            </div>
            <div className="row gap">
              <label className="check">
                <input type="checkbox" id="showWarnings" defaultChecked />
                <span>Show placeholder warnings</span>
              </label>
            </div>
          </div>

          <div className="panel" style={{ padding: '12px', fontSize: '12px', lineHeight: '1.5' }}>
            <div className="panel-title">Contact & Support</div>
            <div style={{ color: 'var(--muted)', marginBottom: '10px' }}>
              <div>Contact: <a href="mailto:hikamigamelor@haren.uk" style={{ color: 'var(--accent)', textDecoration: 'none' }}>hikamigamelor@haren.uk</a></div>
            </div>
            <div className="row gap">
              <a className="btn btn-primary" style={{ width: '100%', textAlign: 'center', display: 'block', textDecoration: 'none' }} href="https://patreon.com/avadex" target="_blank" rel="noopener noreferrer">
                ❤️ Patreon Support
              </a>
            </div>
          </div>
        </aside>

        <main className="main">
          <div className="table-wrap" id="tableWrap">
            <table className="grid" id="grid">
              <thead>
                <tr>
                  <th className="col-sel"><input type="checkbox" id="selAll" /></th>
                  <th className="col-no">#</th>
                  <th className="col-src">Source</th>
                  <th className="col-tr">Translation</th>
                  <th className="col-meta">Meta</th>
                </tr>
              </thead>
              <tbody id="gridBody" style={{ overflowY: 'auto' }}></tbody>
            </table>
          </div>

          <div className="statusbar">
            <div className="status-left" id="statusLeft">No project loaded. Open a Ren'Py script file to start translating.</div>
            <div className="status-right" id="statusRight"></div>
          </div>

          <div className="log" id="log" aria-live="polite"></div>
        </main>
      </div>

      <input id="fileInput" type="file" accept=".rpy" multiple hidden />
      <input id="folderInput" type="file" accept=".rpy" {...{ webkitdirectory: "", directory: "" } as any} multiple hidden />
      <input id="txtImportInput" type="file" accept=".txt" hidden />

      <div className="modal-backdrop" id="modalBackdrop" hidden></div>

      <div className="modal" id="findModal" hidden role="dialog" aria-modal="true" aria-labelledby="findTitle">
        <div className="modal-header">
          <div className="modal-title" id="findTitle">Find & Replace</div>
          <button className="icon-btn" data-close="findModal" aria-label="Close">✕</button>
        </div>
        <div className="modal-body">
          <div className="grid2">
            <div>
              <div className="field">
                <div className="field-label">Find</div>
                <input className="input" id="findQuery" />
              </div>
              <div className="field">
                <div className="field-label">Replace</div>
                <input className="input" id="replaceQuery" />
              </div>
              <div className="row gap" style={{ marginTop: '8px', marginBottom: '8px' }}>
                <label className="check"><input type="checkbox" id="findCase" /> <span>Case sensitive</span></label>
                <label className="check"><input type="checkbox" id="findRegex" /> <span>Regex</span></label>
              </div>
              <div className="row gap" style={{ marginBottom: '8px' }}>
                <label className="label">In</label>
                <select className="select" id="findScope">
                  <option value="translation">Translation</option>
                  <option value="source">Source</option>
                  <option value="both">Both</option>
                </select>
              </div>
              <div className="row gap">
                <label className="label">Rows</label>
                <select className="select" id="findRows">
                  <option value="filtered">Filtered rows</option>
                  <option value="selected">Selected rows</option>
                  <option value="all">All rows</option>
                </select>
              </div>
            </div>
            <div className="find-right">
              <div className="find-stats" id="findStats">0 matches.</div>
              <div className="row gap" style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button className="btn" id="btnFindPrev">Prev</button>
                <button className="btn" id="btnFindNext">Next</button>
                <button className="btn" id="btnReplaceOne">Replace</button>
                <button className="btn btn-primary" id="btnReplaceAll">Replace All</button>
              </div>
              <div className="hint" style={{ marginTop: '16px', fontSize: '11px', color: 'var(--muted)' }}>
                Tip: Click a row to focus. Find/Replace works on current file.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="modal" id="tmModal" hidden role="dialog" aria-modal="true" aria-labelledby="tmTitle">
        <div className="modal-header">
          <div className="modal-title" id="tmTitle">Translation Memory</div>
          <button className="icon-btn" data-close="tmModal" aria-label="Close">✕</button>
        </div>
        <div className="modal-body">
          <div className="row gap" style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input className="input" id="tmSearch" placeholder="Search TM…" style={{ flex: 1 }} />
            <button className="btn" id="btnTmExport">Export</button>
            <button className="btn" id="btnTmImport">Import</button>
            <button className="btn btn-danger" id="btnTmClear">Clear</button>
          </div>
          <div className="row gap" style={{ marginBottom: '12px' }}>
            <button className="btn btn-primary" id="btnTmFillMissing" style={{ width: '100%' }} disabled>Fill missing in current file</button>
          </div>
          <div className="tm-list" id="tmList"></div>
          <input id="tmImportInput" type="file" accept=".json" hidden />
        </div>
      </div>

      <div className="modal" id="errorModal" hidden role="dialog" aria-modal="true" aria-labelledby="errorTitle" style={{ maxWidth: '520px', width: '92%' }}>
        <div className="modal-header" style={{ borderBottom: '1px solid rgba(255, 77, 77, 0.25)' }}>
          <div className="modal-title" id="errorTitle" style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '18px' }}>⚠️</span> Lỗi dịch thuật từ AI / API Trình Dịch
          </div>
          <button className="icon-btn" data-close="errorModal" aria-label="Close">✕</button>
        </div>
        <div className="modal-body" style={{ padding: '16px' }}>
          <div style={{ marginBottom: '12px', fontSize: '14px', fontWeight: 'bold', color: 'var(--text)' }}>
            Nhà cung cấp: <span id="errorProvider" style={{ color: 'var(--accent)', fontWeight: '800' }}>—</span>
          </div>
          <div style={{ marginBottom: '10px', fontSize: '12px', color: 'var(--muted)', lineHeight: '1.5' }}>
            Yêu cầu dịch thuật thất bại. Vui lòng kiểm tra API Key hoặc số dư tài khoản của bạn. Nguồn trả lỗi chi tiết bên dưới:
          </div>
          <pre id="errorDetailsBox" style={{ 
            background: 'rgba(255, 77, 77, 0.08)', 
            border: '1px solid rgba(255, 77, 77, 0.25)', 
            borderRadius: '10px', 
            padding: '12px', 
            fontFamily: 'var(--mono)', 
            fontSize: '11px', 
            color: '#ff8a8a', 
            maxHeight: '180px', 
            overflowY: 'auto',
            whiteSpace: 'pre-wrap', 
            wordBreak: 'break-all',
            margin: '0 0 16px 0'
          }}>
            —
          </pre>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" data-close="errorModal" style={{ minWidth: '80px' }}>Đóng</button>
          </div>
        </div>
      </div>
    </>
  );
}
