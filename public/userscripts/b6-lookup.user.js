// ==UserScript==
// @name         CRM × i智慧 物件自動帶入 (B6)
// @namespace    https://coprime5231-crm.zeabur.app/
// @version      0.4.0
// @description  在 CRM 新增帶看 Modal 輸入 i智慧 物件編號或 detail URL → 自動帶入社區、地點、永慶連結、同事、同事手機（地址含「號」才帶）
// @author       coprime5231
// @match        https://coprime5231-crm.zeabur.app/marketing*
// @match        http://localhost:3000/marketing*
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
  const VERSION = '0.4.0';
  // Tampermonkey 沙箱：跨 context 訊息必須走 unsafeWindow 才能抵達頁面 window
  const pageWindow = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  const COMMON_HEADERS = {
    'Accept': 'application/json, text/plain, */*',
    'websitename': 'IntegrationService_WS',
  };
  const LOG = (...args) => console.log('[CRM×i智慧]', ...args);

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
        searchType: 'S',
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

  function pickShallow(obj, keys) {
    if (!obj || typeof obj !== 'object') return null;
    for (const k of keys) {
      if (k in obj && obj[k] != null && obj[k] !== '') return obj[k];
    }
    return null;
  }

  function pickDeep(obj, keys) {
    if (!obj || typeof obj !== 'object') return null;
    const shallow = pickShallow(obj, keys);
    if (shallow != null && shallow !== '') return shallow;
    for (const v of Object.values(obj)) {
      if (v && typeof v === 'object') {
        const r = pickDeep(v, keys);
        if (r != null && r !== '') return r;
      }
    }
    return null;
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

  function findUuid(obj) {
    if (obj == null) return null;
    if (typeof obj === 'string') {
      const m = obj.match(UUID_RE);
      return m ? m[0] : null;
    }
    if (Array.isArray(obj)) {
      for (const item of obj) {
        const u = findUuid(item);
        if (u) return u;
      }
      return null;
    }
    if (typeof obj === 'object') {
      for (const v of Object.values(obj)) {
        const u = findUuid(v);
        if (u) return u;
      }
    }
    return null;
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
    const firstItem = Array.isArray(items) && items.length > 0 ? items[0] : null;

    if (firstItem) {
      const fromKey = pickShallow(firstItem, [
        'caseKey', 'CaseKey',
        'caseId', 'CaseId', 'caseUuid', 'CaseUuid', 'caseGuid', 'CaseGuid',
        'id', 'Id', 'uuid', 'Uuid', 'guid', 'Guid',
      ]);
      if (fromKey && UUID_RE.test(String(fromKey))) {
        return { uuid: String(fromKey).match(UUID_RE)[0], searchItem: firstItem };
      }
      const deep = findUuid(firstItem);
      if (deep) return { uuid: deep, searchItem: firstItem };
    }

    const anyUuid = findUuid(searchResp);
    if (anyUuid) return { uuid: anyUuid, searchItem: null };

    throw new Error('not_found');
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

      const staff = inCharge ? (inCharge.mStaff || inCharge.MStaff || inCharge.dStaff || inCharge.DStaff) : null;

      const communityName =
        pickDeep(detail, [
          'buildingName', 'BuildingName',
          'communityName', 'CommunityName', 'societyName', 'SocietyName',
          'propertyName', 'PropertyName', 'caseName', 'CaseName',
          '社區名稱', '社區',
        ])
        || pickDeep(searchItem, [
          'buildingName', 'BuildingName',
          'communityName', 'CommunityName', 'societyName', 'SocietyName',
          'propertyName', 'PropertyName', 'caseName', 'CaseName',
        ]);

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
      if (e.message === 'not_found') {
        return reply({ ok: false, error: 'not_found', message: '找不到這個編號，請檢查' });
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
