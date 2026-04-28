// ==UserScript==
// @name         CRM × i智慧 物件自動帶入 (B6)
// @namespace    https://coprime5231-crm.zeabur.app/
// @version      0.9.2
// @description  在 CRM 新增帶看 Modal 輸入 i智慧 物件編號或 detail URL → 自動帶入社區、地點、永慶連結、同事、同事手機（地址含「號」才帶）；列印頁若帶 ?autoPrint=1 自動觸發列印；回傳 payload 加 ycutCaseIdx 供 CRM 組列印 URL
// v0.9.2 — i智慧 keyWord 是子字串模糊比對（4 碼也會撈到 7 碼物件）。改成在 caseList 裡找「某欄位精準等於輸入」的那筆，找不到視同 case_not_found，避免拿到無關物件。
// v0.9.1 — searchType 從 "S"（複數店）改 "A"（全部）：聯賣他店物件之前一律回 0，現在涵蓋本店 / 複數店 / 聯賣他店全部 scope。對齊 i智慧 Pro 全部範圍實測 body。
// v0.9.0 — 對齊 i智慧 Pro DOM <dd>社區名稱</dd> 規則：把 "--"/"—"/"－"/空白視為空 sentinel；加 picked-from log 便於鎖定 key
// v0.8.0 — 公寓/透天案件社區欄位留空：砍掉 propertyName/caseName fallback（會撿到案名）+ 加行銷文案啟發式過濾
// v0.7.0 — caseIdx 改用 value-based scan（不再猜 key 名稱）
// @author       coprime5231
// @match        https://coprime5231-crm.zeabur.app/marketing*
// @match        http://localhost:3000/marketing*
// @match        https://is.ycut.com.tw/case/report/market/redirect*
// @connect      is.ycut.com.tw
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @run-at       document-idle
// @updateURL    https://coprime5231-crm.zeabur.app/userscripts/b6-lookup.user.js
// @downloadURL  https://coprime5231-crm.zeabur.app/userscripts/b6-lookup.user.js
// ==/UserScript==

