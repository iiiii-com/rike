/* SECTION: core-engine —— 存储、日期、连续天数、积分、徽章、周报/月报/年报、自然语言解析、时段分析与智能教练（纯计算） */
'use strict';
const TTCore = (() => {
  const KEY = 'tt-st…e-v3';
  const ALL_OLD = [
    'tt-st…e-v2', /* 修复前版本写入的键 */
    'tt-st…e-v1', /* v1 写入的键 */
  ];
  const D = window.TTData;

  /* ---------- 日期工具（本地时区，YYYY-MM-DD） ---------- */
  const pad = n => (n < 10 ? '0' : '') + n;
  const dateStr = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parseDate = s => { const p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
  const addDays = (d, n) => { const x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; };
  const todayStr = () => dateStr(new Date());
  const diffDays = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 86400000);
  const monthKey = s => s.slice(0, 7);
  const weekStart = d => addDays(d, -((d.getDay() + 6) % 7));
  const catOf = id => D.CATEGORIES.find(c => c.id === id) || D.CATEGORIES[4];

  /* ---------- 默认状态（v3：records 为 {v, mk, at, att, note} 结构） ---------- */
  const freshState = () => ({
    version: 3,
    tasks: [],
    records: {},              // taskId -> { 'YYYY-MM-DD': {v, mk, at, att, note} }
    meta: {
      onboarded: false, theme: 'auto', themeId: 'warm', encIdx: -1,
      restDays: [], checkTimes: {},
      notif: { morning: true, evening: true, streak: true, weekly: true },
      sound: false,           // 打卡音效（默认关，尊重安静场景）
      demo: false,
      seen: {}, lastVisit: '', welcomeShown: '', fatigueDismiss: '',
      weeklySent: {}, monthlySent: {}, pro: null, partnerLog: [], spent: 0,
      unlockLog: {},          // 徽章 id -> 达成日期
      surprise: { lastDay: '', count: 0, bonusTotal: 0 },
      coach: { date: '', type: '' },
      challenge: { date: '', id: '', done: false, total: 0, skipDay: '', history: [] },
      restartDate: '',        // 断签后重启的日期（重新出发徽章/里程碑）
      lastBackup: '',         // 上次自动备份日期
      proofCount: 0           // 累计附凭证次数（凭证徽章）
    }
  });

  /* 记录归一化：把旧值补成 {v, mk, at, att, note} */
  const normRec = r => (r && typeof r === 'object' && 'v' in r)
    ? { v: r.v, mk: !!r.mk, at: r.at || '', att: r.att || '', note: r.note || '' }
    : { v: 1, mk: r === 2, at: '', att: '', note: '' };

  const migrate = s => {
    Object.keys(s.records || {}).forEach(tid => {
      const m = s.records[tid];
      Object.keys(m).forEach(ds => { m[ds] = normRec(m[ds]); });
    });
    s.meta = Object.assign(freshState().meta, s.meta || {});
    s.meta.notif = Object.assign(freshState().meta.notif, (s.meta && s.meta.notif) || {});
    s.meta.surprise = Object.assign({ lastDay: '', count: 0, bonusTotal: 0 }, s.meta.surprise || {});
    s.meta.coach = Object.assign({ date: '', type: '' }, s.meta.coach || {});
    s.meta.challenge = Object.assign({ date: '', id: '', done: false, total: 0, skipDay: '', history: [] }, s.meta.challenge || {});
    if (!Array.isArray(s.meta.challenge.history)) s.meta.challenge.history = [];
    s.version = 3;
    return s;
  };

  let state = null;
  let hadLocal = false;        // 本次 load 是否命中了 localStorage 有效数据
  let lastSaveError = null;    // localStorage 写入异常（配额等），UI 可提示
  const IDB = window.TTIDB;    // IndexedDB 兜底存储（凭证、镜像、备份）

  /* 旧键可能含特殊字符，统一用前缀扫描迁移，不依赖字面量匹配 */
  const findLegacy = () => {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k !== KEY && /^tt-st/.test(k)) return k;
      }
    } catch (e) {}
    return null;
  };
  const purgeLegacy = () => {
    try {
      const olds = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k !== KEY && /^tt-st/.test(k)) olds.push(k);
      }
      olds.forEach(k => localStorage.removeItem(k));
    } catch (e) {}
  };
  const load = () => {
    hadLocal = false;
    try {
      let raw = localStorage.getItem(KEY), legacy = null;
      if (!raw) {
        legacy = findLegacy();
        if (legacy) raw = localStorage.getItem(legacy);
      }
      if (raw) {
        const s = JSON.parse(raw);
        if (s && Array.isArray(s.tasks)) {
          state = migrate(s);
          hadLocal = true;
          save();
          if (legacy) localStorage.removeItem(legacy);
          return;
        }
      }
    } catch (e) { /* 损坏则暂不重建，等 IDB 兜底 */ }
    state = freshState();
    hadLocal = false;
    save();
  };
  /* localStorage 缺失或损坏时，从 IndexedDB 镜像恢复（数据防丢失主路径） */
  const loadFromIDB = () => {
    if (!IDB || !IDB.available) return Promise.resolve(false);
    return IDB.getState('main').then(m => {
      if (m && Array.isArray(m.tasks)) {
        state = migrate(m);
        save();
        return true;
      }
      return false;
    }).catch(() => false);
  };
  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); lastSaveError = null; }
    catch (e) { lastSaveError = (e && (e.name || String(e))) || 'unknown'; }
    /* 每次写入同步镜像到 IndexedDB（不含大凭证图，体积小、写得起） */
    if (IDB && IDB.available && state) { try { IDB.putState('main', state); } catch (e) {} }
  };
  const get = () => state;
  const hadData = () => hadLocal;
  const getSaveError = () => lastSaveError;

  /* ---------- 任务模型 ---------- */
  const uid = () => 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const addTask = t => {
    const task = Object.assign({
      id: uid(), type: 'habit', freq: 'daily', weekDays: [1, 2, 3, 4, 5, 6, 0],
      cat: 'life', remind: '', target: '', priority: 'mid',
      why: '', unit: '', goal: 0, deadline: '', diff: 2, note: '',
      needProof: false,            // 需要材料凭证才能打卡
      startDate: todayStr(), status: 'active', createdAt: todayStr()
    }, t);
    state.tasks.push(task); save(); return task;
  };
  const updateTask = (id, patch) => {
    const t = state.tasks.find(x => x.id === id);
    if (t) { Object.assign(t, patch); save(); }
    return t;
  };
  const setTaskStatus = (id, status) => updateTask(id, { status });
  const deleteTask = id => {
    state.tasks = state.tasks.filter(x => x.id !== id);
    delete state.records[id]; save();
  };
  const taskById = id => state.tasks.find(x => x.id === id);
  const isProgressive = t => !!(t && t.unit && +t.goal > 0);

  const scheduledOn = (task, ds) => {
    if (task.status !== 'active') return false;
    if (task.freq === 'anytime' || task.freq === 'once') return false;
    if (ds < task.startDate) return false;
    if (task.deadline && ds > task.deadline) return false;
    if (task.freq === 'daily') return true;
    if (task.freq === 'weekly') return task.weekDays.includes(parseDate(ds).getDay());
    return false;
  };

  /* ---------- 打卡（含累积量与时间戳） ---------- */
  const recOf = (taskId, ds) => { const r = state.records[taskId]; return r && r[ds] ? r[ds] : null; };
  const progressOf = (taskId, ds) => { const r = recOf(taskId, ds); return r ? r.v : 0; };
  const isMakeup = (taskId, ds) => { const r = recOf(taskId, ds); return !!(r && r.mk); };
  const checkedOn = (taskId, ds) => {
    const r = recOf(taskId, ds);
    if (!r) return false;
    const t = taskById(taskId);
    if (t && t.needProof && !r.att) return false;   /* 要求材料证明：未附证不算完成 */
    if (t && isProgressive(t)) return r.v >= +t.goal - 1e-6;
    return true;
  };
  /* 待凭证状态：有打卡意图（记录存在/量已推）但缺凭证 */
  const pendingProof = (taskId, ds) => {
    const t = taskById(taskId);
    if (!t || !t.needProof) return false;
    const r = recOf(taskId, ds);
    return !!(r && !r.att);
  };
  const isChecked = ds => state.tasks.some(t => checkedOn(t.id, ds)) || state.meta.restDays.includes(ds);

  const ensureRec = taskId => { if (!state.records[taskId]) state.records[taskId] = {}; return state.records[taskId]; };
  const stampAt = () => { const n = new Date(); return pad(n.getHours()) + ':' + pad(n.getMinutes()); };
  const markTime = (ds, atStr) => {
    if (ds === todayStr()) {
      const h = +(atStr || stampAt()).split(':')[0];
      (state.meta.checkTimes[ds] = state.meta.checkTimes[ds] || []).push(h);
    }
  };

  const checkin = (taskId, ds, makeup, att, note) => {
    const t = taskById(taskId);
    if (!t) return false;
    const r = ensureRec(taskId);
    const at = makeup ? '' : stampAt();
    const hadAtt = !!(r[ds] && r[ds].att);
    const keepAtt = att !== undefined ? att : (r[ds] ? r[ds].att : '');
    const keepNote = note !== undefined ? note : (r[ds] ? r[ds].note : '');
    r[ds] = { v: isProgressive(t) ? +t.goal : 1, mk: !!makeup, at, att: keepAtt || '', note: keepNote || '' };
    if (keepAtt && !hadAtt) state.meta.proofCount = (state.meta.proofCount || 0) + 1;
    if (!makeup) markTime(ds, at);
    /* 一次性任务：自动把开始日期挪到打卡当天 */
    if (t.freq === 'once' && t.startDate > ds) { t.startDate = ds; }
    /* 断签后重启检测：今天成为新连续段第 1 天，且历史上存在 >=3 天的旧最佳 */
    if (!makeup && currentStreak() === 1 && bestStreak() >= 3 &&
        (!state.meta.restartDate || diffDays(state.meta.restartDate, ds) > 2)) {
      state.meta.restartDate = ds;
    }
    save();
    return true;
  };
  const setProof = (taskId, ds, att) => {
    const r = recOf(taskId, ds);
    if (!r) return false;
    const had = !!r.att;
    r.att = att || '';
    if (att && !had) state.meta.proofCount = (state.meta.proofCount || 0) + 1;
    save();
    return true;
  };
  const setNote = (taskId, ds, note) => {
    const r = recOf(taskId, ds);
    if (!r) return false;
    r.note = note || '';
    save();
    return true;
  };
  const uncheck = (taskId, ds) => {
    if (state.records[taskId]) { delete state.records[taskId][ds]; save(); }
  };
  const bump = (taskId, ds, delta) => {
    const t = taskById(taskId);
    if (!t || !isProgressive(t)) return null;
    const r = ensureRec(taskId);
    const cur = r[ds] ? r[ds].v : 0;
    const goal = +t.goal;
    const v = Math.max(0, Math.min(goal, cur + delta));
    if (v <= 1e-6) { delete r[ds]; save(); return { done: false, v: 0, goal }; }
    if (!r[ds]) r[ds] = { v: 0, mk: ds !== todayStr(), at: '', att: '', note: '' };
    r[ds].v = v;
    if (!r[ds].mk && ds !== todayStr()) r[ds].mk = true;
    const done = v >= goal - 1e-6;
    if (done) { const at = stampAt(); r[ds].at = at; markTime(ds, at); }
    save();
    return { done, v, goal };
  };
  const setRecord = (taskId, ds, v) => {
    const t = taskById(taskId);
    if (!t) return false;
    const r = ensureRec(taskId);
    const mk = ds !== todayStr();
    const prev = r[ds];
    r[ds] = { v, mk, at: mk ? (prev && prev.at) || '' : stampAt(), att: (prev && prev.att) || '', note: (prev && prev.note) || '' };
    if (checkedOn(taskId, ds)) markTime(ds, r[ds].at);
    save();
    return true;
  };

  const restQuota = () => 2;
  const restUsed = ds => state.meta.restDays.filter(x => monthKey(x) === monthKey(ds)).length;
  const restLeft = ds => isPro() ? Infinity : Math.max(0, restQuota() - restUsed(ds));
  const takeRestDay = ds => {
    if (restLeft(ds) <= 0) return false;
    if (!state.meta.restDays.includes(ds)) { state.meta.restDays.push(ds); save(); }
    return true;
  };

  /* ---------- 音效开关 ---------- */
  const setSound = on => { state.meta.sound = !!on; save(); };

  /* ---------- Pro 订阅（模拟支付） ---------- */
  const isPro = () => {
    const p = state.meta.pro;
    return !!(p && p.expiresAt && new Date(p.expiresAt) > new Date());
  };
  const activatePro = plan => {
    const days = plan === 'yearly' ? 365 : 30;
    const now = new Date();
    state.meta.pro = { plan, startedAt: now.toISOString(), expiresAt: addDays(now, days).toISOString() };
    save();
  };
  const cancelPro = () => { state.meta.pro = null; save(); };
  const proDaysLeft = () => {
    const p = state.meta.pro;
    if (!isPro()) return 0;
    return Math.max(0, Math.ceil((new Date(p.expiresAt) - new Date()) / 86400000));
  };

  /* ---------- 连续天数 ---------- */
  const goodDays = () => {
    const set = new Set(state.meta.restDays);
    Object.keys(state.records).forEach(tid =>
      Object.keys(state.records[tid]).forEach(d => { if (checkedOn(tid, d)) set.add(d); }));
    return set;
  };
  const currentStreak = () => {
    const g = goodDays();
    const today = todayStr();
    let anchor = today;
    if (!g.has(today)) anchor = dateStr(addDays(parseDate(today), -1));
    let n = 0, d = parseDate(anchor);
    while (g.has(dateStr(d))) { n++; d = addDays(d, -1); }
    return n;
  };
  const bestStreak = () => {
    const arr = Array.from(goodDays()).sort();
    let best = 0, run = 0;
    for (let i = 0; i < arr.length; i++) {
      if (i > 0 && diffDays(arr[i - 1], arr[i]) === 1) run++; else run = 1;
      if (run > best) best = run;
    }
    return best;
  };

  /* ---------- 统计推导 ---------- */
  const allCheckins = () => {
    const list = [];
    Object.keys(state.records).forEach(tid =>
      Object.keys(state.records[tid]).forEach(ds => {
        if (checkedOn(tid, ds)) {
          const r = state.records[tid][ds];
          list.push({ taskId: tid, ds, makeup: !!r.mk, v: r.v, at: r.at || '' });
        }
      }));
    return list.sort((a, b) => a.ds < b.ds ? -1 : 1);
  };
  const totalCheckins = () => allCheckins().length;

  const perfectDays = () => {
    const map = {};
    allCheckins().forEach(c => { map[c.ds] = (map[c.ds] || 0) + 1; });
    let n = 0;
    Object.keys(map).forEach(ds => {
      const due = state.tasks.filter(t => scheduledOn(t, ds));
      if (due.length >= 2 && due.every(t => checkedOn(t.id, ds))) n++;
    });
    return n;
  };
  const perfectWeeks = () => {
    const g = goodDays();
    const arr = Array.from(g).sort();
    if (!arr.length) return 0;
    let n = 0;
    for (let i = 0; i < arr.length; i++) {
      let run = 1;
      while (i + run < arr.length && diffDays(arr[i + run - 1], arr[i + run]) === 1) run++;
      if (run >= 7) n += Math.floor(run / 7);
      i += run - 1;
    }
    return n;
  };
  const taskCount = id => {
    const r = state.records[id];
    if (!r) return 0;
    return Object.keys(r).filter(ds => checkedOn(id, ds)).length;
  };

  const stats = () => {
    const cl = allCheckins();
    const cats = new Set();
    let maxTask = 0;
    const monthDays = {};
    const daySet = new Set();
    cl.forEach(c => {
      const t = taskById(c.taskId);
      if (t) cats.add(t.cat);
      daySet.add(c.ds);
      (monthDays[monthKey(c.ds)] = monthDays[monthKey(c.ds)] || new Set()).add(c.ds);
    });
    state.tasks.forEach(t => { maxTask = Math.max(maxTask, taskCount(t.id)); });
    let maxMonthDays = 0;
    Object.keys(monthDays).forEach(m => { maxMonthDays = Math.max(maxMonthDays, monthDays[m].size); });
    /* 单日最大完成数（多线并进徽章） */
    const perDay = {};
    cl.forEach(c => { perDay[c.ds] = (perDay[c.ds] || 0) + 1; });
    const maxPerDay = Math.max(0, ...Object.values(perDay));
    return {
      total: cl.length, bestStreak: bestStreak(), currentStreak: currentStreak(),
      perfectWeeks: perfectWeeks(), maxTaskCount: maxTask, catsWithCheckins: cats.size,
      maxMonthDays, activeDays: daySet.size, perfectDays: perfectDays(),
      hasRestart: !!state.meta.restartDate, challenges: state.meta.challenge.total || 0,
      proofs: state.meta.proofCount || 0, busyDay: maxPerDay >= 5
    };
  };

  const rateBetween = (fromDs, toDs) => {
    let due = 0, done = 0;
    let d = parseDate(fromDs);
    const end = parseDate(toDs);
    for (let g = 0; g < 800 && d <= end; d = addDays(d, 1), g++) {
      const ds = dateStr(d);
      state.tasks.forEach(t => {
        if (scheduledOn(t, ds)) { due++; if (checkedOn(t.id, ds)) done++; }
      });
    }
    return { due, done, rate: due ? done / due : null };
  };

  const fatigueSignal = () => {
    if (totalCheckins() < 8) return null;
    const today = todayStr();
    const recent = rateBetween(dateStr(addDays(parseDate(today), -13)), today).rate;
    const prior = rateBetween(dateStr(addDays(parseDate(today), -27)), dateStr(addDays(parseDate(today), -14))).rate;
    if (recent == null || prior == null) return null;
    if (recent < 0.35 || (prior - recent) >= 0.25) return { recent, prior };
    return null;
  };

  /* ---------- 积分 / 等级 / 徽章 ---------- */
  const bonusPoints = () => state.meta.surprise.bonusTotal || 0;
  const points = () => {
    let p = totalCheckins() * 5 + perfectDays() * 5 + stats().perfectWeeks * 10
      + (state.meta.challenge.total || 0) * 8;
    const best = bestStreak();
    Object.keys(D.MILESTONE_BONUS).forEach(th => { if (best >= +th) p += D.MILESTONE_BONUS[th]; });
    return p + bonusPoints() - (state.meta.spent || 0);
  };
  const levelOf = p => {
    let lv = D.LEVELS[0];
    D.LEVELS.forEach(l => { if (p >= l.min) lv = l; });
    const next = D.LEVELS.find(l => l.min > p);
    return { ...lv, next, progress: next ? (p - lv.min) / (next.min - lv.min) : 1 };
  };
  const earnedBadges = () => {
    const s = stats();
    s.hasWhy = state.tasks.some(t => t.why);
    s.reportViewed = !!state.meta.seen.reportYear;
    const list = D.BADGES.filter(b => { try { return b.test(s); } catch (e) { return false; } });
    list.forEach(b => { if (!state.meta.unlockLog[b.id]) state.meta.unlockLog[b.id] = todayStr(); });
    if (list.length) save();
    return list;
  };

  /* ---------- 鼓励语：轮换库 + 场景化 ---------- */
  const pickFrom = (arr, key) => {
    const store = state.meta;
    let i;
    do { i = Math.floor(Math.random() * arr.length); }
    while (arr.length > 1 && i === store['_' + key]);
    store['_' + key] = i;
    return arr[i];
  };
  const nextEncouragement = scene => {
    let txt;
    if (scene === 'first') txt = pickFrom(D.SCENE_ENC.first, 'sc_first');
    else if (scene === 'makeup') txt = pickFrom(D.SCENE_ENC.makeup, 'sc_mk');
    else if (scene === 'comeback') txt = pickFrom(D.SCENE_ENC.comeback, 'sc_cb');
    else if (scene === 'all') txt = pickFrom(D.SCENE_ENC.all, 'sc_all');
    else txt = pickFrom(D.ENCOURAGEMENTS, 'enc');
    save();
    return String(txt).replace('{day}', currentStreak() || 1);
  };

  /* ---------- 随机惊喜（变比率强化）：每日最多一次，约 8% 概率 ---------- */
  const rollSurprise = () => {
    const m = state.meta.surprise;
    if (m.lastDay === todayStr()) return null;
    if (Math.random() >= 0.08) return null;
    m.lastDay = todayStr();
    m.count = (m.count || 0) + 1;
    let res;
    if (Math.random() < 0.5) {
      const bonus = pickFrom(D.SURPRISE.bonus, 'sp_b');
      m.bonusTotal = (m.bonusTotal || 0) + bonus;
      res = { type: 'bonus', n: bonus, text: pickFrom(D.SURPRISE.lines, 'sp_l').replace('{n}', bonus) };
    } else {
      const e = pickFrom(D.SURPRISE.easter, 'sp_e');
      res = { type: 'easter', text: e.text, icon: e.icon };
    }
    save();
    return res;
  };

  /* ---------- 任务档案：单任务深度统计 ---------- */
  const taskStats = id => {
    const t = taskById(id);
    if (!t) return null;
    const rec = state.records[id] || {};
    const doneDays = Object.keys(rec).filter(ds => checkedOn(id, ds)).sort();
    const cnt = doneDays.length;
    const mkCnt = doneDays.filter(ds => rec[ds].mk).length;
    /* 该任务自身的连续（最长/当前） */
    let run = 0, best = 0;
    for (let i = 0; i < doneDays.length; i++) {
      if (i > 0 && diffDays(doneDays[i - 1], doneDays[i]) === 1) run++; else run = 1;
      if (run > best) best = run;
    }
    let cur = 0;
    if (cnt) {
      const last = doneDays[cnt - 1];
      if (diffDays(last, todayStr()) <= 1) {
        cur = 1;
        for (let i = cnt - 1; i > 0 && diffDays(doneDays[i - 1], doneDays[i]) === 1; i--) cur++;
      }
    }
    /* 月度节奏 */
    const mMap = {};
    doneDays.forEach(ds => { const m = monthKey(ds); mMap[m] = (mMap[m] || 0) + 1; });
    const months = Object.keys(mMap).sort().slice(-6).map(m => ({ m, n: mMap[m] }));
    /* 星期节奏：周一~周日完成次数 */
    const wd = [0, 0, 0, 0, 0, 0, 0];
    doneDays.forEach(ds => { wd[parseDate(ds).getDay()]++; });
    /* 时段：小时直方图（at = HH:MM） */
    const hours = new Array(24).fill(0);
    let atKnown = 0;
    doneDays.forEach(ds => {
      const at = rec[ds].at;
      if (at) { hours[+at.split(':')[0]]++; atKnown++; }
    });
    /* 平均完成量 */
    let avgV = null;
    if (isProgressive(t)) {
      const vs = doneDays.map(ds => rec[ds].v);
      avgV = vs.reduce((a, b) => a + b, 0) / vs.length;
    }
    /* 准时率（有提醒时间时：打卡时刻 <= 提醒+60min） */
    let onTime = null;
    if (t.remind && atKnown >= 3) {
      const limit = (+t.remind.split(':')[0]) * 60 + (+t.remind.split(':')[1]) + 60;
      let hit = 0, tot = 0;
      doneDays.forEach(ds => {
        const at = rec[ds].at;
        if (!at) return;
        tot++;
        if ((+at.split(':')[0]) * 60 + (+at.split(':')[1]) <= limit) hit++;
      });
      if (tot) onTime = Math.round(hit / tot * 100);
    }
    /* 近 12 周点阵（每格一天，含未来应做日） */
    const heat = [];
    const lastEnd = weekStart(new Date());
    const gStart = addDays(lastEnd, -11 * 7);
    for (let w = 0; w < 12; w++) {
      for (let r = 0; r < 7; r++) {
        const ds = dateStr(addDays(gStart, w * 7 + r));
        let st = 'idle';
        if (ds > todayStr()) st = scheduledOn(t, ds) ? 'future' : 'none';
        else if (rec[ds] && checkedOn(id, ds)) st = rec[ds].mk ? 'mk' : 'hit';
        else if (rec[ds]) st = 'part';
        else if (scheduledOn(t, ds)) st = 'miss';
        heat.push({ ds, st });
      }
    }
    /* 未来 7 天应做 */
    const future = [];
    for (let i = 1; i <= 7; i++) {
      const ds = dateStr(addDays(new Date(), i));
      if (scheduledOn(t, ds)) future.push(ds);
    }
    /* 日程强度：应做日占比 */
    const firstStart = t.startDate;
    let dueDays = 0;
    for (let d = parseDate(firstStart); dateStr(d) <= todayStr(); d = addDays(d, 1)) {
      if (scheduledOn(t, dateStr(d))) dueDays++;
    }
    const totalSpan = Math.max(1, diffDays(firstStart, todayStr()) + 1);
    return {
      t, cnt, mkCnt, best, cur, months, wd, hours, atKnown, avgV, onTime,
      heat, future, dueDays, totalSpan,
      density: dueDays ? Math.round(cnt / dueDays * 100) : 0,
      rate: dueDays ? Math.round(cnt / dueDays * 100) : 0,
      first: doneDays[0] || null, last: doneDays[cnt - 1] || null,
      spark: months.slice(-8).map(x => x.n)
    };
  };

  /* ---------- 每日小挑战（约三成天数出现；变比率强化 + 打破平淡） ---------- */
  const todayChallenge = () => {
    const m = state.meta.challenge, today = todayStr();
    if (m.skipDay === today) return null;
    if (m.date !== today) {
      const h = new Date();
      /* 以日期+天数为种子，保证同一天刷新结果稳定；约 3/10 的天数出现 */
      const seed = (+today.slice(8, 10) * 31 + h.getFullYear()) % 10;
      m.date = today; m.done = false;
      if (seed < 3) {
        const pool = D.CHALLENGES.filter(c => c.id !== m.id);
        m.id = pool[seed % pool.length].id;
      } else m.id = '';
      save();
    }
    if (!m.id) return null;
    const c = D.CHALLENGES.find(x => x.id === m.id);
    return c ? { id: c.id, text: c.t, done: !!m.done } : null;
  };
  const completeChallenge = () => {
    const m = state.meta.challenge;
    if (!m.id || m.done) return false;
    m.done = true; m.total = (m.total || 0) + 1;
    if (!Array.isArray(m.history)) m.history = [];
    m.history.unshift({ id: m.id, ds: todayStr() });
    if (m.history.length > 120) m.history.length = 120;
    save();
    return true;
  };
  const challengeHistory = () => state.meta.challenge.history || [];
  const skipChallenge = () => {
    const m = state.meta.challenge;
    m.skipDay = todayStr(); m.id = ''; save();
  };

  /* ---------- 可视化数据 ---------- */
  const dayLevel = ds => {
    const due = state.tasks.filter(t => scheduledOn(t, ds));
    const done = due.filter(t => checkedOn(t.id, ds)).length;
    const any = state.tasks.some(t => checkedOn(t.id, ds));
    if (state.meta.restDays.includes(ds) && !any) return 1;
    if (!due.length) return any ? 1 : 0;
    if (done === 0) return 0;
    return Math.min(4, Math.ceil((done / due.length) * 4));
  };
  const dayMakeup = ds => Object.keys(state.records).some(tid => {
    const r = state.records[tid][ds];
    return r && r.mk && checkedOn(tid, ds);
  });
  const dayRest = ds => state.meta.restDays.includes(ds) && !state.tasks.some(t => checkedOn(t.id, ds));

  const weeklyTrend = weeks => {
    const out = [];
    let ws = weekStart(new Date());
    const tds = todayStr();
    for (let i = 0; i < weeks; i++) {
      const s = dateStr(ws), e = dateStr(addDays(ws, 6));
      const r = rateBetween(s, e > tds ? tds : e);
      out.unshift({ label: (ws.getMonth() + 1) + '/' + ws.getDate(), rate: r.rate == null ? 0 : Math.round(r.rate * 100) });
      ws = addDays(ws, -7);
    }
    return out;
  };

  /* 连续天数曲线：回溯 N 周，每周取周内达到的连续峰值，并标记周内断点 */
  const streakHistory = weeks => {
    const g = Array.from(goodDays()).sort();
    const runs = [];
    let run = 0;
    for (let i = 0; i < g.length; i++) {
      if (i > 0 && diffDays(g[i - 1], g[i]) === 1) run++; else run = 1;
      runs.push({ ds: g[i], run });
    }
    const out = [];
    for (let i = weeks - 1; i >= 0; i--) {
      const ws = addDays(weekStart(new Date()), -7 * i);
      const we = addDays(ws, 6);
      let mx = 0, broke = false, prevIn = null;
      runs.forEach(r => {
        const d = parseDate(r.ds);
        if (d >= ws && d <= we) {
          mx = Math.max(mx, r.run);
          if (prevIn && diffDays(prevIn, r.ds) > 1) broke = true;
          prevIn = r.ds;
        }
      });
      if (i === 0) mx = Math.max(mx, currentStreak());
      out.push({ label: (ws.getMonth() + 1) + '/' + ws.getDate(), val: mx, broke });
    }
    return out;
  };

  const categoryRates = () => D.CATEGORIES.map(c => {
    const ts = state.tasks.filter(t => t.cat === c.id);
    if (!ts.length) return null;
    let due = 0, done = 0;
    ts.forEach(t => {
      let d = parseDate(t.startDate);
      const end = new Date();
      for (let g = 0; g < 400 && d <= end; d = addDays(d, 1), g++) {
        const ds = dateStr(d);
        if (scheduledOn(t, ds)) { due++; if (checkedOn(t.id, ds)) done++; }
      }
    });
    return { cat: c, rate: due ? Math.round(done / due * 100) : 0, done, due };
  }).filter(Boolean).sort((a, b) => b.rate - a.rate);

  const timeBuckets = () => {
    const b = { 早: 0, 午: 0, 傍晚: 0, 夜: 0 };
    Object.keys(state.meta.checkTimes).forEach(ds =>
      state.meta.checkTimes[ds].forEach(h => {
        if (h < 9) b['早']++; else if (h < 14) b['午']++; else if (h < 18) b['傍晚']++; else b['夜']++;
      }));
    return b;
  };
  /* 时段分析（基于打卡时间戳）：黄金时段 + 提醒时间建议 */
  const BUCKETS = [
    { id: 'morning', name: '早晨', range: '5–9 点', from: 5, to: 8 },
    { id: 'noon', name: '午间', range: '9–14 点', from: 9, to: 13 },
    { id: 'evening', name: '傍晚', range: '14–18 点', from: 14, to: 17 },
    { id: 'night', name: '夜间', range: '18–24 点', from: 18, to: 23 }
  ];
  const bucketOf = h => (h >= 5 && h <= 8) ? 'morning' : (h >= 9 && h <= 13) ? 'noon' : (h >= 14 && h <= 17) ? 'evening' : 'night';
  const timeAnalysis = () => {
    const days = Object.keys(state.meta.checkTimes);
    if (days.length < 4) return null;
    const per = BUCKETS.map(b => ({ ...b, done: 0 }));
    days.forEach(ds => state.meta.checkTimes[ds].forEach(h => {
      const p = per.find(x => x.id === bucketOf(h)); if (p) p.done++;
    }));
    const total = per.reduce((a, x) => a + x.done, 0);
    if (total < 4) return null;
    per.forEach(p => { p.share = Math.round(p.done / total * 100); });
    const top = per.slice().sort((a, b) => b.done - a.done)[0];
    const sh = Math.max(top.from, 6);
    return { buckets: per, top, suggest: pad(sh) + ':30', days: days.length, total };
  };

  const milestones = () => {
    const out = [];
    const cl = allCheckins();
    if (!cl.length) return out;
    out.push({ ds: cl[0].ds, label: '第一次打卡' });
    const days = Array.from(new Set(cl.map(c => c.ds))).sort();
    let run = 0;
    for (let i = 0; i < days.length; i++) {
      if (i > 0 && diffDays(days[i - 1], days[i]) === 1) run++; else run = 1;
      [7, 21, 30].forEach(m => { if (run === m) out.push({ ds: days[i], label: '连续 ' + m + ' 天' }); });
    }
    if (state.meta.restartDate) out.push({ ds: state.meta.restartDate, label: '断签后重新出发' });
    [10, 50, 100, 500].forEach(m => { if (cl.length >= m) out.push({ ds: cl[m - 1].ds, label: '第 ' + m + ' 次完成' }); });
    return out.sort((a, b) => a.ds < b.ds ? -1 : 1);
  };

  /* ---------- 周报 ---------- */
  const weekKeyOf = ds => dateStr(weekStart(parseDate(ds)));
  const weekReport = (offsetWeeks) => {
    const ws = addDays(weekStart(new Date()), -7 * (offsetWeeks || 0));
    const we = addDays(ws, 6);
    const s = dateStr(ws), e = dateStr(we) > todayStr() ? todayStr() : dateStr(we);
    const r = rateBetween(s, e);
    let bestDay = null, bestN = 0;
    for (let d = parseDate(s); d <= parseDate(e); d = addDays(d, 1)) {
      const ds = dateStr(d);
      const n = state.tasks.filter(t => checkedOn(t.id, ds)).length;
      if (n > bestN) { bestN = n; bestDay = ds; }
    }
    let champ = null;
    const byCat = {};
    allCheckins().forEach(c => {
      if (c.ds < s || c.ds > e) return;
      const t = taskById(c.taskId); if (!t) return;
      byCat[t.cat] = (byCat[t.cat] || 0) + 1;
    });
    Object.keys(byCat).forEach(k => { if (!champ || byCat[k] > byCat[champ]) champ = k; });
    const prev = offsetWeeks === 0 ? weekReport(1) : null;
    const pe = parseDate(e);
    return {
      ws: s, we: e, label: (ws.getMonth() + 1) + '月' + ws.getDate() + '日 – ' + (pe.getMonth() + 1) + '月' + pe.getDate() + '日',
      rate: r.rate == null ? null : Math.round(r.rate * 100), done: r.done, due: r.due,
      bestDay, bestDayCount: bestN, champ: champ ? catOf(champ) : null,
      curStreak: currentStreak(), vsPrev: prev && r.rate != null && prev.rate != null ? Math.round((r.rate - prev.rate) * 100) : null
    };
  };

  /* ---------- 月度报告 ---------- */
  const monthReport = mk => {
    mk = mk || monthKey(todayStr());
    const parts = mk.split('-').map(Number);
    const yy = parts[0], mm = parts[1];
    const start = dateStr(new Date(yy, mm - 1, 1));
    const endDs = dateStr(new Date(yy, mm, 0));
    const effEnd = endDs > todayStr() ? todayStr() : endDs;
    const r = rateBetween(start, effEnd);
    const daysArr = [];
    for (let d = parseDate(start); d <= parseDate(effEnd); d = addDays(d, 1)) daysArr.push(dateStr(d));
    const activeDays = daysArr.filter(ds => isChecked(ds)).length;
    let run = 0, best = 0;
    daysArr.forEach(ds => { if (isChecked(ds)) { run++; best = Math.max(best, run); } else run = 0; });
    const byTask = {};
    allCheckins().forEach(c => { if (monthKey(c.ds) === mk) byTask[c.taskId] = (byTask[c.taskId] || 0) + 1; });
    const topId = Object.keys(byTask).sort((a, b) => byTask[b] - byTask[a])[0];
    const topTask = topId ? taskById(topId) : null;
    const perfect = daysArr.filter(ds => {
      const due = state.tasks.filter(t => scheduledOn(t, ds));
      return due.length >= 2 && due.every(t => checkedOn(t.id, ds));
    }).length;
    return {
      mk, label: yy + '年' + mm + '月',
      rate: r.rate == null ? null : Math.round(r.rate * 100), done: r.done, due: r.due,
      activeDays, days: daysArr.length, bestStreak: best, perfect,
      topTask: topTask ? { name: topTask.name, n: byTask[topId] } : null
    };
  };
  const monthsAvailable = () => {
    const set = new Set();
    allCheckins().forEach(c => set.add(monthKey(c.ds)));
    set.add(monthKey(todayStr()));
    return Array.from(set).sort().reverse().slice(0, 6);
  };

  /* ---------- 年度报告（Pro） ---------- */
  const yearsAvailable = () => {
    const ys = new Set();
    allCheckins().forEach(c => ys.add(+c.ds.slice(0, 4)));
    ys.add(new Date().getFullYear());
    return Array.from(ys).sort((a, b) => b - a);
  };
  const perfectDaysOfYear = days => {
    let n = 0;
    days.forEach(ds => {
      const due = state.tasks.filter(t => scheduledOn(t, ds));
      if (due.length >= 2 && due.every(t => checkedOn(t.id, ds))) n++;
    });
    return n;
  };
  const yearReport = y => {
    const cl = allCheckins().filter(c => +c.ds.slice(0, 4) === y);
    const days = Array.from(new Set(cl.map(c => c.ds))).sort();
    const monthly = new Array(12).fill(0);
    const mDay = {};
    days.forEach(ds => { const m = +ds.slice(5, 7) - 1; (mDay[m] = mDay[m] || new Set()).add(ds); });
    Object.keys(mDay).forEach(m => { monthly[m] = mDay[m].size; });
    let run = 0, best = 0;
    for (let i = 0; i < days.length; i++) {
      if (i > 0 && diffDays(days[i - 1], days[i]) === 1) run++; else run = 1;
      if (run > best) best = run;
    }
    const byTask = {};
    cl.forEach(c => { byTask[c.taskId] = (byTask[c.taskId] || 0) + 1; });
    const topTaskId = Object.keys(byTask).sort((a, b) => byTask[b] - byTask[a])[0];
    const topTask = topTaskId ? taskById(topTaskId) : null;
    const byCat = {};
    cl.forEach(c => { const t = taskById(c.taskId); if (t) byCat[t.cat] = (byCat[t.cat] || 0) + 1; });
    const cats = Object.keys(byCat).map(k => ({ cat: catOf(k), n: byCat[k] })).sort((a, b) => b.n - a.n);
    return {
      y, total: cl.length, activeDays: days.length, bestStreak: best,
      monthly, first: days[0] || null, last: days[days.length - 1] || null,
      topTask: topTask ? { name: topTask.name, n: byTask[topTaskId] } : null,
      cats, ms: milestones().filter(m => +m.ds.slice(0, 4) === y),
      perfect: perfectDaysOfYear(days)
    };
  };

  /* ---------- 智能教练（难度/时段/频率/负荷；一次一条，接受或拒绝由用户决定） ---------- */
  const taskRate = (t, days) => {
    const today = todayStr();
    const from = dateStr(addDays(parseDate(today), -(days - 1)));
    let due = 0, done = 0;
    for (let d = parseDate(from); d <= parseDate(today); d = addDays(d, 1)) {
      const ds = dateStr(d);
      if (scheduledOn(t, ds)) { due++; if (checkedOn(t.id, ds)) done++; }
    }
    return { due, done, rate: due ? done / due : null };
  };
  const coachAdvice = () => {
    const active = state.tasks.filter(t => t.status === 'active' && t.freq !== 'anytime');
    if (!active.length || totalCheckins() < 6) return null;
    /* 1. 负荷 */
    if (active.length >= 6) {
      const recent = rateBetween(dateStr(addDays(parseDate(todayStr()), -13)), todayStr());
      if (recent.rate != null && recent.rate < 0.55)
        return { key: 'load', text: D.COACH.load(active.length), act: null };
    }
    /* 2. 难度 */
    let hardestHit = null, easiestFail = null;
    active.forEach(t => {
      const r = taskRate(t, 10);
      if (r.due < 6) return;
      if (r.rate >= 0.95 && (!hardestHit || r.rate > hardestHit.rate)) hardestHit = Object.assign({ t }, r);
      if (r.rate <= 0.35 && (!easiestFail || r.rate < easiestFail.rate)) easiestFail = Object.assign({ t }, r);
    });
    if (easiestFail) return { key: 'easier:' + easiestFail.t.id, text: D.COACH.easier({ name: easiestFail.t.name, days: 10, hit: easiestFail.done, due: easiestFail.due }), act: { type: 'ease', id: easiestFail.t.id } };
    if (hardestHit) return { key: 'harder:' + hardestHit.t.id, text: D.COACH.harder({ name: hardestHit.t.name, days: 10, hit: hardestHit.done, due: hardestHit.due }), act: { type: 'harden', id: hardestHit.t.id } };
    /* 3. 时段 */
    const ta = timeAnalysis();
    if (ta && ta.top.done >= 3) {
      const t = active.find(x => x.remind) || active[0];
      return { key: 'time', text: D.COACH.time({ bucket: ta.top.name + '（' + ta.top.range + '）', rate: ta.top.share, task: t.name, suggest: ta.suggest }), act: { type: 'remind', id: t.id, at: ta.suggest } };
    }
    /* 4. 频率 */
    const wk = active.find(t => t.freq === 'weekly');
    if (wk) {
      const r = taskRate(wk, 21);
      if (r.due >= 9) {
        const avg = r.done / (r.due / 3);
        if (avg >= wk.weekDays.length - 0.5)
          return { key: 'freq:' + wk.id, text: D.COACH.freq({ name: wk.name, avg: Math.round(avg * 10) / 10, suggest: Math.max(1, wk.weekDays.length - 1) }), act: { type: 'freq', id: wk.id } };
      }
    }
    return null;
  };
  const markCoachShown = key => { state.meta.coach = { date: todayStr(), type: key }; save(); };
  const coachShownToday = () => state.meta.coach.date === todayStr() ? state.meta.coach.type : '';
  /* 应用教练建议 */
  const applyCoach = act => {
    if (!act) return '';
    const t = taskById(act.id);
    if (!act.type) return '';
    if (act.type === 'ease' && t) {
      if (isProgressive(t)) { const g2 = Math.max(1, Math.round((+t.goal / 2) * 2) / 2); updateTask(t.id, { goal: g2, target: g2 + t.unit }); return `「${t.name}」目标改为 ${g2}${t.unit}。`; }
      updateTask(t.id, { target: '5 分钟版本' }); return `「${t.name}」改成 5 分钟版本。`;
    }
    if (act.type === 'harden' && t) {
      if (isProgressive(t)) { const g2 = Math.round(+t.goal * 1.5); updateTask(t.id, { goal: g2, target: g2 + t.unit }); return `「${t.name}」目标提到 ${g2}${t.unit}。`; }
      return `去任务页把「${t.name}」的标准调高一点。`;
    }
    if (act.type === 'remind' && t) { updateTask(t.id, { remind: act.at }); return `「${t.name}」提醒设在 ${act.at}。`; }
    if (act.type === 'freq' && t) {
      const keep = t.weekDays.slice(0, Math.max(1, t.weekDays.length - 1));
      updateTask(t.id, { weekDays: keep });
      return `「${t.name}」调整为每周 ${keep.length} 天。`;
    }
    return '';
  };

  /* ---------- 自然语言建任务 ---------- */
  const CN_NUM = { 零: 0, 一: 1, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 十一: 11, 十二: 12 };
  const cnToNum = s => { if (/^\d+(\.\d+)?$/.test(s)) return +s; if (CN_NUM[s] != null) return CN_NUM[s]; return null; };
  const PROGRESS_UNITS = ['升', '杯', '页', '字', '组', '个', '题', '篇', '单词', '公里', '分钟', '小时'];

  const parseTaskText = raw => {
    let text = String(raw || '').trim();
    if (!text) return null;
    const out = { name: '', cat: 'life', freq: 'daily', weekDays: [1, 2, 3, 4, 5, 6, 0], remind: '', target: '', unit: '', goal: 0, why: '', matched: {} };
    const whyM = text.match(/(?:，|,|。)?(?:因为|为了)\s*([^，。,]+)\s*$/);
    if (whyM) { out.why = whyM[1]; text = text.replace(whyM[0], ''); out.matched.why = whyM[0]; }
    const wkM = text.match(/每?周([一二三四五六日天](?:[、和与\s]*[一二三四五六日天]){0,6})/);
    if (wkM) {
      const days = []; const chars = wkM[1].match(/[一二三四五六日天]/g) || [];
      chars.forEach(ch => { const n = D.WEEKDAY.indexOf(ch); days.push(n >= 0 ? n : 0); });
      out.freq = 'weekly'; out.weekDays = Array.from(new Set(days)); out.matched.freq = wkM[0];
      text = text.replace(wkM[0], '');
    } else if (/每天|每日|天天/.test(text)) {
      out.freq = 'daily'; out.matched.freq = text.match(/每天|每日|天天/)[0];
      text = text.replace(/每天|每日|天天/, '');
    } else if (/随时|有空|想起来就/.test(text)) {
      out.freq = 'anytime'; out.matched.freq = text.match(/随时|有空|想起来就/)[0];
      text = text.replace(/随时|有空|想起来就/, '');
    }
    const tmM = text.match(/(早上|早晨|清晨|上午|中午|下午|傍晚|晚上|夜里|睡前)?\s*([0-9一二三四五六七八九十]+)\s*点(半|[0-9一二三四五六]+分)?/);
    if (tmM) {
      let h = cnToNum(tmM[2]); if (h == null) h = NaN;
      let min = '00';
      if (tmM[3] === '半') min = '30';
      else if (tmM[3]) { const mm = cnToNum(tmM[3].replace(/分$/, '')); if (mm != null) min = pad(mm); }
      const period = tmM[1] || '';
      if ((period === '晚上' || period === '夜里' || period === '睡前') && h < 12) h += 12;
      if ((period === '下午' || period === '傍晚') && h < 12) h += 12;
      if (period === '中午' && h < 11) h += 12;
      if (period === '睡前' && h >= 1 && h <= 6) h += 12;
      if (!isNaN(h) && h >= 0 && h <= 23) { out.remind = pad(h) + ':' + min; out.matched.time = tmM[0]; text = text.replace(tmM[0], ''); }
    }
    const nM = text.match(/([0-9]+(?:\.[0-9]+)?|[一二三四五六七八九十两]+)\s*(升|杯|页|字|组|个|题|篇|单词|公里|千米|分钟|小时|次)/);
    if (nM) {
      const num = cnToNum(nM[1]); let unit = nM[2]; if (unit === '千米') unit = '公里';
      if (num != null) {
        out.target = nM[1] + unit;
        if (PROGRESS_UNITS.indexOf(unit) >= 0 && unit !== '分钟' && unit !== '小时' && unit !== '次') { out.unit = unit; out.goal = num; }
        out.matched.target = nM[0]; text = text.replace(nM[0], '');
      }
    }
    const CAT_KW = {
      health: ['跑步', '运动', '健身', '锻炼', '冥想', '喝水', '早起', '起床', '瑜伽', '游泳', '散步', '早睡', '拉伸', '跳绳'],
      study: ['阅读', '读书', '学习', '英语', '背单词', '单词', '考研', '课程', '看书', '听写', '复习'],
      create: ['写作', '写', '画画', '摄影', '拍照', '设计', '剪辑', '谱曲', '手账'],
      work: ['工作', '复盘', '周报', '会议', '简历', '投递', '刷题'],
      money: ['记账', '理财', '存钱', '储蓄', '基金', '预算'],
      life: ['打扫', '整理', '打电话', '家人', '做饭', '洗衣', '买菜', '养花']
    };
    let bestCat = null;
    Object.keys(CAT_KW).forEach(k => { if (CAT_KW[k].some(w => raw.indexOf(w) >= 0)) { if (!bestCat) bestCat = k; } });
    if (bestCat) out.cat = bestCat;
    let name = text.replace(/[，,。；;、\s]+/g, ' ').replace(/^(然后|并且|还有|再|坚持|开始|我要|我想|需要|记得|要)\s*/g, '').trim();
    name = name.replace(/\s+/g, ' ');
    if (!name || name.length < 2) name = raw.replace(/[\s，,。；;]+/g, '').slice(0, 40);
    out.name = name.slice(0, 40);
    return out;
  };

  /* ---------- 导出 / 清空 / 导入 ---------- */
  const exportJSON = () => JSON.stringify(state, null, 2);  /* CSV：任务名,类别,日期,是否补打,完成量,单位,打卡时间 */
  const csvEsc = s => /[",\n]/.test(s) ? '"' + String(s).replace(/"/g, '""') + '"' : String(s);
  const exportCSV = () => {
    const rows = [['任务', '类别', '日期', '补打', '完成量', '单位', '时间']];
    Object.keys(state.records).forEach(tid => {
      const t = taskById(tid); if (!t) return;
      const cat = catOf(t.cat);
      Object.keys(state.records[tid]).sort().forEach(ds => {
        const r = state.records[tid][ds];
        rows.push([t.name, cat.name, ds, r.mk ? '是' : '', r.v, t.unit || '', r.at || '']);
      });
    });
    return '\uFEFF' + rows.map(r => r.map(csvEsc).join(',')).join('\n');
  };
  const importJSON = str => {
    try {
      const s = JSON.parse(str);
      if (!s || !Array.isArray(s.tasks)) return false;
      localStorage.setItem(KEY, JSON.stringify(s));
      load(); return true;
    } catch (e) { return false; }
  };
  const resetAll = () => {
    purgeLegacy();
    localStorage.removeItem(KEY);
    state = freshState(); save();
  };

  /* ---------- 备份 / 恢复 / 完整导出（数据安全） ---------- */
  const storageEstimate = () => {
    if (!navigator.storage || !navigator.storage.estimate) return Promise.resolve(null);
    return navigator.storage.estimate().catch(() => null);
  };
  /* 手动备份：把 state + 全部凭证图片存入 IDB 备份仓 */
  const makeBackup = async (label) => {
    if (!IDB || !IDB.available) return { ok: false, reason: 'idb' };
    try {
      const atts = (await IDB.allAttach()) || [];
      const data = { state, atts };
      const id = 'bk' + Date.now().toString(36);
      const size = JSON.stringify(data).length;
      await IDB.putBackup(id, { ts: Date.now(), label: label || '手动备份', size, data });
      /* 保留最近 10 份手动备份 */
      const all = (await IDB.listBackups()) || [];
      all.filter(b => b.label !== '自动每日备份').sort((x, y) => y.ts - x.ts).slice(10).forEach(b => IDB.deleteBackup(b.id));
      state.meta.lastBackup = todayStr(); save();
      return { ok: true, id };
    } catch (e) { return { ok: false, reason: 'error' }; }
  };
  /* 每日自动备份（静默，覆盖当日那份） */
  const autoBackup = async () => {
    if (!IDB || !IDB.available) return { ok: false, reason: 'idb' };
    if (state.meta.lastBackup === todayStr()) return { ok: true, skipped: true };
    if (!state.tasks.length && !Object.keys(state.records).length) return { ok: true, skipped: true };
    try {
      const atts = (await IDB.allAttach()) || [];
      await IDB.putBackup('auto-' + todayStr(), { ts: Date.now(), label: '自动每日备份', size: JSON.stringify({ state, atts }).length, data: { state, atts } });
      /* 自动备份只留最近 14 天 */
      const all = (await IDB.listBackups()) || [];
      all.filter(b => b.label === '自动每日备份').sort((x, y) => y.ts - x.ts).slice(14).forEach(b => IDB.deleteBackup(b.id));
      state.meta.lastBackup = todayStr(); save();
      return { ok: true };
    } catch (e) { return { ok: false, reason: 'error' }; }
  };
  const listBackups = async () => {
    if (!IDB || !IDB.available) return [];
    const all = (await IDB.listBackups()) || [];
    return all.sort((x, y) => y.ts - x.ts);
  };
  const deleteBackup = async id => { if (IDB && IDB.available) await IDB.deleteBackup(id); };
  const restoreBackup = async id => {
    if (!IDB || !IDB.available) return false;
    const b = await IDB.getBackup(id);
    if (!b || !b.data || !b.data.state || !Array.isArray(b.data.state.tasks)) return false;
    state = migrate(b.data.state);
    const atts = b.data.atts || [];
    for (let i = 0; i < atts.length; i++) { await IDB.putAttach(atts[i].id, atts[i].data, atts[i].name); }
    save();
    return true;
  };
  /* 完整导出包：state + 凭证图片，单个 JSON（可下载留档 / 跨设备迁移） */
  const exportBundle = async () => {
    const atts = (IDB && IDB.available) ? ((await IDB.allAttach()) || []) : [];
    return JSON.stringify({ app: 'rike', version: 3, exportedAt: new Date().toISOString(), state, atts }, null, 0);
  };
  const importBundle = async str => {
    try {
      const o = JSON.parse(str);
      if (!o || !o.state || !Array.isArray(o.state.tasks)) return false;
      state = migrate(o.state);
      const atts = o.atts || [];
      if (IDB && IDB.available) for (let i = 0; i < atts.length; i++) await IDB.putAttach(atts[i].id, atts[i].data, atts[i].name);
      save();
      return true;
    } catch (e) { return false; }
  };
  /* 打卡凭证图片：存 IDB，记录里只存 attach id */
  const saveProof = async (dataURL, name) => {
    if (!IDB || !IDB.available) return '';
    const id = 'at' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    await IDB.putAttach(id, dataURL, name || '');
    return id;
  };
  const getProof = id => (IDB && IDB.available && id) ? IDB.getAttach(id) : Promise.resolve(null);
  const attachInfo = async () => {
    if (!IDB || !IDB.available) return null;
    const atts = (await IDB.allAttach()) || [];
    const bytes = atts.reduce((a, x) => a + (x.data ? x.data.length : 0), 0);
    return { count: atts.length, approxKB: Math.round(bytes / 1024) };
  };

  /* ---------- 结伴（示例数据） ---------- */
  const partners = () => D.PARTNER_DEMO;
  const sendPartnerMsg = (pid, text) => { state.meta.partnerLog.push({ pid, from: 'me', text, at: new Date().toISOString() }); save(); };
  const receivePartnerMsg = (pid, text) => { state.meta.partnerLog.push({ pid, from: 'them', text, at: new Date().toISOString() }); save(); };
  const partnerMsgs = pid => state.meta.partnerLog.filter(m => m.pid === pid);

  /* ---------- 演示种子：约 9 周历史 + 断签重启 + 累积量 + 时间戳 ---------- */
  const seedDemo = () => {
    const today = new Date();
    const startDs = dateStr(addDays(today, -63));
    const base = [
      { name: '阅读 30 分钟', cat: 'study', freq: 'daily', why: '想在孩子面前，做个读书的大人' },
      { name: '运动 40 分钟', cat: 'fitness', freq: 'weekly', weekDays: [1, 3, 5] },
      { name: '写作 500 字', cat: 'create', freq: 'daily', unit: '字', goal: 500 },
      { name: '冥想 10 分钟', cat: 'mood', freq: 'daily', why: '让脑子在睡觉前先关掉', remind: '21:30' },
      { name: '喝水 2 升', cat: 'health', freq: 'daily', unit: '升', goal: 2 },
      { name: '背单词 20 个', cat: 'study', freq: 'daily', unit: '个', goal: 20, needProof: true },
      { name: '每周给家人打电话', cat: 'life', freq: 'weekly', weekDays: [0] },
      { name: '每周游泳一次', cat: 'fitness', freq: 'weekly', weekDays: [3], needProof: true }
    ];
    const tIds = base.map(b => addTask(Object.assign({ startDate: startDs }, b)).id);
    let counter = 20260906;
    const rnd = () => { counter = (counter * 9301 + 49297) % 233280; return counter / 233280; };
    /* 演示凭证图（浏览器内绘制；无文档环境回退 1px 常量） */
    let DEMO_IMG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    try {
      if (typeof document !== 'undefined' && document.createElement) {
        const cv = document.createElement('canvas'); cv.width = 260; cv.height = 190;
        const cx = cv.getContext('2d');
        const g = cx.createLinearGradient(0, 0, 260, 190); g.addColorStop(0, '#2E8B57'); g.addColorStop(1, '#8FBF9F');
        cx.fillStyle = g; cx.fillRect(0, 0, 260, 190);
        cx.fillStyle = 'rgba(255,255,255,.92)'; cx.font = '700 20px serif'; cx.textAlign = 'center';
        cx.fillText('示例凭证', 130, 95); cx.font = '12px sans-serif';
        cx.fillText('你上传的照片会像这样保存', 130, 120);
        DEMO_IMG = cv.toDataURL('image/jpeg', 0.7);
      }
    } catch (e) { /* 保持常量 */ }
    let proofN = 0;
    for (let back = 63; back >= 1; back--) {
      const d = addDays(today, -back);
      const ds = dateStr(d);
      const dow = d.getDay();
      const pause = back >= 33 && back <= 35;
      const strong = back < 12;
      tIds.forEach((id, idx) => {
        const t = taskById(id);
        if (!scheduledOn(t, ds)) return;
        let p = strong ? 0.92 : 0.72;
        if (idx === 3 && dow % 2 === 0) p -= 0.25;
        if (pause) p = 0;
        if (rnd() < p) {
          const r = ensureRec(id);
          const g = isProgressive(t) ? +t.goal : 1;
          const hr = [21, 19, 22, 7, 12, 20, 18, 9][idx] + Math.floor(rnd() * 2);
          const att = t.needProof && rnd() < 0.88 ? 'atdemo' : '';
          if (att) proofN++;
          r[ds] = { v: isProgressive(t) ? (rnd() < 0.8 ? g : g * 0.6) : 1, mk: false, at: pad(hr) + ':' + pad(Math.floor(rnd() * 60)), att, note: '' };
          if (checkedOn(id, ds)) (state.meta.checkTimes[ds] = state.meta.checkTimes[ds] || []).push(hr);
        }
      });
    }
    /* 昨天部分完成：写作 300 字、喝水 1.2 升；背单词完成但欠一张凭证 */
    const yd = dateStr(addDays(today, -1));
    const wr = taskById(tIds[2]), water = taskById(tIds[4]), voca = taskById(tIds[5]);
    if (scheduledOn(wr, yd)) ensureRec(wr.id)[yd] = { v: 300, mk: false, at: '', att: '', note: '' };
    if (scheduledOn(water, yd)) ensureRec(water.id)[yd] = { v: 1.2, mk: false, at: '', att: '', note: '' };
    if (voca && !recOf(voca.id, yd)) ensureRec(voca.id)[yd] = { v: voca.goal, mk: false, at: '', att: '', note: '' };
    if (window.TTIDB && window.TTIDB.available) { try { window.TTIDB.putAttach('atdemo', DEMO_IMG, '示例凭证.jpg'); } catch (e) {} }
    state.meta.proofCount = proofN;
    state.meta.demo = true; state.meta.onboarded = true; state.meta.lastVisit = todayStr();
    save();
  };

  return {
    pad, dateStr, parseDate, addDays, todayStr, diffDays, monthKey, weekStart, catOf,
    load, loadFromIDB, save, get, uid, hadData, getSaveError,
    addTask, updateTask, setTaskStatus, deleteTask, scheduledOn, taskById, isProgressive,
    checkedOn, isChecked, checkin, uncheck, bump, setRecord, setProof, setNote, progressOf, isMakeup, recOf, pendingProof,
    takeRestDay, restLeft, setSound,
    isPro, activatePro, cancelPro, proDaysLeft,
    currentStreak, bestStreak, totalCheckins, allCheckins,
    points, levelOf, stats, earnedBadges, nextEncouragement, rollSurprise, rateBetween, fatigueSignal,
    todayChallenge, completeChallenge, skipChallenge, challengeHistory,
    dayLevel, dayMakeup, dayRest, weeklyTrend, streakHistory, categoryRates,
    timeBuckets, timeAnalysis, BUCKETS, milestones,
    weekReport, weekKeyOf, monthReport, monthsAvailable,
    yearsAvailable, yearReport, coachAdvice, markCoachShown, coachShownToday, applyCoach,
    parseTaskText,
    perfectDays, perfectWeeks, taskCount, partners, sendPartnerMsg, receivePartnerMsg, partnerMsgs,
    exportJSON, exportCSV, taskStats,
    importJSON, resetAll, seedDemo,
    storageEstimate, makeBackup, autoBackup, listBackups, deleteBackup, restoreBackup,
    exportBundle, importBundle, saveProof, getProof, attachInfo
  };
})();
window.TTCore = TTCore;