(function () {
  'use strict';

  const API_BASE = 'https://is.ycut.com.tw';
  const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const VERSION = '0.9.2';
  // Tampermonkey 沙箱：跨 context 訊息必須走 unsafeWindow 才能抵達頁面 window
  const pageWindow = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  const COMMON_HEADERS = {
    'Accept': 'application/json, text/plain, */*',
    'websitename': 'IntegrationService_WS',
  };
  const LOG = (...args) => console.log('[CRM×i智慧]', ...args);

  // ============ 列印頁自動觸發 ============
  // CRM 列印按鈕打開新分頁時會附 ?autoPrint=1；列印頁 SPA 渲染完 .printBtn 後點一下
  if (location.host === 'is.ycut.com.tw' &&
      location.pathname === '/case/report/market/redirect' &&
      new URLSearchParams(location.search).get('autoPrint') === '1') {
    LOG('userscript loaded v' + VERSION + ' (autoPrint mode)');
    LOG('autoPrint mode, waiting for .printBtn');
    let tries = 0;
    const MAX_TRIES = 150;
    const DELAY_AFTER_FOUND = 1200;
    const timer = setInterval(() => {
      tries++;
      const btn = Array.from(document.querySelectorAll('button.printBtn'))
        .find((b) => (b.textContent || '').trim() === '列印');
      if (btn) {
        clearInterval(timer);
        LOG('printBtn found after ' + tries + ' tries, firing window.print() in ' + DELAY_AFTER_FOUND + 'ms');
        setTimeout(() => {
          try {
            btn.click();
          } catch (e) {
            pageWindow.print();
          }
        }, DELAY_AFTER_FOUND);
      } else if (tries >= MAX_TRIES) {
        clearInterval(timer);
        LOG('printBtn not found after ' + tries + ' tries, giving up autoPrint');
      }
    }, 100);
    return;
  }

  function gmRequest(method, url, body) {
    return new Promise((resolve, reject) => {
      const opts = {
        method,
        url,
        headers: Object.assign({}, COMMON_HEADERS),
        responseType: 'json',
        timeout: 8000,
        onload: (r) => {
          const parsed = r.response != null ? r.response : tryParse(r.responseText);
          if (r.status >= 200 && r.status < 300) resolve(parsed);
          else reject(Object.assign(new Error('HTTP ' + r.status), { status: r.status, body: parsed }));
        },
        onerror: () => reject(new Error('network_error')),
        ontimeout: () => reject(new Error('timeout')),
      };
      if (body !== undefined) {
        opts.headers['Content-Type'] = 'application/json';
        opts.data = JSON.stringify(body);
      }
      GM_xmlhttpRequest(opts);
    });
  }

  function gmGet(url) { return gmRequest('GET', url); }
  function gmPost(url, body) { return gmRequest('POST', url, body); }

  function buildSearchBody(keyWord) {
    return {
      condition: {
        mode: 'C',
        sellRent: 'A',
        searchType: 'A',
        sTeamStores: [],
        city1: null, city2: null, city3: null,
        district1: null, district2: null, district3: null,
        useCodes: [], typeCodes: [],
        totPriceFrom: null, totPriceTo: null,
        rentFrom: null, rentTo: null,
        rmFrom: null, rmTo: null,
        keyWord: keyWord,
        groupKeyWord: null,
        mainCaseTags: [],
        parkingSpace: null, parkingModes: [],
        buiMPinFrom: null, buiMPinTo: null,
        buiTotPinFrom: null, buiTotPinTo: null,
        landShPinFrom: null, landShPinTo: null,
        floorSt: null, floorEn: null,
        excludeTopFloor: false,
        bathRmFrom: null, bathRmTo: null,
        caseGrp: null,
        buildingAgeFrom: null, buildingAgeTo: null,
        landTypes: [], positions: [],
        doorPositions: null, ceilingWinPositions: null,
        otherCaseTags: [],
        priSchool: null, junSchool: null,
      },
      page: { skip: 0, take: 20, descending: false, order: 'A' },
    };
  }

  function tryParse(text) {
    try { return JSON.parse(text); } catch (e) { return null; }
  }

  function isAuthError(err) {
    return !!err && (err.status === 401 || err.status === 403);
  }

  function unwrap(resp) {
    if (!resp || typeof resp !== 'object') return null;
    if ('data' in resp) return resp.data;
    return resp;
  }

  // v0.9.0：把 i智慧 Pro 的空值 sentinel（DOM 上顯示為 "--"）當作未填處理，
  // 讓 pick 繼續往下找 key；若全部 key 都是 sentinel，回 null（空字串傳回 CRM）。
  const EMPTY_SENTINELS = new Set(['--', '—', '－', '-']);
  function isEmptyVal(v) {
    if (v == null) return true;
    if (typeof v !== 'string') return false;
    const s = v.trim();
    return s === '' || EMPTY_SENTINELS.has(s);
  }

  function pickShallow(obj, keys) {
    if (!obj || typeof obj !== 'object') return null;
    for (const k of keys) {
      if (k in obj && !isEmptyVal(obj[k])) return obj[k];
    }
    return null;
  }

  function pickDeep(obj, keys) {
    if (!obj || typeof obj !== 'object') return null;
    const shallow = pickShallow(obj, keys);
    if (!isEmptyVal(shallow)) return shallow;
    for (const v of Object.values(obj)) {
      if (v && typeof v === 'object') {
        const r = pickDeep(v, keys);
        if (!isEmptyVal(r)) return r;
      }
    }
    return null;
  }

  // v0.9.2：判斷 search item 裡是否有任一頂層字串/數字欄位精準等於 target。
  // 用來把 i智慧 模糊比對（子字串 keyWord）抓回的雜訊濾掉 — 真物件編號是 7 碼帶
  // leading zero，幾乎不會跟其他欄位（樓層/坪數/版號等）撞值。
  function itemHasExactValue(item, target) {
    if (!item || typeof item !== 'object') return false;
    const t = String(target).trim();
    if (!t) return false;
    for (const v of Object.values(item)) {
      if (v == null || typeof v === 'object') continue;
      if (String(v).trim() === t) return true;
    }
    return false;
  }

  // 從 searchItem + detail 掃所有頂層欄位，凡 6~9 位純數字且不等於輸入對外編號
  // 的值都算候選；回傳第一個候選 + 完整候選清單（供排錯）。
  function findInternalCaseIdx(searchItem, detail, inputCaseNumber) {
    const merged = Object.assign({}, detail || {}, searchItem || {});
    const candidates = [];
    const inputTrimmed = String(inputCaseNumber || '').trim();
    for (const [k, v] of Object.entries(merged)) {
      if (v == null) continue;
      if (typeof v === 'object') continue;
      const s = String(v).trim();
      if (!/^\d{6,9}$/.test(s)) continue;
      if (s === inputTrimmed) continue;
      candidates.push({ key: k, val: s });
    }
    LOG('ycutCaseIdx candidates', candidates);
    return {
      value: candidates.length ? candidates[0].val : null,
      candidates,
    };
  }

  // v0.8.0：啟發式判斷「看起來像案名/行銷文案，不是社區名」
  // 採保守策略：只殺高訊號詞彙 + 明顯過長，避免誤殺真社區名
  //   - 真社區名含「公寓/透天」字樣（如「XX公寓大廈」）是可能的 → 不納入殺詞
  //   - 真社區名罕見「稀有/翻新/市場/商圈/學區/樓中樓」→ 納入殺詞
  //   - 真社區名長度通常 ≤ 15 字；行銷文案常 20+ 字
  function looksLikeProjectTitle(s) {
    if (!s) return false;
    const str = String(s).trim();
    if (!str) return false;
    const KILLWORDS = ['稀有', '翻新', '市場', '商圈', '學區', '樓中樓', '↑', '↓'];
    if (KILLWORDS.some(w => str.includes(w))) return true;
    if (str.includes('/')) return true;        // 真社區名幾乎不含「/」
    if (str.length > 20) return true;          // 過長即行銷文案
    return false;
  }

  function parseFloor(text) {
    if (text == null) return '';
    const s = String(text);
    const m = s.match(/(-?[0-9]+)\s*樓/);
    if (m) return m[1] + '樓';
    const n = s.match(/^\s*(-?[0-9]+)\s*F?\s*$/i);
    if (n) return n[1] + '樓';
    return s.trim();
  }

  function buildFloorText(data) {
    if (!data || typeof data !== 'object') return '';
    const st = data.floorSt ?? data.FloorSt;
    const en = data.floorEn ?? data.FloorEn;
    const up = data.upFloor ?? data.UpFloor;
    if (st != null) {
      const base = (en != null && en !== st) ? `${st}-${en}樓` : `${st}樓`;
      return up != null ? `${base}/共${up}樓` : base;
    }
    return '';
  }

  // 把物件裡所有 UUID 連 path 一起列出來，方便 debug 哪個 key 才是真正的 caseId
  // (只用於 debug log，取 UUID 走 pickShallow — 禁止 deep scan，見 G16)
  function findAllUuids(obj, path = '', out = []) {
    if (obj == null) return out;
    if (typeof obj === 'string') {
      const m = obj.match(UUID_RE);
      if (m) out.push({ path: path || '(root)', uuid: m[0] });
      return out;
    }
    if (Array.isArray(obj)) {
      obj.forEach((item, i) => findAllUuids(item, `${path}[${i}]`, out));
      return out;
    }
    if (typeof obj === 'object') {
      for (const [k, v] of Object.entries(obj)) {
        findAllUuids(v, path ? `${path}.${k}` : k, out);
      }
    }
    return out;
  }

  async function resolveCaseUuid(input) {
    const trimmed = String(input || '').trim();
    if (!trimmed) throw new Error('empty_input');

    const uuidMatch = trimmed.match(UUID_RE);
    if (uuidMatch) {
      LOG('input contains UUID — skipping search', uuidMatch[0]);
      return { uuid: uuidMatch[0], searchItem: null };
    }

    const caseNumber = trimmed.replace(/[^A-Za-z0-9-]/g, '');
    if (!caseNumber) throw new Error('invalid_input');

    const searchResp = await gmPost(API_BASE + '/api/Case/Circulating/List', buildSearchBody(caseNumber));
    LOG('search response', searchResp);

    const searchData = unwrap(searchResp);
    const items = pickShallow(searchData, ['caseList', 'CaseList', 'items', 'Items', 'list', 'List', 'result', 'Result'])
      || (Array.isArray(searchData) ? searchData : null)
      || (Array.isArray(searchResp) ? searchResp : null);
    const itemList = Array.isArray(items) ? items : [];

    // v0.9.2：i智慧 keyWord 是子字串模糊比對 — 拿回多筆時必須挑「某欄位精準等於輸入」
    // 的那筆，否則 4 碼輸入會撈到任意含該 4 碼的 7 碼物件。
    const matchedItem = itemList.find((it) => itemHasExactValue(it, caseNumber)) || null;

    console.log('[B6 search data]', searchData);
    console.log('[B6 search items count]', itemList.length);
    if (matchedItem) {
      console.log('[B6 matchedItem keys]', Object.keys(matchedItem));
      console.log('[B6 matchedItem]', matchedItem);
      console.log('[B6 matchedItem UUIDs]', findAllUuids(matchedItem));
    } else if (itemList.length > 0) {
      console.log('[B6 fuzzy noise] input=', caseNumber, '無精準對齊的 item — 視同 not_found；items=', itemList);
    }


    // G16: 只從 data.items[0] 的 caseKey 系列 key 取 UUID；
    // 禁止 deep scan / envelope fallback（會撈到響應 metadata 的 `id`，那不是 caseId）。
    if (!matchedItem) throw new Error('case_not_found');

    const fromKey = pickShallow(matchedItem, [
      'caseKey', 'CaseKey',
      'caseId', 'CaseId', 'caseUuid', 'CaseUuid', 'caseGuid', 'CaseGuid',
    ]);
    if (fromKey && UUID_RE.test(String(fromKey))) {
      return { uuid: String(fromKey).match(UUID_RE)[0], searchItem: matchedItem };
    }

    throw new Error('case_not_found');
  }

  async function handleLookup(msg) {
    const requestId = msg.requestId;
    const reply = (payload) => {
      pageWindow.postMessage(Object.assign({ type: 'CRM_ISMART_LOOKUP_RESULT', requestId }, payload), '*');
    };

    try {
      const { uuid, searchItem } = await resolveCaseUuid(msg.caseNumber);
      LOG('resolved UUID', uuid);

      const [detailResp, inChargeResp, shareUrlResp] = await Promise.all([
        gmGet(API_BASE + '/api/Case/Info/Detail/' + uuid).catch((e) => ({ __error: e })),
        gmGet(API_BASE + '/api/Case/Info/InCharge/' + uuid).catch((e) => ({ __error: e })),
        gmGet(API_BASE + '/api/Case/Info/ShareUrl/' + uuid).catch((e) => ({ __error: e })),
      ]);

      LOG('detail', detailResp);
      LOG('inCharge', inChargeResp);
      LOG('shareUrl', shareUrlResp);

      for (const resp of [detailResp, inChargeResp, shareUrlResp]) {
        if (resp && resp.__error && isAuthError(resp.__error)) {
          return reply({ ok: false, error: 'auth_expired', message: '請先在另一個分頁登入 i智慧' });
        }
      }

      const detail   = (detailResp   && !detailResp.__error)   ? unwrap(detailResp)   : null;
      const inCharge = (inChargeResp && !inChargeResp.__error) ? unwrap(inChargeResp) : null;
      const share    = (shareUrlResp && !shareUrlResp.__error) ? unwrap(shareUrlResp) : null;

      console.log('[B6 detail keys]', detail ? Object.keys(detail) : null, detail);

      const staff = inCharge ? (inCharge.mStaff || inCharge.MStaff || inCharge.dStaff || inCharge.DStaff) : null;

      // v0.9.0：對齊 i智慧 Pro 的 <dd>社區名稱</dd> 規則 ——
      //   真社區 → 顯示社區名稱（如「生活大亨」/「遠東麗市」/「皇家水晶晶NO2透天區」）
      //   無社區（公寓/透天）→ 顯示 "--"
      // SPA 的 "--" 必然來自 API 某個欄位（typically null/empty），pickShallow 已把常見 sentinel
      // ("--"/"—"/"－"/"-"/空白) 當 empty 跳過，所以 pickDeep 全部 miss → 回空字串。
      // 若某 UUID 仍撈到案名，按 F12 看 [B6 detail keys] + [B6 communityName picked] log，把 JSON 貼回來就能鎖定 key。
      const COMMUNITY_KEYS = [
        'buildingName', 'BuildingName',
        'communityName', 'CommunityName', 'societyName', 'SocietyName',
        '社區名稱', '社區',
      ];
      const communityFromDetail = pickDeep(detail, COMMUNITY_KEYS);
      const communityFromSearch = pickDeep(searchItem, COMMUNITY_KEYS);
      const communityNameRaw = communityFromDetail || communityFromSearch;
      console.log('[B6 communityName picked]', {
        fromDetail: communityFromDetail,
        fromSearch: communityFromSearch,
        final: communityNameRaw,
      });
      // 輔助啟發式：API 若仍吐行銷文案（如 key 名變動、或資料品質不佳），過濾掉。
      // 只殺高訊號的行銷詞 / 長度，避免誤殺真社區名（如「XX公寓大廈」這種含「公寓」字但確實是社區的）。
      const communityName = looksLikeProjectTitle(communityNameRaw) ? '' : communityNameRaw;

      const floorText =
        buildFloorText(detail)
        || pickDeep(detail, [
          'floorDisplay', 'FloorDisplay', 'mainFloorText', 'MainFloorText',
          'floor', 'Floor', 'mainFloor', 'MainFloor',
          'floorText', 'FloorText', 'floorStr', 'FloorStr',
          '樓層', '主要樓層',
        ])
        || buildFloorText(searchItem)
        || '';

      const agentName = pickDeep(staff, [
        'empName', 'EmpName',
        'agentName', 'AgentName', 'name', 'Name', 'inChargeName', 'InChargeName',
        '姓名', '承辦人',
      ]);

      const agentPhoneRaw = pickDeep(staff, [
        'mobile', 'Mobile', 'cellphone', 'Cellphone', 'cellPhone', 'CellPhone',
        'phone', 'Phone', 'agentPhone', 'AgentPhone', 'contactPhone', 'ContactPhone',
        '手機', '電話', '行動電話',
      ]);

      const shareUrlValue = pickDeep(share, [
        'shortenUrl', 'ShortenUrl', 'shortUrl', 'ShortUrl',
        'guidUrl', 'GuidUrl', 'shareUrl', 'ShareUrl',
        'url', 'Url', 'URL',
      ]);

      // 地址：從 Detail 挑可能的 key；含「號」才視為完整 → 帶入地點欄
      const addressRaw = pickDeep(detail, [
        'address', 'Address',
        'fullAddress', 'FullAddress',
        'caseAddress', 'CaseAddress',
        'houseAddress', 'HouseAddress',
        'presentAddress', 'PresentAddress',
        'showAddress', 'ShowAddress',
        'displayAddress', 'DisplayAddress',
        'addressStr', 'AddressStr',
        'addressDisplay', 'AddressDisplay',
        'addr', 'Addr',
        '地址',
      ]);
      const addressStr = addressRaw ? String(addressRaw).trim() : '';
      const addressComplete = addressStr.includes('號');
      const addressValue = addressComplete ? addressStr : '';

      // 列印頁 URL 用的 i智慧 內部 caseIdx（不同於對外物件編號、也不同於 caseKey UUID）
      // v0.7.0：改用 value-based scan（猜 key 名稱行不通，12 候選全 miss）
      const { value: ycutCaseIdx, candidates: ycutCaseIdxCandidates } =
        findInternalCaseIdx(searchItem, detail, msg.caseNumber);
      LOG('ycutCaseIdx', ycutCaseIdx, 'from', ycutCaseIdxCandidates.length, 'candidates');

      const missing = [];
      if (!communityName)   missing.push('社區');
      if (!floorText)       missing.push('樓層');
      if (!agentName)       missing.push('同事名');
      if (!agentPhoneRaw)   missing.push('同事手機');
      if (!shareUrlValue)   missing.push('永慶連結');

      const anyFound = communityName || floorText || agentName || agentPhoneRaw || shareUrlValue;
      if (!anyFound) {
        return reply({
          ok: false,
          error: 'mapping_failed',
          message: 'API 回應取不到欄位，請按 F12 看 Console 把 log 貼給開發者',
        });
      }

      return reply({
        ok: true,
        data: {
          caseUuid: uuid,
          ycutCaseIdx,
          ycutCaseIdxCandidates,
          communityName: communityName ? String(communityName) : '',
          floor: floorText ? (floorText.includes('樓') ? floorText : parseFloor(floorText)) : '',
          shareUrl: shareUrlValue ? String(shareUrlValue) : '',
          agentName: agentName ? String(agentName) : '',
          agentPhone: agentPhoneRaw ? String(agentPhoneRaw).replace(/[\s\-().]/g, '') : '',
          address: addressValue,
          addressRaw: addressStr,
          addressComplete,
        },
        missing: missing.length ? missing : undefined,
      });
    } catch (e) {
      console.error('[CRM×i智慧] lookup failed', e);
      if (isAuthError(e)) return reply({ ok: false, error: 'auth_expired', message: '請先在另一個分頁登入 i智慧' });
      if (e.message === 'empty_input' || e.message === 'invalid_input') {
        return reply({ ok: false, error: 'invalid_input', message: '請輸入 i智慧 物件編號或 detail URL' });
      }
      if (e.message === 'not_found' || e.message === 'case_not_found') {
        return reply({ ok: false, error: 'case_not_found', message: '找不到這個編號，請檢查' });
      }
      return reply({ ok: false, error: 'network_error', message: e.message || '網路錯誤' });
    }
  }

  pageWindow.addEventListener('message', function (event) {
    if (event.source !== pageWindow) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'CRM_ISMART_PING') {
      pageWindow.postMessage({ type: 'CRM_ISMART_PONG', version: VERSION }, '*');
      return;
    }
    if (data.type !== 'CRM_ISMART_LOOKUP') return;
    handleLookup(data);
  });

  pageWindow.postMessage({ type: 'CRM_ISMART_PONG', version: VERSION }, '*');
  LOG('userscript loaded v' + VERSION);
})();
