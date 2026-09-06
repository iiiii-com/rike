/* SECTION: app-ui —— 视图渲染与交互（今日/任务/统计/成就/报告/设置 + 引导/弹窗/商店/结伴） */
'use strict';
const TTApp = (() => {
  const C = window.TTCore, D = window.TTData;
  let view = 'today';
  let taskTab = 'active';
  let heatFilter = 'all';
  let toastTimer = null;

  const $ = sel => document.querySelector(sel);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const catOf = C.catOf;
  const fmtDate = ds => { const d = C.parseDate(ds); return (d.getMonth() + 1) + '月' + d.getDate() + '日'; };

  /* ---------- SECTION: theme/skin ---------- */
  const skinUnlocked = id => {
    const t = D.THEMES.find(x => x.id === id);
    if (!t) return false;
    if (t.cost === 0 || C.isPro()) return true;
    return (C.get().meta.unlockedThemes || []).indexOf(id) >= 0;
  };
  const applyTheme = () => {
    const m = C.get().meta;
    const dark = m.theme === 'dark' || (m.theme === 'auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
    const skin = skinUnlocked(m.themeId) ? m.themeId : 'warm';
    document.documentElement.setAttribute('data-skin', skin);
  };
  if (window.matchMedia) {
    try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme); } catch (e) {}
  }

  /* ---------- SECTION: toast ---------- */
  const toast = msg => {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  };

  /* ---------- SECTION: 打卡反馈（音效/里程碑庆祝） ---------- */
  let audioCtx = null;
  const playChime = () => {
    if (!C.get().meta.sound) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const beep = (f, t0, vol) => {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, audioCtx.currentTime + t0);
        g.gain.exponentialRampToValueAtTime(vol, audioCtx.currentTime + t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + t0 + 0.26);
        o.connect(g); g.connect(audioCtx.destination);
        o.start(audioCtx.currentTime + t0); o.stop(audioCtx.currentTime + t0 + 0.3);
      };
      beep(880, 0, 0.1); beep(1320, 0.09, 0.07);
    } catch (e) { /* 音频不可用则静默 */ }
  };
  /* 第二层反馈：里程碑全屏庆祝（约 2 秒，点击可提前关闭） */
  const celebrate = (icon, big, sub) => {
    const root = $('#fx-root');
    if (!root) return;
    const colors = ['#3FA66A', '#E4B34A', '#C1694E', '#4E7CC1', '#9A6BC1'];
    let conf = '';
    for (let i = 0; i < 18; i++) {
      conf += `<i class="cf" style="left:${(4 + Math.random() * 92).toFixed(1)}%;animation-delay:${(Math.random() * 0.35).toFixed(2)}s;--dy:${(42 + Math.random() * 55).toFixed(0)}vh;background:${colors[i % 5]}"></i>`;
    }
    root.innerHTML = `<div class="fx-mask"><div class="fx-card"><div class="fx-ic">${icon}</div><strong>${esc(big)}</strong><p>${esc(sub)}</p></div>${conf}</div>`;
    const kill = () => { root.innerHTML = ''; root.onclick = null; };
    root.onclick = kill;
    setTimeout(kill, 1950);
  };

  /* ---------- SECTION: modal ---------- */
  const openModal = html => {
    const root = $('#modal-root');
    root.innerHTML = `<div class="modal-mask" data-action="modal-mask"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
    root.hidden = false;
    document.body.classList.add('no-scroll');
  };
  const closeModal = () => { $('#modal-root').hidden = true; $('#modal-root').innerHTML = ''; document.body.classList.remove('no-scroll'); };

  /* ---------- SECTION: today helpers ---------- */
  const dueToday = () => C.get().tasks.filter(t => C.scheduledOn(t, C.todayStr()));
  const optionalToday = () => C.get().tasks.filter(t => t.status === 'active' && (t.freq === 'anytime' || t.freq === 'once') && !C.checkedOn(t.id, C.todayStr()));
  const yesterdayStr = () => C.dateStr(C.addDays(new Date(), -1));

  /* ---------- SECTION: nav ---------- */
  const NAV = [
    { id: 'today', name: '今日', icon: '☀️' },
    { id: 'tasks', name: '功课', icon: '✎' },
    { id: 'stats', name: '洞察', icon: '◈' },
    { id: 'badges', name: '拾获', icon: '⬥' },
    { id: 'settings', name: '设置', icon: '⚙' }
  ];
  const renderNav = () => {
    $('#sidebar').innerHTML = `<div class="brand"><span class="brand-dot">❋</span> 日课</div><div class="brand-latin">日课 · Daily Practice</div>` + NAV.map(n =>
      `<button class="nav-item ${view === n.id ? 'on' : ''}" data-action="nav" data-view="${n.id}"><span class="ni">${n.icon}</span>${n.name}</button>`).join('') +
      `<div class="side-foot"><button class="ghost-btn" data-action="add-task">＋ 立一课</button>
        <p class="side-pro ${C.isPro() ? 'on' : ''}">${C.isPro() ? '✦ Pro 生效中' : '升级 Pro · 年度报告与皮肤'}</p></div>`;
    $('#bottom-nav').innerHTML = NAV.map(n =>
      `<button class="bn-item ${view === n.id ? 'on' : ''}" data-action="nav" data-view="${n.id}"><span class="ni">${n.icon}</span><span>${n.name}</span></button>`).join('');
  };
  const go = v => { view = v; render(); };

  /* ---------- SECTION: streak head ---------- */
  let prevStreakShown = null;
  const streakHead = () => {
    const st = C.get();
    const cur = C.currentStreak();
    const best = C.bestStreak();
    const due = dueToday();
    const doneToday = due.length > 0 && due.every(t => C.checkedOn(t.id, C.todayStr()));
    const broke = cur === 0 && best >= 3 && !C.isChecked(yesterdayStr()) && !C.isChecked(C.todayStr());
    const shownNum = broke ? best : cur;
    let sub = '';
    if (broke) {
      const withWhy = st.tasks.filter(t => t.why && t.status === 'active');
      const w = withWhy[0];
      sub = '断了也没关系。这里放着你曾做到的最好一段——' + (w ? `再想想当初为什么开始：<em>${esc(w.why)}</em>` : '明天，从第一格重新画起。');
    }
    else if (!doneToday && cur > 0) sub = `今天这一格还空着 · 最长纪录 ${best} 天`;
    else if (doneToday) sub = `今天已落笔 · 最长纪录 ${best} 天`;
    else sub = '完成今天第一件功课，「日课」从今天开始积累';
    const nextMs = [7, 21, 30, 60, 100, 365].find(m => cur < m);
    const msHint = nextMs && !doneToday && cur > 0 ? `再 ${nextMs - cur} 天，就是第 ${nextMs} 天` : '';
    const headTitle = broke ? '这是你最好的一段，等你追上它'
      : cur > 0 ? '已连续，' + cur + ' 天'
      : '日课，从今天的第一笔开始';
    const bump = prevStreakShown !== null && shownNum > prevStreakShown ? ' bump' : '';
    prevStreakShown = shownNum;
    return `<div class="streak-card">
      <div class="flame${bump}" aria-label="连续天数">🔥<span>${shownNum}</span><em>天</em></div>
      <div class="streak-txt"><strong class="streak-title">${headTitle}</strong>
      <p>${sub}</p>${msHint ? `<p class="hint-em">${msHint}</p>` : ''}</div>
    </div>`;
  };

  /* ---------- SECTION: notif strip（含为什么回访） ---------- */
  const notifStrip = () => {
    const m = C.get().meta;
    const today = C.todayStr(), yd = yesterdayStr();
    const due = dueToday();
    const remain = due.filter(t => !C.checkedOn(t.id, today));
    let item = null;
    if (m.notif.streak && !C.isChecked(today)) {
      const cur = C.currentStreak();
      const nextMs = [7, 21, 30, 60, 100, 365].find(x => cur < x && x - cur <= 3 && cur > 0);
      if (nextMs) item = { type: 'streak', text: `还有 ${nextMs - cur} 天就连续 ${nextMs} 天了。` };
    }
    if (!item && due.length) {
      const h = new Date().getHours();
      if (remain.length > 0 && h >= 18 && m.notif.evening) {
        const w = remain.find(t => t.why);
        item = { type: 'evening', text: `还有 ${remain.length} 个任务。10 分钟就够。` + (w ? ` ${w.name}——${w.why}` : '') };
      } else if (remain.length > 0 && m.notif.morning) {
        item = { type: 'morning', text: h >= 12 ? `今天的 ${due.length} 个任务里，还有 ${remain.length} 个在等你。` : `早。今天的 ${due.length} 个任务在等你。` };
      } else if (remain.length === 0 && m.notif.evening && h >= 18) {
        item = { type: 'evening', text: '今天全部完成了。早点休息。' };
      }
    }
    if (item && m.seen[item.type] === today) item = null;
    if (!item) return '';
    return `<div class="notif-strip"><span>🔔 ${esc(item.text)}</span>
      <button class="x" data-action="notif-dismiss" data-type="${item.type}" aria-label="忽略">×</button></div>`;
  };

  /* ---------- SECTION: 打卡凭证（可选材料证明） ---------- */
  const proofDraft = { id: null, ds: '', data: '', name: '', att: '', note: '' };
  /* 图片压到长边 <=1000、JPEG 0.72，兼顾清晰与体积 */
  const compressImage = file => new Promise(resolve => {
    if (!file || !/^image\//.test(file.type)) { resolve(null); return; }
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        try {
          const MAX = 1000; let w = img.width, h = img.height;
          if (w > MAX || h > MAX) { const r = Math.min(MAX / w, MAX / h); w = Math.round(w * r); h = Math.round(h * r); }
          const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
          cv.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve({ data: cv.toDataURL('image/jpeg', 0.72), name: file.name || 'proof.jpg' });
        } catch (e) { resolve({ data: fr.result, name: file.name || 'proof.jpg' }); }
      };
      img.onerror = () => resolve({ data: fr.result, name: file.name || 'proof.jpg' });
      img.src = fr.result;
    };
    fr.onerror = () => resolve(null);
    fr.readAsDataURL(file);
  });
  /* mode='req' 必须附凭证才能打卡；mode='opt' 可选补充 */
  const proofModal = (id, ds, mode) => {
    const t = C.taskById(id); if (!t) return;
    const ex = C.recOf(id, ds);
    proofDraft.id = id; proofDraft.ds = ds; proofDraft.data = ''; proofDraft.name = '';
    proofDraft.att = ex ? (ex.att || '') : ''; proofDraft.note = ex ? (ex.note || '') : '';
    openModal(`<div class="modal-head"><h2>${mode === 'req' ? '附凭证打卡' : '打卡凭证'}</h2><button class="x" data-action="close-modal">×</button></div>
      <p class="tpl-intro">${esc(t.name)}${mode === 'req' ? ' · 这门功课要求材料证明，附上才记为完成。' : ' · 可选：附一张照片或写一句，作为给自己的证据。'}</p>
      <label class="proof-drop" for="proof-file">
        <input id="proof-file" type="file" accept="image/*" hidden>
        <div class="proof-empty"><span>⬆</span><p>点击选一张照片<br><i>自动压缩，只存本机浏览器</i></p></div>
        <div class="proof-prev" hidden><img id="proof-img" alt="凭证预览"><i class="proof-clear" data-action="proof-clear">×</i></div>
      </label>
      <div id="proof-load" class="proof-load" hidden>正在处理图片…</div>
      <label style="margin-top:12px;display:block">备注（可选）<input id="proof-note" maxlength="40" placeholder="如：跑了 5 公里，配速 6'10\"" value="${esc(proofDraft.note)}"></label>
      <div class="modal-ops">
        <button class="btn ghost" data-action="close-modal">${mode === 'req' ? '先不打卡' : '取消'}</button>
        <button class="btn primary" data-action="proof-confirm" data-mode="${mode}" data-primary-action>${mode === 'req' ? '确认打卡' : '保存'}</button>
      </div>`);
    if (proofDraft.att) {
      C.getProof(proofDraft.att).then(a => {
        if (a && a.data) {
          proofDraft.data = ''; /* 保留原 att */
          const img = $('#proof-img'); if (img) img.src = a.data;
          const pv = document.querySelector('.proof-prev'), pe = document.querySelector('.proof-empty');
          if (pv) pv.hidden = false; if (pe) pe.style.display = 'none';
        }
      });
    }
  };
  const onProofFile = input => {
    const f = input && input.files && input.files[0];
    if (!f) return;
    const ld = $('#proof-load'); if (ld) ld.hidden = false;
    compressImage(f).then(r => {
      if (ld) ld.hidden = true;
      if (!r) { toast('只能选图片'); return; }
      proofDraft.data = r.data; proofDraft.name = r.name;
      const img = $('#proof-img'); if (img) img.src = r.data;
      const pv = document.querySelector('.proof-prev'), pe = document.querySelector('.proof-empty');
      if (pv) pv.hidden = false; if (pe) pe.style.display = 'none';
    });
  };
  const doProofConfirm = mode => {
    const id = proofDraft.id, ds = proofDraft.ds;
    const noteEl = $('#proof-note'); const note = noteEl ? noteEl.value.trim() : '';
    const hasImg = !!proofDraft.data, hasAtt = !!proofDraft.att;
    if (mode === 'req' && !hasImg && !hasAtt) { toast('这门功课需要凭证，先附一张照片'); return; }
    const done = attId => { C.checkin(id, ds, ds !== C.todayStr(), attId, note); closeModal(); afterCheck(null); render(); };
    if (hasImg) { const ld = $('#proof-load'); if (ld) ld.hidden = false; C.saveProof(proofDraft.data, proofDraft.name).then(attId => done(attId || proofDraft.att)); }
    else done(proofDraft.att);
  };
  const proofLightbox = attId => {
    C.getProof(attId).then(a => {
      if (!a || !a.data) { toast('凭证图片未能读取（可能已随旧数据清理）'); return; }
      openModal(`<div class="modal-head"><h2>打卡凭证</h2><button class="x" data-action="close-modal">×</button></div>
        <div class="proof-box"><img src="${a.data}" alt="凭证照片"></div>
        <p class="form-hint">存于本机 IndexedDB，不上传服务器。</p>`);
    });
  };

  /* ---------- SECTION: makeup card ---------- */
  const makeupCard = () => {
    const today = C.todayStr(), yd = yesterdayStr();
    if (C.isChecked(yd) || C.isChecked(today)) return '';
    const ydTasks = C.get().tasks.filter(t => C.scheduledOn(t, yd) && !C.checkedOn(t.id, yd));
    if (!ydTasks.length) return '';
    return `<div class="makeup-card">
      <div><strong>昨天漏了 ${ydTasks.length} 项</strong><p>补一下，连续天数还在（标记为「补」）。也可以打开任务卡编辑昨天的进度。</p></div>
      <button class="btn soft" data-action="makeup">补打昨天</button>
    </div>`;
  };

  /* ---------- SECTION: 智能教练（每天最多一条建议，可接受可拒绝） ---------- */
  const coachCard = () => {
    const key = C.coachShownToday();
    if (key) return '';
    const adv = C.coachAdvice();
    if (!adv) return '';
    return `<div class="coach-card">
      <div class="coach-head"><span>🧭</span><strong>智能教练</strong><em class="coach-basis">心流理论：挑战和能力要匹配</em></div>
      <p>${esc(adv.text)}</p>
      <div class="coach-ops">
        ${adv.act ? `<button class="btn soft" data-action="coach-yes" data-key="${esc(adv.key)}">试一下</button>` : ''}
        <button class="link-btn" data-action="coach-no" data-key="${esc(adv.key)}">这次不用</button>
      </div>
    </div>`;
  };

  /* ---------- SECTION: fatigue card（倦怠保护） ---------- */
  const fatigueCard = () => {
    const m = C.get().meta;
    if (m.fatigueDismiss && m.fatigueDismiss >= C.todayStr()) return '';
    const f = C.fatigueSignal();
    if (!f) return '';
    return `<div class="fatigue-card">
      <div><strong>最近有点吃力？</strong>
        <p>近两周完成率 ${Math.round(f.recent * 100)}%，之前是 ${Math.round(f.prior * 100)}%。完成率下滑通常是任务量超出精力的信号——把任务减一点，比硬撑更值得。要不要先暂停做得最少的那个？</p></div>
      <div class="fat-ops"><button class="btn soft" data-action="reduce">帮我减一个</button>
      <button class="link-btn" data-action="fatigue-later">这周先这样</button></div>
    </div>`;
  };

  /* ---------- SECTION: 每日小挑战（挑战系统：打破日常平淡） ---------- */
  const challengeCard = () => {
    const c = C.todayChallenge();
    if (!c) return '';
    return `<div class="chal-card ${c.done ? 'done' : ''}">
      <div class="coach-head"><span>🎲</span><strong>今日小挑战</strong><em class="coach-basis">打破平淡 · 完成 +8 分</em></div>
      <p>${esc(c.text)}</p>
      <div class="coach-ops">
        ${c.done ? '<span class="chal-ok">✓ 已完成，+8 分已入账</span>'
          : '<button class="btn soft" data-action="chal-done">完成挑战</button><button class="link-btn" data-action="chal-skip">今天不做</button>'}
      </div>
    </div>`;
  };

  /* ---------- SECTION: task row（含累积量步进 · 难度 · 档案入口） ---------- */
  const diffDots = lv => {
    const n = Math.max(1, Math.min(3, lv || 2));
    return `<span class="diff" title="${D.DIFFS[n - 1].name}">${[1, 2, 3].map(i => `<b class="${i <= n ? 'f' : ''}"></b>`).join('')}</span>`;
  };
  const taskRow = (t, { optional }) => {
    const done = C.checkedOn(t.id, C.todayStr());
    const cat = catOf(t.cat);
    const prog = C.isProgressive(t);
    const rec = C.recOf(t.id, C.todayStr()) || {};
    let right = '';
    if (prog && !done) {
      const v = C.progressOf(t.id, C.todayStr()), g = +t.goal;
      const shown = Math.round(v * 100) / 100;
      const step = g <= 4 ? 0.5 : Math.round(g / 10);
      right = `<span class="stepper">
        <button data-action="bump" data-id="${t.id}" data-d="-${step}" aria-label="减少">−</button>
        <em>${shown}/${g} ${esc(t.unit)}</em>
        <button data-action="bump" data-id="${t.id}" data-d="${step}" aria-label="增加">＋</button></span>`;
    } else if (done) {
      const at = rec.at;
      right = `<span class="tr-done-tag">${prog ? '已达标' : '已成'}${at ? ' · ' + at : ''}</span>`;
    }
    /* 凭证标记：需凭证未附 → 提示；已附 → 缩略图可点开 */
    let proof = '';
    if (rec.att) {
      proof = `<button class="tr-proof has" data-action="view-proof" data-att="${rec.att}" aria-label="查看凭证">📷</button>`;
    } else if (t.needProof && !done) {
      proof = `<button class="tr-proof req" data-action="check" data-id="${t.id}" aria-label="附凭证打卡">需凭证</button>`;
    } else if (done && !t.needProof) {
      proof = `<button class="tr-proof opt" data-action="proof" data-id="${t.id}" aria-label="补充凭证">📷</button>`;
    }
    return `<li class="task-row ${done ? 'done' : ''}" data-task="${t.id}"><span class="sheen"></span>
      <button class="check ${done ? 'on' : ''}" data-action="check" data-id="${t.id}"
        aria-label="${done ? '取消完成' : '标记完成'}" data-primary-action>${done ? '✓' : ''}</button>
      <div class="tr-body">
        <span class="tr-name">${esc(t.name)}</span>
        <span class="tr-meta"><i class="dot" style="background:${cat.color}"></i><i>${cat.name}</i>
          <i>${D.FREQ_LABEL[t.freq] || ''}${t.freq === 'weekly' ? ' ×' + t.weekDays.length : ''}</i>
          ${t.remind ? `<i>◷ ${esc(t.remind)}</i>` : ''}${optional ? '<i>择时</i>' : ''}
          ${diffDots(t.diff)}</span>
        ${t.why ? `<span class="tr-why">${esc(t.why)}</span>` : ''}
      </div>${right}${proof}
      <button class="tr-more" data-action="open-dossier" data-id="${t.id}" aria-label="功课档案">◈</button>
    </li>`;
  };

  const restDayBtn = () => {
    const today = C.todayStr();
    if (C.isChecked(today)) return '';
    const left = C.restLeft(today);
    return `<button class="link-btn" data-action="rest-day">今天休息（本月剩 ${left === Infinity ? '∞' : left} 次）</button>`;
  };

  const nlBar = () => `<div class="nl-bar">
    <input id="nl-input" placeholder="说一句就行 · 例：每天晚上九点阅读30分钟，因为想做个读书的大人" maxlength="60">
    <button class="btn soft" data-action="nl-parse" data-primary-action>识 入</button></div>`;

  const renderToday = () => {
    const st = C.get(), today = C.todayStr();
    const due = dueToday(), opt = optionalToday();
    const doneCount = due.filter(t => C.checkedOn(t.id, today)).length;
    const pct = due.length ? Math.round(doneCount / due.length * 100) : 0;
    const d = new Date();
    let list = '';
    if (!st.tasks.length) {
      list = `<div class="empty"><div class="empty-ic">❋</div><p>${D.BRAND.motto}。今天还空着——选一件最小的事开始。</p>
        <button class="btn primary" data-action="open-tpl">从课格中挑一门</button></div>`;
    } else {
      list = `<ul class="task-list stagger">${due.map(t => taskRow(t, {})).join('')}${opt.map(t => taskRow(t, { optional: true })).join('')}</ul>
        ${!due.length && !opt.length ? `<p class="no-due">今天没有排课。可以新建一门功课，或享受空白的这一天。</p>` : ''}
        ${due.length ? `<div class="today-foot"><span>今日 ${doneCount}/${due.length}</span>
          <div class="mini-bar"><i style="width:${pct}%"></i></div></div>` : ''}
        ${restDayBtn()}`;
    }
    return `<div class="page">
      <header class="today-head">
        <div><div class="page-title-row"><h1>今天</h1><span class="title-latin">Today</span></div><p class="date-line">${fmtDate(today)} · 星期${D.WEEKDAY[d.getDay()]}</p></div>
        <button class="add-fab" data-action="add-task" aria-label="添加功课">＋</button>
      </header>
      ${notifStrip()}
      ${streakHead()}
      ${fatigueCard()}
      ${coachCard()}
      ${challengeCard()}
      ${makeupCard()}
      ${list}
      ${st.tasks.length ? nlBar() : ''}
    </div>`;
  };

  /* ---------- SECTION: NL 识别预览（REQ-015） ---------- */
  const nlPreview = () => {
    const raw = ($('#nl-input') && $('#nl-input').value) || '';
    const p = C.parseTaskText(raw);
    if (!p || !p.name) { toast('没识别出任务名，换个说法试试'); return; }
    const cat = catOf(p.cat);
    openModal(`<div class="modal-head"><h2>识别结果</h2><button class="x" data-action="close-modal">×</button></div>
      <div class="nl-prev">
        <strong>${esc(p.name)}</strong>
        <div class="chips wrap">
          <span class="chip on"><i style="color:${cat.color}">${cat.icon}</i> ${cat.name}</span>
          <span class="chip on">${D.FREQ_LABEL[p.freq]}${p.freq === 'weekly' ? '（周' + p.weekDays.map(w => D.WEEKDAY[w]).join('、') + '）' : ''}</span>
          ${p.remind ? `<span class="chip on">⏰ ${p.remind}</span>` : ''}
          ${p.target ? `<span class="chip on">每次 ${esc(p.target)}</span>` : ''}
          ${p.why ? `<span class="chip on">🧭 因为${esc(p.why)}</span>` : ''}
        </div>
        <p class="form-hint">${Object.keys(p.matched).length ? '已识别：' + Object.keys(p.matched).length + ' 个要素。不对可以点「手动修改」。' : '只识别出名称，其余进手动表单补充。'}</p>
        <div class="modal-ops">
          <button class="btn ghost" data-action="nl-manual">手动修改</button>
          <button class="btn primary" data-action="nl-confirm" data-primary-action>就这样，创建</button>
        </div>
      </div>`);
    $('#modal-root').__parsed = p;
  };
  const nlConfirm = () => {
    const p = $('#modal-root').__parsed;
    if (!p) { closeModal(); return; }
    C.addTask({ name: p.name, cat: p.cat, freq: p.freq, weekDays: p.weekDays, remind: p.remind, target: p.target, unit: p.unit, goal: p.goal, why: p.why, type: p.freq === 'anytime' ? 'todo' : 'habit' });
    closeModal(); toast('任务已创建'); render();
  };

  /* ---------- SECTION: tasks view ---------- */
  const statusLabel = { active: '进行中', paused: '已暂停', archived: '已归档' };
  const renderTasks = () => {
    const st = C.get();
    const list = st.tasks.filter(t => t.status === taskTab);
    const tabs = ['active', 'paused', 'archived'].map(k =>
      `<button class="chip ${taskTab === k ? 'on' : ''}" data-action="task-tab" data-tab="${k}">${statusLabel[k]}（${st.tasks.filter(t => t.status === k).length}）</button>`).join('');
    const body = list.length ? `<div class="task-cards">${list.map(t => {
      const cat = catOf(t.cat), cnt = C.taskCount(t.id);
      return `<div class="tcard">
        <div class="tcard-top">
          <strong>${esc(t.name)}</strong><span class="tag" style="color:${cat.color}">${cat.icon} ${cat.name}</span>
        </div>
        <p class="tcard-meta">${t.type === 'habit' ? '习惯' : t.type === 'goal' ? '目标' : '待办'} · ${D.FREQ_LABEL[t.freq]}${t.freq === 'weekly' ? '（周' + t.weekDays.map(w => D.WEEKDAY[w]).join('、') + '）' : ''}
          ${t.unit ? ' · 每次' + t.goal + t.unit : (t.target ? ' · 每次' + esc(t.target) : '')}${t.remind ? ' · ⏰' + esc(t.remind) : ''}
          ${t.deadline ? ' · 截止' + fmtDate(t.deadline) : ''} · 自 ${fmtDate(t.startDate)}</p>
        ${t.why ? `<p class="tcard-why">「${esc(t.why)}」</p>` : ''}
        <p class="tcard-stat">已打卡 ${cnt} 次</p>
        <div class="tcard-ops">
          <button class="link-btn" data-action="open-dossier" data-id="${t.id}">档案</button>
          <button class="link-btn" data-action="edit-task" data-id="${t.id}">编辑</button>
          ${t.status === 'active' ? `<button class="link-btn" data-action="pause-task" data-id="${t.id}">暂停</button>` : ''}
          ${t.status === 'paused' ? `<button class="link-btn" data-action="resume-task" data-id="${t.id}">恢复</button>` : ''}
          ${t.status !== 'archived' ? `<button class="link-btn" data-action="archive-task" data-id="${t.id}">归档</button>` : `<button class="link-btn" data-action="unarchive-task" data-id="${t.id}">放回今日</button>`}
          <button class="link-btn danger" data-action="delete-task" data-id="${t.id}">删除</button>
        </div>
      </div>`;
    }).join('')}</div>`
    : `<div class="empty"><div class="empty-ic">❐</div><p>${taskTab === 'active' ? '还没有功课。立一课，或用「课格」挑一门现成的。' : taskTab === 'paused' ? '没有暂停的功课。' : '归档是空的。放弃也没关系，历史都会留下。'}</p></div>`;
    return `<div class="page">
      <header class="page-head"><div class="page-title-row"><h1>功课</h1><span class="title-latin">Tasks</span></div>
        <div class="head-ops"><button class="btn soft" data-action="open-tpl">课格</button>
        <button class="btn ghost" data-action="nav" data-view="archive">档案总览</button>
        <button class="btn primary" data-action="add-task" data-primary-action>＋ 立一课</button></div></header>
      <div class="chips">${tabs}</div>${body}
    </div>`;
  };

  /* ---------- SECTION: task modal（为什么/难度/累积量/一次性/截止/备注） ---------- */
  const freqChips = cur => [['daily', '每天'], ['weekly', '每周'], ['anytime', '随时可做'], ['once', '一次性']].map(([k, n]) =>
    `<button class="chip ${cur === k ? 'on' : ''}" data-action="freq" data-freq="${k}">${n}</button>`).join('');
  const catChips = cur => D.CATEGORIES.map(c =>
    `<button class="chip ${cur === c.id ? 'on' : ''}" data-action="cat" data-cat="${c.id}"><i class="dot" style="background:${c.color}"></i> ${c.name}</button>`).join('');
  const weekChips = cur => [1, 2, 3, 4, 5, 6, 0].map(w =>
    `<button class="chip sm day ${cur.includes(w) ? 'on' : ''}" data-action="day" data-day="${w}">${D.WEEKDAY[w]}</button>`).join('');
  const diffChips = cur => D.DIFFS.map(d =>
    `<button class="chip ${cur === d.lv ? 'on' : ''}" data-action="diff" data-diff="${d.lv}" title="${d.hint}">${'●'.repeat(d.lv)}${'○'.repeat(3 - d.lv)} ${d.name}</button>`).join('');

  const taskModal = (taskId, preset) => {
    const st = C.get();
    const t = taskId ? st.tasks.find(x => x.id === taskId) : null;
    const draft = t || Object.assign({ name: '', type: 'habit', freq: 'daily', weekDays: [1, 2, 3, 4, 5], cat: 'study', remind: '', target: '', unit: '', goal: 0, why: '', deadline: '', diff: 2, note: '', needProof: false, startDate: C.todayStr() }, preset || {});
    openModal(`<div class="modal-head"><h2>${t ? '编辑功课' : '立一课'}</h2><button class="x" data-action="close-modal" aria-label="关闭">×</button></div>
      <div class="form">
        <label>功课名称<input id="f-name" maxlength="40" placeholder="一句话说清，例如：阅读 30 分钟" value="${esc(draft.name)}"></label>
        <div class="frow"><span>门类</span><div class="chips wrap">${catChips(draft.cat)}</div></div>
        <div class="frow"><span>频率</span><div class="chips">${freqChips(draft.freq)}</div></div>
        <div class="frow" id="f-week" style="${draft.freq === 'weekly' ? '' : 'display:none'}"><span>排在周几</span><div class="chips">${weekChips(draft.weekDays)}</div></div>
        <div class="frow2">
          <label>提醒时间（可选）<input id="f-remind" type="time" value="${esc(draft.remind)}"></label>
          <label>开始日期<input id="f-start" type="date" value="${draft.startDate || C.todayStr()}"></label>
        </div>
        <div class="frow2">
          <label>每次目标量（可选，如 2 升）
            <span class="goal-row"><input id="f-goal" type="number" min="1" step="0.5" placeholder="数值" value="${draft.goal || ''}">
            <select id="f-unit"><option value="">不设</option>${['升','杯','页','字','组','个','题','篇','单词','公里','步','元','分钟','小时'].map(u => `<option ${draft.unit === u ? 'selected' : ''}>${u}</option>`).join('')}</select></span></label>
          <label>截止日期（目标类可选）<input id="f-deadline" type="date" value="${esc(draft.deadline || '')}"></label>
        </div>
        <div class="frow"><span>这件事有多费力</span><div class="chips">${diffChips(draft.diff || 2)}</div></div>
        <div class="frow"><span>打卡凭证</span>
          <div class="chips">
            <button class="chip ${!draft.needProof ? 'on' : ''}" data-action="proof-flag" data-v="0">不需要</button>
            <button class="chip ${draft.needProof ? 'on' : ''}" data-action="proof-flag" data-v="1">必须附材料才记完成</button>
          </div>
        </div>
        <label>这件事为什么重要？（可选，建议写）
          <input id="f-why" maxlength="30" placeholder="在你不想起来的那天，读给自己的一句话" value="${esc(draft.why)}"></label>
        <label>备注（可选）<input id="f-note" maxlength="40" placeholder="如：配一杯茶，戴上耳机" value="${esc(draft.note || '')}"></label>
        <div class="modal-ops">
          ${t ? '' : '<button class="btn ghost" data-action="close-modal">取消</button>'}
          <button class="btn primary" data-action="save-task" data-id="${t ? t.id : ''}" data-primary-action>${t ? '保存修改' : '记下这课'}</button>
        </div>
        <p class="form-hint">半分钟就能立好。名称和门类必填，其它随时可改。「为什么」会在你想放弃的那天还给你。设了「必须附材料」的功课，打卡时会要求拍照或选图作为证明。</p>
      </div>`);
    $('#modal-root').__draft = draft;
    $('#modal-root').__proof = !!draft.needProof;
  };

  const saveTaskFromModal = (taskId) => {
    const root = $('#modal-root'), draft = root.__draft;
    const name = $('#f-name').value.trim();
    if (!name) { toast('给这课起个名字吧'); $('#f-name').focus(); return; }
    const catBtn = root.querySelector('.chip.on[data-cat]'), freqBtn = root.querySelector('.chip.on[data-freq]');
    const diffBtn = root.querySelector('.chip.on[data-diff]');
    const goal = parseFloat($('#f-goal').value) || 0;
    const unit = $('#f-unit').value;
    const fkey = freqBtn ? freqBtn.dataset.freq : draft.freq;
    const patch = {
      name, cat: catBtn ? catBtn.dataset.cat : draft.cat, freq: fkey,
      type: (fkey === 'anytime' || fkey === 'once') ? 'todo' : (draft.type === 'goal' ? 'goal' : 'habit'),
      weekDays: (draft.weekDays && draft.weekDays.length) ? draft.weekDays : [1, 2, 3, 4, 5],
      remind: $('#f-remind').value, target: (goal && unit) ? goal + unit : (draft.target || ''),
      unit: goal && unit ? unit : '', goal: goal && unit ? goal : 0,
      why: $('#f-why').value.trim(), deadline: $('#f-deadline').value,
      diff: diffBtn ? +diffBtn.dataset.diff : (draft.diff || 2),
      note: $('#f-note').value.trim(),
      needProof: root.__proof !== undefined ? !!root.__proof : !!draft.needProof,
      startDate: $('#f-start').value || C.todayStr()
    };
    if (taskId) { C.updateTask(taskId, patch); toast('功课已更新'); }
    else { C.addTask(patch); toast('已记下这课'); }
    closeModal(); render();
  };

  /* ---------- SECTION: templates（按生活领域分组） ---------- */
  const tplToTask = tp => ({
    name: tp.name, cat: tp.cat, freq: tp.freq,
    weekDays: tp.weekDays || [1, 2, 3, 4, 5, 6, 0],
    target: tp.target || '', remind: tp.remind || '',
    unit: tp.unit || '', goal: tp.goal || 0,
    needProof: !!tp.needProof,
    type: (tp.freq === 'anytime' || tp.freq === 'once') ? 'todo' : (tp.type || 'habit')
  });
  const tplModal = () => {
    const withIdx = D.TEMPLATES.map((tp, i) => ({ tp, i }));
    const groups = D.TPL_GROUPS.map(g => ({ g, items: withIdx.filter(x => x.tp.group === g) })).filter(x => x.items.length);
    const rest = withIdx.filter(x => !x.tp.group);
    if (rest.length) groups.push({ g: '其他', items: rest });
    const card = x => {
      const cat = catOf(x.tp.cat);
      const bits = [D.FREQ_LABEL[x.tp.freq], cat.name];
      if (x.tp.needProof) bits.push('需凭证');
      if (x.tp.unit) bits.push(x.tp.goal + x.tp.unit);
      else if (x.tp.target) bits.push(x.tp.target);
      return `<button class="tpl" data-action="use-tpl" data-i="${x.i}">
        <span class="tpl-ic" style="color:${cat.color}">${cat.icon}</span>
        <strong>${esc(x.tp.name)}</strong><span class="tpl-meta">${bits.join(' · ')}</span>
      </button>`;
    };
    openModal(`<div class="modal-head"><h2>课格 · 现成的功课</h2><button class="x" data-action="close-modal" aria-label="关闭">×</button></div>
      <p class="tpl-intro">覆盖日常全领域，挑一格落子即可，之后都能改。</p>
      <div class="tpl-groups">${groups.map(gr => `<div class="tpl-grp">
        <div class="tpl-grp-h">${esc(gr.g)}<i>${gr.items.length}</i></div>
        <div class="tpl-grid">${gr.items.map(card).join('')}</div>
      </div>`).join('')}</div>`);
  };

  /* ---------- SECTION: 功课档案（单任务深度可视化） ---------- */
  const sparkBars = arr => {
    if (!arr || !arr.length) return '<span class="di-spark"></span>';
    const mx = Math.max(...arr, 1);
    return `<span class="di-spark">${arr.map(n => `<i style="height:${Math.max(3, Math.round(n / mx * 22))}px" class="${n > 0 ? 'hit' : ''}"></i>`).join('')}</span>`;
  };
  const dosHeatSvg = d => {
    const cell = 13, gap = 3, W = 12 * (cell + gap);
    let s = `<svg viewBox="0 0 ${W} ${7 * (cell + gap)}" class="dos-chart" width="100%" preserveAspectRatio="xMidYMid meet">`;
    d.heat.forEach((c, i) => {
      const col = Math.floor(i / 7), row = i % 7;
      const fill = c.st === 'hit' ? 'var(--pri)' : c.st === 'mk' ? 'var(--hm3)' : c.st === 'part' ? 'var(--amber)'
        : 'transparent';
      const stroke = (c.st === 'miss' || c.st === 'future') ? 'var(--line)' : 'none';
      const sw = (stroke !== 'none') ? '1' : '0';
      s += `<rect x="${col * (cell + gap)}" y="${row * (cell + gap)}" width="${cell}" height="${cell}" rx="3" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"><title>${c.ds} ${c.st === 'hit' ? '已完成' : c.st === 'mk' ? '补打' : c.st === 'part' ? '部分完成' : c.st === 'miss' ? '未打卡' : c.st === 'future' ? '将来' : ''}</title></rect>`;
    });
    return s + '</svg>';
  };
  const dosClock = d => {
    const hours = d.hours, mx = Math.max(...hours, 1);
    return `<div class="dos-clock">${hours.map((n, h) => `<i title="${h}:00 ${n} 次" style="height:${Math.max(2, n / mx * 46)}px;opacity:${n ? .9 : .18}"></i>`).join('')}</div>
      <div class="dos-clock-x"><span>0时</span><span>6时</span><span>12时</span><span>18时</span><span>23时</span></div>`;
  };
  const dosWeekday = d => {
    const mx = Math.max(...d.wd, 1);
    return `<div class="dos-wd">${[1, 2, 3, 4, 5, 6, 0].map(w => `<div class="wd"><i style="height:${Math.max(2, d.wd[w] / mx * 34)}px"></i><em>${D.WEEKDAY[w]}</em></div>`).join('')}</div>`;
  };
  const dossierH3 = t => `<h3 class="dos-h3">${t}</h3>`;
  const dossierModal = id => {
    const d = C.taskStats(id);
    if (!d) return;
    const cat = catOf(d.t.cat);
    const prog = C.isProgressive(d.t);
    openModal(`<div class="modal-head"><div class="dos-head"><div>
        <div class="page-title-row"><h2 style="font-family:var(--serif)">${esc(d.t.name)}</h2><span class="title-latin">Dossier</span></div>
        <p style="font-size:12.5px;color:var(--dim)">${cat.name} · ${D.FREQ_LABEL[d.t.freq]} · ${D.DIFFS[(d.t.diff || 2) - 1].name} · 自 ${fmtDate(d.t.startDate)}</p></div>
        <button class="x" data-action="close-modal">×</button></div>
      ${d.t.why ? `<p class="dos-why">${esc(d.t.why)}</p>` : ''}
      ${d.t.note ? `<p class="dos-note">✎ ${esc(d.t.note)}</p>` : ''}
      <div class="dos-nums">
        <div class="sitem"><strong>${d.cnt}</strong><span>累计完成</span></div>
        <div class="sitem"><strong>${d.rate}%</strong><span>完成率</span></div>
        <div class="sitem"><strong>${d.best}</strong><span>最长连续</span></div>
        <div class="sitem"><strong>${d.cur}</strong><span>当前连续</span></div>
      </div>
      ${dossierH3('节奏 · 近 12 周（每格一天）')}${dosHeatSvg(d)}
      <div class="hm-legend" style="margin:2px 0 12px">
        <i class="hm-cell lv3" style="width:11px;height:11px"></i><span>完成</span>
        <i class="hm-cell lv2 mk" style="width:11px;height:11px"></i><span>补打</span>
        <i style="width:11px;height:11px;border-radius:3px;background:var(--amber);display:inline-block"></i><span>部分</span>
        <i style="width:11px;height:11px;border-radius:3px;border:1px solid var(--line);display:inline-block"></i><span>未打</span>
      </div>
      ${d.wd.some(x => x) ? dossierH3('星期节奏 · 哪天最常在') + dosWeekday(d) : ''}
      ${d.atKnown >= 3 ? dossierH3('时刻节奏 · 常在这些钟点') + dosClock(d) : ''}
      ${d.months.length > 1 ? dossierH3('月度节奏（完成次数）') + `<div class="dos-months">${d.months.map(m => `<div class="dos-m"><em>${m.m.slice(5)}月</em><strong>${m.n}</strong></div>`).join('')}</div>` : ''}
      <div style="display:flex;gap:14px;flex-wrap:wrap;font-size:12.5px;color:var(--sub);margin:8px 0 14px">
        ${prog ? `<span>平均 ${Math.round((d.avgV || 0) * 10) / 10}${d.t.unit} / 次 · 目标 ${d.t.goal}${d.t.unit}</span>` : ''}
        ${d.onTime != null ? `<span>准点率 ${d.onTime}%（提醒 ${d.t.remind}）</span>` : ''}
        ${d.mkCnt ? `<span>含补打 ${d.mkCnt} 次</span>` : ''}
        ${d.first ? `<span>始于 ${fmtDate(d.first)}${d.last ? ` · 最近 ${fmtDate(d.last)}` : ''}</span>` : ''}
      </div>
      ${d.density >= 40 ? `<p class="dos-note" style="color:var(--pri-deep)">◈ ${d.density}% 的日子你都在做这件事——它已经很接近生活本身了。</p>` : ''}
      ${d.future.length ? `<div style="margin-top:10px">${dossierH3('接下来 7 天')}<div class="dos-future">${d.future.map(ds => `<div class="ft-row"><em>${fmtDate(ds)}</em><i>周${D.WEEKDAY[C.parseDate(ds).getDay()]}</i><span>要上这一课</span></div>`).join('')}</div></div>` : ''}
      <div class="dos-ops">
        <button class="btn soft" data-action="edit-task" data-id="${id}">编辑</button>
        <button class="btn ghost" data-action="dos-csv" data-id="${id}">导出本课记录</button>
        ${d.t.status === 'active' ? `<button class="btn ghost" data-action="pause-task" data-id="${id}">暂停</button>` : `<button class="btn ghost" data-action="resume-task" data-id="${id}">恢复</button>`}
      </div>`);
  };

  /* ---------- SECTION: 档案页 ---------- */
  const renderArchive = () => {
    const st = C.get();
    const all = st.tasks.slice().sort((a, b) => C.taskCount(b.id) - C.taskCount(a.id));
    const body = all.length ? `<div class="dossier-list">${all.map(t => {
      const d = C.taskStats(t.id);
      const cat = catOf(t.cat);
      return `<div class="dossier-item" data-action="open-dossier" data-id="${t.id}">
        <i class="dot" style="background:${cat.color}"></i>
        <div class="di-name"><strong>${esc(t.name)}</strong><span>${cat.name} · ${D.FREQ_LABEL[t.freq]}${t.status !== 'active' ? ' · ' + statusLabel[t.status] : ''}</span></div>
        ${sparkBars(d.spark)}
        <span class="di-rate">${d.cnt}<i>次</i></span>
        <span class="di-rate">${d.rate}%</span>
        <span class="di-arrow">›</span>
      </div>`;
    }).join('')}</div>`
      : `<div class="empty"><div class="empty-ic">❐</div><p>还没有功课。先去「今日」立一课。</p></div>`;
    return `<div class="page">
      <header class="page-head"><div class="page-title-row"><h1>档案</h1><span class="title-latin">Dossier</span></div>
        <div class="head-ops"><button class="btn ghost" data-action="nav" data-view="tasks">← 返回功课</button></div></header>
      <p class="tpl-intro" style="margin-bottom:14px">每门功课都有自己的档案：完成率、节奏、钟点与将来安排。点开任意一门细看。</p>
      ${body}
    </div>`;
  };

  /* ---------- SECTION: stats view ---------- */
  const heatmap = () => {
    const today = new Date();
    const end = C.weekStart(C.addDays(today, 7));
    const start = C.addDays(end, -17 * 7);
    let cols = '';
    for (let w = 0; w < 17; w++) {
      let cells = '';
      for (let r = 0; r < 7; r++) {
        const d = C.addDays(start, w * 7 + r);
        const ds = C.dateStr(d);
        const future = ds > C.todayStr();
        const lv = future ? -1 : (heatFilter === 'all' ? C.dayLevel(ds) : heatLevel(ds));
        const anyDone = C.get().tasks.some(t => C.checkedOn(t.id, ds));
        const mk = anyDone && Object.values(C.get().records).some(rec => rec[ds] && rec[ds].mk);
        const rest = !future && C.dayRest(ds);
        cells += `<span class="hm-cell lv${lv}${mk ? ' mk' : ''}${rest ? ' rest' : ''}${future ? '' : ' clickable'}"${future ? '' : ` data-action="day-detail" data-ds="${ds}"`} title="${ds}${mk ? ' 有补打' : anyDone ? ' 有完成' : rest ? ' 休息日' : ''}"></span>`;
      }
      cols += `<div class="hm-col">${cells}</div>`;
    }
    return `<div class="hm-wrap">${cols}</div>
      <div class="hm-legend"><span>少</span><i class="hm-cell lv0"></i><i class="hm-cell lv1"></i><i class="hm-cell lv2"></i><i class="hm-cell lv3"></i><i class="hm-cell lv4"></i><span>多</span><i class="hm-cell lv2 mk"></i><span>补</span><i class="hm-cell lv1 rest"></i><span>休</span><span class="hm-note">近 17 周 · 每格一天</span></div>`;
  };
  const heatLevel = ds => {
    const due = C.get().tasks.filter(t => t.cat === heatFilter && C.scheduledOn(t, ds));
    const done = due.filter(t => C.checkedOn(t.id, ds)).length;
    if (!due.length) return 0;
    return Math.min(4, Math.ceil(done / due.length * 4));
  };

  const trendSvg = () => {
    const data = C.weeklyTrend(12);
    const W = 640, H = 150, P = 10;
    const pts = data.map((d, i) => {
      const x = P + i * (W - 2 * P) / (data.length - 1);
      const y = H - P - (d.rate / 100) * (H - 2 * P);
      return [x, y, d];
    });
    const line = pts.map(p => `${p[0]},${p[1]}`).join(' ');
    const area = `${P},${H - P} ${line} ${W - P},${H - P}`;
    return `<svg class="trend" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="近12周完成率趋势">
      <polygon points="${area}" class="trend-area"></polygon>
      <polyline points="${line}" class="trend-line"></polyline>
      ${pts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" class="trend-dot"><title>${p[2].label} 周完成率 ${p[2].rate}%</title></circle>`).join('')}
    </svg>
    <div class="trend-x"><span>${pts[0][2].label}</span><span>近 12 周完成率（%）</span><span>${pts[pts.length - 1][2].label}</span></div>`;
  };

  const streakCurve = () => {
    const data = C.streakHistory(12);
    const W = 640, H = 150, P = 12;
    const maxV = Math.max(7, ...data.map(d => d.val));
    const pts = data.map((d, i) => {
      const x = P + i * (W - 2 * P) / (data.length - 1);
      const y = H - P - (d.val / maxV) * (H - 2 * P);
      return [x, y, d];
    });
    const line = pts.map(p => `${p[0]},${p[1]}`).join(' ');
    return `<svg class="trend" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="近12周连续天数峰值">
      <polyline points="${line}" class="trend-line"></polyline>
      ${pts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="${p[2].broke ? 5 : 3.5}" class="${p[2].broke ? 'trend-dot broke' : 'trend-dot'}"><title>${p[2].label} 周 · 连续峰值 ${p[2].val} 天${p[2].broke ? '（期间有断点）' : ''}</title></circle>`).join('')}
    </svg>
    <div class="trend-x"><span>${pts[0][2].label}</span><span>每周连续峰值（断点处标橙点）</span><span>今天</span></div>`;
  };

  const monthCompare = () => {
    const t = new Date();
    const cur = C.dateStr(new Date(t.getFullYear(), t.getMonth(), 1));
    const curEnd = C.todayStr();
    const prev = C.dateStr(new Date(t.getFullYear(), t.getMonth() - 1, 1));
    const prevEnd = C.dateStr(new Date(t.getFullYear(), t.getMonth(), 0));
    const a = C.rateBetween(cur, curEnd), b = C.rateBetween(prev, prevEnd);
    if (a.rate == null && b.rate == null) return '';
    const line = (lbl, r) => r.rate == null ? `<p class="cmp-none">${lbl}暂无数据</p>` :
      `<div class="cmp-row"><span>${lbl}</span><div class="cmp-track"><i style="width:${Math.max(r.rate * 100, 1)}%"></i></div><em>${Math.round(r.rate * 100)}%</em></div>`;
    let verdict = '';
    if (a.rate != null && b.rate != null) {
      const d = Math.round((a.rate - b.rate) * 100);
      verdict = d >= 0 ? `<p class="cmp-v">本月比上月 <strong>+${d}%</strong>。趋势在涨，这比数字本身重要。</p>`
        : `<p class="cmp-v">本月比上月 <strong>${d}%</strong>。起伏正常，先看这周。</p>`;
    }
    return line('本月', a) + line('上月', b) + verdict;
  };

  const catBars = () => {
    const rows = C.categoryRates();
    if (!rows.length) return '<p class="no-due">还没有类别数据。</p>';
    return rows.map(r => `<div class="cbar">
      <span class="cbar-l">${r.cat.icon} ${r.cat.name}</span>
      <div class="cbar-track"><i style="width:${Math.max(r.rate, 2)}%;background:${r.cat.color}"></i></div>
      <span class="cbar-v">${r.rate}%</span></div>`).join('');
  };

  const timeRow = () => {
    const b = C.timeBuckets();
    const max = Math.max(b['早'], b['午'], b['傍晚'], b['夜'], 1);
    let html = `<div class="time-buckets">${Object.keys(b).map(k =>
      `<div class="tb"><i style="height:${Math.round(b[k] / max * 100)}%"></i><span>${k}</span><em>${b[k]}</em></div>`).join('')}</div>`;
    const ta = C.timeAnalysis();
    if (ta) {
      html += `<p class="golden">你的黄金时段是 <strong>${ta.top.name}</strong>（${ta.top.range}），近 30 天 ${ta.top.share}% 的打卡发生在这里。提醒设在 <strong>${ta.suggest}</strong> 之前一点，成功率会更高。</p>
      <p class="coach-basis">行为依据：在能力峰值时段安排行动，减少启动摩擦</p>`;
    } else {
      html += `<p class="form-hint">打卡时间攒够 4 天后，这里会给出你的黄金时段。</p>`;
    }
    return html;
  };

  const msList = () => {
    const ms = C.milestones();
    if (!ms.length) return '<p class="no-due">完成第一次打卡后，这里会记录你的里程碑。</p>';
    return `<ol class="ms-list">${ms.map(m => `<li><span class="ms-dot"></span><div><strong>${esc(m.label)}</strong><span>${fmtDate(m.ds)}</span></div></li>`).join('')}</ol>`;
  };

  /* ---------- SECTION: 当日明细（热力图/月历点击钻取，含凭证缩略） ---------- */
  const dayDetailModal = (ds) => {
    const due = C.get().tasks.filter(t => C.scheduledOn(t, ds));
    const extra = C.get().tasks.filter(t => {
      const r = C.recOf(t.id, ds); return r && C.checkedOn(t.id, ds) && due.indexOf(t) < 0;
    });
    const all = due.concat(extra);
    const done = all.filter(t => C.checkedOn(t.id, ds));
    const pend = all.filter(t => C.pendingProof(t.id, ds));
    const isRest = (C.get().meta.restDays || []).indexOf(ds) >= 0;
    const row = t => {
      const cat = catOf(t.cat);
      const r = C.recOf(t.id, ds) || {};
      const ok = C.checkedOn(t.id, ds);
      const p1 = C.pendingProof(t.id, ds);
      return `<div class="dd-item">
        <span class="${ok ? 'ok' : 'no'}">${ok ? '✓' : (p1 ? '◔' : '○')}</span>
        <span><i class="dot" style="background:${cat.color}"></i> ${esc(t.name)}${r.v && C.isProgressive(t) ? ` · ${Math.round(r.v * 10) / 10}${t.unit}` : ''}</span>
        ${r.at ? `<em>${r.at}${r.mk ? '·补' : ''}</em>` : (r.mk ? '<em>补</em>' : '')}
        ${p1 ? `<button class="dd-add" data-action="proof-at" data-id="${t.id}" data-ds="${ds}">附证</button>` : ''}
        ${r.att ? `<img class="dd-att" data-action="view-proof" data-att="${r.att}" src="" alt="凭证">` : ''}
        ${r.note ? `<p class="dd-note">${esc(r.note)}</p>` : ''}
      </div>`;
    };
    openModal(`<div class="modal-head"><h2>${fmtDate(ds)} · 星期${D.WEEKDAY[C.parseDate(ds).getDay()]}</h2><button class="x" data-action="close-modal">×</button></div>
      <p class="tpl-intro">${due.length ? `应做 ${due.length} 项 · 完成 ${done.length} 项` : '这天没有排课'}${isRest ? ' · 休息日' : ''}${pend.length ? ` · <span style="color:var(--amber)">${pend.length} 项待凭证</span>` : ''}</p>
      ${all.length ? `<div>${all.map(row).join('')}</div>` : `<p class="no-due">这一天是空白的。空白也是生活的一部分。</p>`}`);
    hydrateThumbs();
  };
  const hydrateThumbs = () => {
    document.querySelectorAll('[data-att][src=""]').forEach(img => {
      C.getProof(img.dataset.att).then(a => { if (a && a.data) img.src = a.data; });
    });
  };

  /* ---------- SECTION: 类别雷达 ---------- */
  const catRadar = () => {
    const rows = C.categoryRates();
    if (rows.length < 3) return '';
    const n = rows.length, cx = 110, cy = 110, R = 86;
    const pt = (i, r) => { const ang = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + Math.cos(ang) * r, cy + Math.sin(ang) * r]; };
    let svg = `<svg viewBox="0 0 220 220" class="radar" role="img" aria-label="类别完成率雷达">`;
    [0.25, 0.5, 0.75, 1].forEach(g => { const poly = Array.from({ length: n }, (_, i) => pt(i, R * g).join(',')).join(' '); svg += `<polygon points="${poly}" fill="none" stroke="var(--line)" stroke-width="1"/>`; });
    for (let i = 0; i < n; i++) { const [x, y] = pt(i, R); svg += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="var(--line)" stroke-width="1"/>`; }
    const data = rows.map((r, i) => pt(i, R * Math.max(r.rate, 3) / 100).join(',')).join(' ');
    svg += `<polygon points="${data}" fill="var(--pri)" fill-opacity=".18" stroke="var(--pri)" stroke-width="2"/>`;
    rows.forEach((r, i) => { const [x, y] = pt(i, R * Math.max(r.rate, 3) / 100); svg += `<circle cx="${x}" cy="${y}" r="3" fill="var(--pri)"/>`; });
    rows.forEach((r, i) => { const [x, y] = pt(i, R + 16); svg += `<text x="${x}" y="${y}" font-size="9" fill="var(--sub)" text-anchor="${x > 118 ? 'start' : x < 102 ? 'end' : 'middle'}" dominant-baseline="middle">${r.cat.name} ${r.rate}%</text>`; });
    return svg + '</svg>';
  };

  /* ---------- SECTION: 月历视图（可钻取） ---------- */
  const monthCalendar = mk => {
    const p = mk.split('-').map(Number), y = p[0], m = p[1];
    const first = new Date(y, m - 1, 1);
    const days = new Date(y, m, 0).getDate();
    const lead = (first.getDay() + 6) % 7;
    let cells = D.WEEKDAY.map(w => `<div class="cal-h">${w}</div>`).join('');
    for (let i = 0; i < lead; i++) cells += '<div class="cal-cell dim"></div>';
    for (let d = 1; d <= days; d++) {
      const ds = y + '-' + C.pad(m) + '-' + C.pad(d);
      const fut = ds > C.todayStr();
      const lv = fut ? 'fut' : ('l' + C.dayLevel(ds));
      const nDone = C.get().tasks.filter(t => C.checkedOn(t.id, ds)).length;
      const rest = C.dayRest(ds);
      const click = !fut;
      cells += `<div class="cal-cell ${lv}${rest ? ' rest' : ''}${click ? ' clickable' : ''}"${click ? ` data-action="day-detail" data-ds="${ds}"` : ''}><b>${d}</b>${nDone ? `<em>${nDone}✓</em>` : (rest ? '<em>休</em>' : '')}</div>`;
    }
    return `<div class="cal-wrap">${cells}</div>`;
  };

  const heatFilterChips = () => {
    const cats = C.get().tasks.map(t => t.cat);
    const uniq = Array.from(new Set(cats));
    if (uniq.length < 2) return '';
    return `<div class="chips" style="margin-bottom:12px">
      <button class="chip ${heatFilter === 'all' ? 'on' : ''}" data-action="heat-filter" data-cat="all">全部</button>
      ${uniq.map(id => { const c = catOf(id); return `<button class="chip ${heatFilter === id ? 'on' : ''}" data-action="heat-filter" data-cat="${id}">${c.icon} ${c.name}</button>`; }).join('')}
    </div>`;
  };

  let calMonth = null;
  const renderStats = () => {
    const s = C.stats();
    if (!calMonth) calMonth = C.monthKey(C.todayStr());
    const cp = calMonth.split('-');
    return `<div class="page">
      <header class="page-head"><div class="page-title-row"><h1>洞察</h1><span class="title-latin">Insights</span></div>
        <div class="head-ops"><button class="btn soft" data-action="week-report">本周周报</button>
        <button class="btn soft" data-action="month-report">月度报告</button>
        <button class="btn soft" data-action="year-report">年度报告</button></div></header>
      <div class="stat-line">
        <div class="sitem"><strong>${s.activeDays}</strong><span>坚持天数</span></div>
        <div class="sitem"><strong>${s.total}</strong><span>累计打卡</span></div>
        <div class="sitem"><strong>${s.bestStreak}</strong><span>最长连续</span></div>
        <div class="sitem"><strong>${C.perfectDays()}</strong><span>全部完成的天</span></div>
      </div>
      <section class="card"><h3>月历 · 点任意一天看当日明细</h3>
        <div class="cal-nav">
          <button class="link-btn" data-action="cal-prev">‹ 上月</button>
          <strong>${cp[0]} 年 ${+cp[1]} 月</strong>
          <button class="link-btn" data-action="cal-next" ${calMonth >= C.monthKey(C.todayStr()) ? 'disabled style="opacity:.35"' : ''}>下月 ›</button>
        </div>
        ${monthCalendar(calMonth)}</section>
      <section class="card"><h3>坚持密度 · 热力图</h3><p class="card-q">回答：我的坚持有多密？点格子看那天。</p>${heatFilterChips()}${heatmap()}</section>
      <section class="card"><h3>完成率趋势</h3><p class="card-q">回答：这个月比上个月好吗？趋势比绝对值重要。</p>${trendSvg()}</section>
      <section class="card"><h3>连续天数曲线</h3><p class="card-q">回答：我从断签里恢复过来过吗？峰谷比数字更诚实。</p>${streakCurve()}</section>
      <section class="card"><h3>本月 vs 上月</h3><p class="card-q">回答：最近的势头怎么样？</p>${monthCompare()}</section>
      <section class="card"><h3>类别分析</h3><p class="card-q">回答：哪类功课我坚持得最好？</p>
        ${catRadar() ? `<div class="radar-wrap">${catRadar()}<div class="radar-bars">${catBars()}</div></div>` : catBars()}</section>
      <section class="card"><h3>时间分布</h3><p class="card-q">回答：我通常在什么时段完成？</p>${timeRow()}</section>
      <section class="card"><h3>里程碑时间线</h3><p class="card-q">回答：我走了多远？</p>${msList()}</section>
    </div>`;
  };

  /* ---------- SECTION: 周报（REQ-013） ---------- */
  const weekReportModal = () => {
    const w = C.weekReport(0);
    const key = w.ws;
    const sent = !!C.get().meta.weeklySent[key];
    const q = D.WEEK_QUESTIONS[new Date().getDay() % D.WEEK_QUESTIONS.length];
    openModal(`<div class="modal-head"><h2>本周周报</h2><button class="x" data-action="close-modal">×</button></div>
      <p class="tpl-intro">${esc(w.label)}${w.vsPrev != null ? ` · 较上周 ${w.vsPrev >= 0 ? '+' : ''}${w.vsPrev}%` : ''}</p>
      ${w.rate == null ? '<p class="no-due">本周还没有安排任务。</p>' : `
      <div class="wr-rate"><strong>${w.rate}%</strong><span>完成率（${w.done}/${w.due} 项）</span></div>`}
      <ul class="wr-list">
        ${w.bestDay ? `<li>最佳单日：<strong>${fmtDate(w.bestDay)}</strong>，完成 ${w.bestDayCount} 项</li>` : ''}
        ${w.champ ? `<li>本周类别冠军：<strong>${w.champ.icon} ${w.champ.name}</strong></li>` : ''}
        <li>当前连续：<strong>${w.curStreak}</strong> 天</li>
      </ul>
      <div class="wr-q"><strong>留一个问题给周日的你</strong><p>${esc(q)}</p></div>
      <div class="modal-ops">
        <button class="btn ${sent ? 'ghost' : 'soft'}" data-action="send-weekly" data-key="${key}">${sent ? '✓ 已发送（模拟）' : '📧 发送邮件版'}</button>
        <button class="btn ghost" data-action="close-modal">关闭</button>
      </div>
      <p class="form-hint">邮件版为功能演示：会生成周报内容并记录发送状态，但不连接真实邮件服务。</p>`);
  };

  /* ---------- SECTION: 月度报告 ---------- */
  let monthSel = null;
  const monthReportModal = () => {
    const mks = C.monthsAvailable();
    if (!monthSel || mks.indexOf(monthSel) < 0) monthSel = mks[0];
    const r = C.monthReport(monthSel);
    const sent = !!C.get().meta.monthlySent[r.mk];
    const q = D.MONTH_QUESTIONS[(+monthSel.slice(5, 7)) % D.MONTH_QUESTIONS.length];
    openModal(`<div class="modal-head"><h2>月度报告</h2><button class="x" data-action="close-modal">×</button></div>
      <div class="chips wrap" style="margin-bottom:10px">${mks.map(m => {
        const p = m.split('-');
        return `<button class="chip ${m === monthSel ? 'on' : ''}" data-action="month-pick" data-mk="${m}">${p[0]}年${+p[1]}月</button>`;
      }).join('')}</div>
      <p class="tpl-intro">${esc(r.label)} · 已记录 ${r.days} 天</p>
      ${r.rate == null ? '<p class="no-due">这个月还没有安排任务。</p>' : `
      <div class="wr-rate"><strong>${r.rate}%</strong><span>完成率（${r.done}/${r.due} 项）</span></div>`}
      <ul class="wr-list">
        <li>来了 <strong>${r.activeDays}</strong> 天 · 全清 <strong>${r.perfect}</strong> 天</li>
        <li>本月最长连续：<strong>${r.bestStreak}</strong> 天</li>
        ${r.topTask ? `<li>最常完成：<strong>${esc(r.topTask.name)}</strong>（${r.topTask.n} 次）</li>` : ''}
      </ul>
      <div class="wr-q"><strong>留给月底的你</strong><p>${esc(q)}</p></div>
      <div class="modal-ops">
        <button class="btn ${sent ? 'ghost' : 'soft'}" data-action="send-monthly" data-key="${r.mk}">${sent ? '✓ 已发送（模拟）' : '📧 发送邮件版'}</button>
        <button class="btn ghost" data-action="close-modal">关闭</button>
      </div>
      <p class="form-hint">邮件版为功能演示：生成月报内容并记录状态，不连接真实邮件服务。</p>`);
  };

  /* ---------- SECTION: 年度报告（REQ-014，Pro） ---------- */
  const yearGate = () => {
    if (C.isPro()) return true;
    openModal(`<div class="modal-head"><h2>年度报告是 Pro 功能</h2><button class="x" data-action="close-modal">×</button></div>
      <p class="confirm-txt">把一年的坚持汇编成册：月度曲线、类别、里程碑、全年高光，可打印存 PDF。</p>
      <div class="modal-ops"><button class="btn ghost" data-action="close-modal">以后再说</button>
      <button class="btn primary" data-action="open-pro">了解 Pro</button></div>`);
    return false;
  };
  const renderReport = () => {
    if (!yearGate()) { go('stats'); return ''; }
    const ys = C.yearsAvailable();
    const y = +($('#rep-year') ? $('#rep-year').value : ys[0]) || ys[0];
    const r = C.yearReport(y);
    const maxM = Math.max(1, ...r.monthly);
    C.get().meta.seen.reportYear = true; C.save();
    return `<div class="page">
      <header class="page-head"><h1>${y} 年度回顾</h1>
        <div class="head-ops"><select id="rep-year" class="sel">${ys.map(yy => `<option ${yy === y ? 'selected' : ''}>${yy}</option>`).join('')}</select>
        <button class="btn soft" data-action="rep-print">🖨 打印 / 存 PDF</button>
        <button class="btn ghost" data-action="rep-back">返回统计</button></div></header>
      <section class="card rep-hero">
        <p class="rep-line">这一年，你来过 <strong>${r.activeDays}</strong> 天，完成 <strong>${r.total}</strong> 次。</p>
        <p class="rep-line">最长一段连续 <strong>${r.bestStreak}</strong> 天${r.first ? `；第一次打卡在 <strong>${fmtDate(r.first)}</strong>` : ''}。</p>
      </section>
      <section class="card"><h3>每月坚持天数</h3>
        <div class="rep-bars">${r.monthly.map((n, i) => `<div class="rb"><i style="height:${Math.round(n / maxM * 100)}%"></i><span>${i + 1}月</span></div>`).join('')}</div></section>
      ${r.topTask ? `<section class="card"><h3>最常完成</h3><p class="rep-line">「${esc(r.topTask.name)}」共 <strong>${r.topTask.n}</strong> 次。</p></section>` : ''}
      ${r.cats.length ? `<section class="card"><h3>类别分布</h3><ul class="rules">${r.cats.map(x => `<li>${x.cat.icon} ${x.cat.name} · ${x.n} 次</li>`).join('')}</ul></section>` : ''}
      ${r.ms.length ? `<section class="card"><h3>这一年的里程碑</h3>${`<ol class="ms-list">${r.ms.map(m => `<li><span class="ms-dot"></span><div><strong>${esc(m.label)}</strong><span>${fmtDate(m.ds)}</span></div></li>`).join('')}</ol>`}</section>` : ''}
      <section class="card"><h3>送给明年的你</h3><p class="rep-line quote">${esc(D.ENCOURAGEMENTS[y % D.ENCOURAGEMENTS.length])}</p></section>
    </div>`;
  };

  /* ---------- SECTION: badges view（等级/收藏墙/商店/结伴） ---------- */
  const weeklySummary = () => {
    if (!C.get().meta.notif.weekly) return '';
    const t = C.weeklyTrend(2);
    const cur = t[1], prev = t[0];
    const delta = cur.rate - prev.rate;
    const tone = delta > 0 ? `比上周好 ${delta}%。` : delta < 0 ? `比上周低 ${-delta}%。趋势有起伏，正常。` : '和上周持平。';
    return `<section class="card"><h3>本周回顾</h3>
      <p class="card-q">截至今天的本周完成率。</p>
      <p style="font-size:15px"><strong style="font-family:var(--num);color:var(--pri)">${cur.rate}%</strong>　<span style="color:var(--sub)">${esc(tone)}</span></p>
      <div class="set-ops" style="margin-top:10px"><button class="btn soft" data-action="week-report">看完整周报</button></div></section>`;
  };

  const shopCard = p => {
    const themes = D.THEMES.filter(t => t.cost > 0);
    const unlocked = C.get().meta.unlockedThemes || [];
    return `<section class="card"><h3>积分商店 · 用进步换一点新鲜</h3><p class="card-q">你有 ${p} 积分。皮肤是标记里程碑的方式，不买也不影响任何功能。</p>
      <div class="shop-grid">${themes.map(t => {
        const own = unlocked.indexOf(t.id) >= 0;
        const active = C.get().meta.themeId === t.id;
        return `<div class="shop-item ${own ? 'own' : ''}">
          <span class="sw" style="background:${t.pri}"></span><strong>${t.name}</strong>
          ${own ? `<button class="btn ${active ? 'soft' : 'ghost'}" data-action="use-theme" data-id="${t.id}">${active ? '使用中' : '换上'}</button>`
        : `<button class="btn primary" data-action="buy-theme" data-id="${t.id}" data-cost="${t.cost}" ${p >= t.cost ? '' : 'disabled'}>${t.cost} 分</button>`}
        </div>`;
      }).join('')}</div></section>`;
  };

  const partnerCard = () => {
    const ps = C.partners();
    const today = C.todayStr();
    return `<section class="card"><h3>结伴</h3><p class="card-q">不排名、不比较。只看到对方今天做没做，偶尔互发一句。</p>
      <div class="partner-list">${ps.map(p => {
        const msgs = C.partnerMsgs(p.id);
        const spokeToday = msgs.some(m => (m.at || '').slice(0, 10) === today);
        return `<div class="prow"><span class="pav">${p.icon}</span>
          <div class="pinfo"><strong>${p.name}</strong><p>${spokeToday ? p.today : p.line}</p></div>
          <button class="link-btn" data-action="open-chat" data-id="${p.id}">鼓励一下</button></div>`;
      }).join('')}</div>
      <p class="form-hint">当前为示例伙伴，未连接真实账号；对方动态与回复为内置文案。真实好友邀请将在接入账号体系（P0）后开放。</p></section>`;
  };

  /* ---------- SECTION: 挑战墙（历史完成过的挑战，按类型聚合） ---------- */
  const challengeWall = () => {
    const hist = C.challengeHistory() || [];
    if (!hist.length) return '';
    const cnt = {};
    hist.forEach(h => { cnt[h.id] = (cnt[h.id] || 0) + 1; });
    const last = {};
    hist.forEach(h => { if (!last[h.id]) last[h.id] = h.ds; });
    const total = hist.length;
    return `<section class="card"><h3>挑战墙</h3><p class="card-q">累计接招 ${total} 次。接过的招都留了痕。</p>
      <div class="chal-wall">${D.CHALLENGES.map(c => {
        const n = cnt[c.id] || 0;
        return `<div class="chal-cell ${n ? 'hit' : ''}"><span class="cc-ic">${n ? '✓' : '·'}</span><strong>${esc(c.t)}</strong>
          <p>${n ? n + ' 次' + (last[c.id] ? ' · 最近 ' + fmtDate(last[c.id]) : '') : '未接过'}</p></div>`;
      }).join('')}</div></section>`;
  };
  /* ---------- SECTION: 凭证墙（附过材料证明的打卡） ---------- */
  const proofWall = () => {
    const cl = [];
    Object.keys(C.get().records).forEach(tid => {
      const t = C.taskById(tid); if (!t) return;
      Object.keys(C.get().records[tid]).forEach(ds => {
        const r = C.get().records[tid][ds];
        if (r && r.att) cl.push({ tid, ds, att: r.att, name: t.name, note: r.note || '' });
      });
    });
    if (!cl.length) return '';
    cl.sort((a, b) => a.ds < b.ds ? 1 : -1);
    return `<section class="card"><h3>凭证墙</h3><p class="card-q">${cl.length} 次打卡留下了材料证明。</p>
      <div class="proof-wall">${cl.slice(0, 24).map(c => `<div class="pw-cell" data-action="view-proof" data-att="${c.att}" title="${esc(c.name)} · ${fmtDate(c.ds)}">
        <img data-att="${c.att}" src="" alt="凭证"><span>${esc(c.name)}</span></div>`).join('')}</div>
      ${cl.length > 24 ? `<p class="form-hint">仅显示最近 24 张。</p>` : ''}</section>`;
  };

  const renderBadges = () => {
    const p = C.points(), lv = C.levelOf(p);
    const earned = new Set(C.earnedBadges().map(b => b.id));
    return `<div class="page">
      <header class="page-head"><div class="page-title-row"><h1>拾获</h1><span class="title-latin">Trophies</span></div></header>
      ${weeklySummary()}
      <section class="card lv-card">
        <div class="lv-top"><span class="lv-badge">Lv.${lv.lv}</span>
          <div><strong>${lv.name}</strong><p>${p} 积分${lv.next ? ` · 距 ${lv.next.name} 还差 ${lv.next.min - p} 分` : ' · 已满级'}</p></div></div>
        <div class="lv-bar"><i style="width:${Math.round(lv.progress * 100)}%"></i></div>
        <div class="set-ops" style="margin-top:12px"><button class="btn soft" data-action="share-card">生成分享卡片</button></div>
      </section>
      <section class="card"><h3>徽章收藏墙</h3><p class="card-q">达成即点亮，永不倒扣。</p>
        <div class="badge-grid">${D.BADGES.map(b => {
          const on = earned.has(b.id);
          return `<div class="badge ${on ? 'on' : ''}" title="${esc(b.desc)}">
            <span class="b-ic">${on ? b.icon : '🔒'}</span><strong>${b.name}</strong><p>${b.desc}</p></div>`;
        }).join('')}</div>
      </section>
      ${challengeWall()}
      ${proofWall()}
      ${shopCard(p)}
      ${partnerCard()}
      <section class="card"><h3>积分怎么来</h3>
        <ul class="rules">${D.POINTS_RULES.map(r => `<li>${r}</li>`).join('')}</ul>
        <p class="form-hint">积分用来标记进步，不是任务的目的。</p></section>
    </div>`;
  };

  /* ---------- SECTION: 分享卡片（REQ-016） ---------- */
  const shareModal = () => {
    openModal(`<div class="modal-head"><h2>今日打卡卡片</h2><button class="x" data-action="close-modal">×</button></div>
      <div class="share-box"><canvas id="share-cv" width="320" height="420"></canvas></div>
      <div class="modal-ops"><button class="btn ghost" data-action="close-modal">关闭</button>
      <button class="btn primary" data-action="save-card" data-primary-action>保存 PNG 到本地</button></div>
      <p class="form-hint">卡片只含连续天数、今日完成数和一句鼓励语，不包含任何任务名称或你的数据。</p>`);
    drawCard();
  };
  const drawCard = () => {
    const cv = $('#share-cv');
    if (!cv || !cv.getContext) return;
    const ctx = cv.getContext('2d');
    const s = C.stats();
    const due = dueToday();
    const done = due.filter(t => C.checkedOn(t.id, C.todayStr())).length;
    const dark = document.documentElement.classList.contains('dark');
    const bg = dark ? '#1E2124' : '#FFFFFF';
    const fg = dark ? '#ECEAE5' : '#1A1A1A';
    const sub = dark ? '#A9ADB3' : '#666666';
    const grd = ctx.createLinearGradient(0, 0, 0, 420);
    grd.addColorStop(0, bg); grd.addColorStop(1, dark ? '#16181A' : '#FAFAF7');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, 320, 420);
    ctx.strokeStyle = dark ? '#313740' : '#E7E4DC'; ctx.strokeRect(8, 8, 304, 404);
    ctx.textAlign = 'center';
    ctx.fillStyle = sub; ctx.font = '14px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText(new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }), 160, 60);
    ctx.fillStyle = fg; ctx.font = '700 22px "Songti SC","STSong","SimSun",serif';
    ctx.fillText('日日不断，功不唐捐', 160, 110);
    ctx.fillStyle = '#3FA66A'; ctx.font = '700 92px Menlo,Consolas,monospace';
    ctx.fillText(String(s.currentStreak), 160, 220);
    ctx.fillStyle = sub; ctx.font = '15px "PingFang SC",sans-serif';
    ctx.fillText('🔥 连续完成天数', 160, 250);
    ctx.fillStyle = fg; ctx.font = '16px "PingFang SC",sans-serif';
    ctx.fillText(due.length ? `今日完成 ${done}/${due.length}` : '今天还没安排任务', 160, 300);
    ctx.fillStyle = sub; ctx.font = '13px "PingFang SC",sans-serif';
    const enc = D.ENCOURAGEMENTS[Math.floor(Math.random() * D.ENCOURAGEMENTS.length)].replace('{day}', s.currentStreak || 1);
    ctx.fillText(enc.slice(0, 26), 160, 340);
    ctx.fillStyle = sub; ctx.font = '12px "PingFang SC",sans-serif';
    ctx.fillText('· 日课 ·', 160, 386);
  };
  const saveCard = () => {
    const cv = $('#share-cv');
    if (!cv) return;
    const lk = document.createElement('a');
    lk.href = cv.toDataURL('image/png');
    lk.download = '打卡卡片-' + C.todayStr() + '.png';
    document.body.appendChild(lk); lk.click(); lk.remove();
    toast('图片已保存到下载文件夹');
  };

  /* ---------- SECTION: 结伴聊天 ---------- */
  const chatModal = pid => {
    const p = C.partners().find(x => x.id === pid);
    if (!p) return;
    const msgs = C.partnerMsgs(pid);
    openModal(`<div class="modal-head"><h2>${p.icon} ${p.name}</h2><button class="x" data-action="close-modal">×</button></div>
      <div class="chat" id="chat-box">${msgs.length ? msgs.map(m =>
        `<div class="msg ${m.from === 'me' ? 'me' : 'them'}">${esc(m.text)}</div>`).join('') : `<p class="form-hint">还没有对话。说一句吧——${p.line}。</p>`}</div>
      <div class="chat-input"><input id="chat-txt" placeholder="说一句…" maxlength="60">
      <button class="btn primary" data-action="chat-send" data-id="${pid}">发送</button></div>
      <p class="form-hint">示例伙伴：对方回复为内置文案，未连接真实账号。</p>`);
  };
  const chatSend = pid => {
    const el = $('#chat-txt');
    const text = el && el.value.trim();
    if (!text) return;
    C.sendPartnerMsg(pid, text);
    chatModal(pid);
    setTimeout(() => {
      C.receivePartnerMsg(pid, D.PARTNER_CHEERS[Math.floor(Math.random() * D.PARTNER_CHEERS.length)]);
      const box = $('#chat-box');
      if (box && $('#modal-root').__chat === pid) chatModal(pid);
    }, 900);
    $('#modal-root').__chat = pid;
  };

  /* ---------- SECTION: Pro 购买（模拟支付） ---------- */
  const proModal = () => {
    const cur = C.get().meta.pro;
    if (C.isPro()) {
      const p = cur;
      openModal(`<div class="modal-head"><h2>✦ Pro 订阅</h2><button class="x" data-action="close-modal">×</button></div>
        <p class="confirm-txt">当前 ${p.plan === 'yearly' ? '年度' : '月度'} Pro，剩余 ${C.proDaysLeft()} 天（${C.dateStr(new Date(p.expiresAt))} 到期）。</p>
        <div class="modal-ops">
          <button class="btn danger-ghost" data-action="cancel-pro">取消订阅</button>
          <button class="btn primary" data-action="close-modal">好的</button></div>
        <p class="form-hint">取消入口始终可见。到期后免费功能不受影响，历史记录全部保留。</p>`);
      return;
    }
    openModal(`<div class="modal-head"><h2>升级 Pro</h2><button class="x" data-action="close-modal">×</button></div>
      <ul class="rules" style="margin-bottom:14px">${D.PRO_PERKS.map(k => `<li>${k}</li>`).join('')}</ul>
      <div class="plan-grid">${D.PLANS.map(pl => `
        <button class="plan ${pl.id === 'yearly' ? 'best' : ''}" data-action="buy-pro" data-plan="${pl.id}">
          ${pl.save ? `<span class="save-tag">${pl.save}</span>` : ''}
          <strong>${pl.name}</strong><span class="plan-price">${pl.price}</span></button>`).join('')}</div>
      <div class="pay-row">${[['wx', '微信支付'], ['ali', '支付宝'], ['card', '银行卡']].map(([k, n]) =>
        `<label class="pay"><input type="radio" name="pay" value="${k}" ${k === 'wx' ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div>
      <p class="form-hint">⚠️ 本页面为产品功能演示：点击支付不会产生任何真实扣款，仅在本机模拟开通。</p>
      <div class="modal-ops"><button class="btn ghost" data-action="close-modal">再想想</button></div>`);
  };
  const buyPro = plan => {
    const pay = (document.querySelector('input[name=pay]:checked') || {}).value || 'wx';
    const name = { wx: '微信支付', ali: '支付宝', card: '银行卡' }[pay];
    openModal(`<div class="modal-head"><h2>确认支付</h2></div>
      <p class="confirm-txt">${name} · ${plan === 'yearly' ? '¥98 / 年' : '¥12 / 月'}（模拟，不扣款）</p>
      <div class="modal-ops"><button class="btn ghost" data-action="close-modal">取消</button>
      <button class="btn primary" data-action="pay-confirm" data-plan="${plan}">模拟支付</button></div>`);
  };

  /* ---------- SECTION: 备份弹层 / 安全状态 ---------- */
  const fmtBytes = n => {
    if (!n && n !== 0) return '—';
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(0) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  };
  const refreshSecStatus = () => {
    const box = $('#sec-status'); if (!box) return;
    Promise.all([C.storageEstimate(), C.attachInfo(), C.listBackups()]).then(([est, att, bks]) => {
      const lines = [];
      const used = est ? est.usage : null, quota = est ? est.quota : null;
      if (used != null) lines.push('存储占用 ' + fmtBytes(used) + (quota ? ' / 可用 ' + fmtBytes(quota) : ''));
      const mErr = C.getSaveError();
      lines.push(mErr ? '⚠ 主存储写入异常（' + mErr + '），已靠 IndexedDB 镜像兜底，请尽快导出完整包' : '✅ 主存储 + IndexedDB 镜像正常');
      if (att && att.count) lines.push('凭证 ' + att.count + ' 张，约 ' + fmtBytes(att.approxKB * 1024));
      if (bks && bks.length) lines.push('本机备份 ' + bks.length + ' 份（最近 ' + new Date(bks[0].ts).toLocaleDateString('zh-CN') + '）');
      box.innerHTML = lines.map(l => '<p>' + esc(l) + '</p>').join('');
    });
  };
  const backupModal = () => {
    C.listBackups().then(bks => {
      const rows = bks.length ? bks.map(b => `<div class="bk-row">
        <div class="bk-info"><strong>${esc(b.label)}</strong><p>${new Date(b.ts).toLocaleString('zh-CN')} · ${fmtBytes(b.size)}</p></div>
        <button class="btn soft" data-action="backup-restore" data-bid="${esc(b.id)}">恢复</button>
        <button class="link-btn danger" data-action="backup-del" data-bid="${esc(b.id)}">删</button>
      </div>`).join('') : '<p class="form-hint">还没有备份。点「立即备份」存第一份。</p>';
      openModal(`<div class="modal-head"><h2>备份与恢复</h2><button class="x" data-action="close-modal">×</button></div>
        <p class="tpl-intro">备份存于本机 IndexedDB（含凭证），换设备请用「导出完整包」。每日自动备份保留最近 14 天。</p>
        <div class="bk-list">${rows}</div>
        <div class="modal-ops"><button class="btn primary" data-action="backup-now">立即备份</button>
        <button class="btn ghost" data-action="close-modal">关闭</button></div>`);
    });
  };

  /* ---------- SECTION: settings view ---------- */
  const switchRow = (key, name, desc) => {
    const on = C.get().meta.notif[key];
    return `<div class="set-row"><div><strong>${name}</strong><p>${desc}</p></div>
      <button class="switch ${on ? 'on' : ''}" data-action="notif-toggle" data-key="${key}" role="switch" aria-checked="${on}" aria-label="${name}"></button></div>`;
  };
  const renderSettings = () => {
    const m = C.get().meta;
    const themeBtns = [['auto', '跟随系统'], ['light', '浅色'], ['dark', '深色']].map(([k, n]) =>
      `<button class="chip ${m.theme === k ? 'on' : ''}" data-action="theme" data-theme="${k}">${n}</button>`).join('');
    const soundOn = !!m.sound;
    const skinBtns = D.THEMES.map(t => {
      const own = t.cost === 0 || C.isPro() || (m.unlockedThemes || []).indexOf(t.id) >= 0;
      return `<button class="chip ${m.themeId === t.id ? 'on' : ''}" data-action="skin" data-id="${t.id}">
        <i class="sw sw-sm" style="background:${t.pri}"></i> ${t.name}${own ? '' : `（${t.cost}分）`}</button>`;
    }).join('');
    return `<div class="page">
      <header class="page-head"><h1>设置</h1></header>
      <section class="card"><h3>Pro 订阅</h3>
        <p style="font-size:14px;color:var(--sub);margin-bottom:10px">${C.isPro() ? `✦ Pro ${C.proDaysLeft()} 天后到期` : '免费版：核心功能全部可用；Pro 解锁年度报告、皮肤与不限量休息日。'}</p>
        <button class="btn primary" data-action="open-pro">${C.isPro() ? '管理订阅' : '了解 Pro'}</button></section>
      <section class="card"><h3>主题</h3><div class="chips">${themeBtns}</div>
        <p style="margin-top:10px" class="card-q">皮肤</p><div class="chips">${skinBtns}</div></section>
      <section class="card"><h3>打卡音效</h3>
        <div class="set-row"><div><p>完成打卡时播放一段轻快的短音（约 0.3 秒）。默认关闭，安静场景友好。</p></div>
        <button class="switch ${soundOn ? 'on' : ''}" data-action="sound-toggle" role="switch" aria-checked="${soundOn}" aria-label="打卡音效"></button></div></section>
      <section class="card"><h3>提醒（应用内）</h3>
        ${switchRow('morning', '晨间提醒', '有功课未做时，在今日页顶部出现一条邀请式提示')}
        ${switchRow('evening', '晚间收工提醒', '晚上 8 点后仍有未完成的功课时提示，会带上那门课写下的「为什么」')}
        ${switchRow('streak', '里程碑提醒', '即将达成连续天数里程碑时提示')}
        ${switchRow('weekly', '每周回顾', '在拾获页显示本周小结，可一键查看完整周报')}
        <p class="form-hint">本机版提醒只在页面内展示，不会真实推送或打扰你。每天最多展示一条。</p></section>
      <section class="card"><h3>数据安全</h3>
        <div id="sec-status" class="sec-status">读取存储状态…</div>
        <div class="set-ops">
          <button class="btn primary" data-action="backup-now">立即备份</button>
          <button class="btn soft" data-action="backup-list">备份与恢复</button>
          <button class="btn soft" data-action="export-bundle">导出完整包（含凭证）</button>
          <button class="btn soft" data-action="import-bundle">导入完整包</button>
        </div>
        <div class="set-ops" style="margin-top:8px">
          <button class="btn ghost" data-action="export">仅导出记录（JSON）</button>
          <button class="btn ghost" data-action="export-csv">打卡记录（CSV）</button>
          ${!m.demo && !C.get().tasks.length ? '<button class="btn ghost" data-action="seed">载入示例数据</button>' : ''}
          <button class="btn danger-ghost" data-action="clear">清空所有数据</button>
        </div>
        <p class="form-hint">防丢三重：主数据存 localStorage，每次写入实时镜像到 IndexedDB，每日自动备份（留最近 14 天）。localStorage 损坏或被清空时自动从镜像恢复。凭证照片单独存 IndexedDB，需导出「完整包」才能一并带走。</p></section>
      <section class="card about"><h3>关于</h3>
        <p style="font-family:var(--serif);font-size:17px">日课 · 本地体验版 v5</p>
        <p class="dim">日日不断，功不唐捐。桌面快捷键 <kbd>N</kbd> 立一课 · <kbd>T</kbd> 回今日；手机可「添加到主屏幕」，离线也能打卡。</p>
        <p class="dim">数据三道保险：localStorage + IndexedDB 镜像 + 每日自动备份，损坏可自愈，换设备导完整包。</p>
        <p class="dim">最好的坚持系统，是让你忘记它的存在，只记得那些完成了的日子。</p></section>
    </div>`;
  };

  /* ---------- SECTION: welcome back（REQ-016） ---------- */
  const welcomeBackCheck = () => {
    const m = C.get().meta;
    const today = C.todayStr();
    let show = false;
    if (m.lastVisit && m.lastVisit < today && (C.diffDays(m.lastVisit, today) >= 3) && m.welcomeShown !== today && C.get().tasks.length) {
      show = true;
    }
    m.lastVisit = today;
    if (show) {
      m.welcomeShown = today;
      const left = C.restLeft(today);
      openModal(`<div class="modal-head"><h2>👋</h2></div>
        <p class="confirm-txt" style="font-size:16px;color:var(--text)">${esc(D.WELCOME_BACK[Math.floor(Math.random() * D.WELCOME_BACK.length)])}</p>
        <div class="modal-ops">
          ${left > 0 && !C.isChecked(today) ? '<button class="btn soft" data-action="wb-rest">今天算休息日</button>' : ''}
          <button class="btn primary" data-action="close-modal">看看今天的</button></div>`);
    }
    C.save();
  };

  /* ---------- SECTION: onboarding ---------- */
  let ob = null;
  const obStart = () => { ob = { step: 0, domains: [], tplIdx: null }; renderOb(); };
  const obDomainBtns = () => D.CATEGORIES.map(c =>
    `<button class="ob-dom ${ob.domains.includes(c.id) ? 'on' : ''}" data-action="ob-dom" data-cat="${c.id}">
      <span style="color:${c.color}">${c.icon}</span>${c.name}</button>`).join('');
  const obTpls = () => {
    let tpls = D.TEMPLATES.map((tp, i) => ({ ...tp, i }));
    if (ob.domains.length) {
      const f = tpls.filter(tp => ob.domains.includes(tp.cat));
      if (f.length) tpls = f;
    }
    return tpls.slice(0, 6).map(tp =>
      `<button class="ob-tpl ${ob.tplIdx === tp.i ? 'on' : ''}" data-action="ob-tpl" data-i="${tp.i}">
        <strong>${esc(tp.name)}</strong><span>${D.FREQ_LABEL[tp.freq]} · ${catOf(tp.cat).name}</span></button>`).join('');
  };
  const renderOb = () => {
    const root = $('#ob-root');
    let html = '';
    if (ob.step === 0) {
      html = `<div class="ob-hero">
        <div class="ob-logo">❋</div><h1>日课 · 日日不断，功不唐捐</h1>
        <p>${esc(D.BRAND.welcome)}不催促、不惩罚，只帮你把想做的事，一天一天做下去。</p>
        <button class="btn primary big" data-action="ob-next" data-primary-action>开始</button>
        <button class="link-btn" data-action="ob-demo">先看示例</button></div>`;
    } else if (ob.step === 1) {
      html = `<h1>你最近想在哪方面用点力？</h1><p class="ob-sub">选 1–3 个，我们会据此推荐任务模板。可以跳过。</p>
        <div class="ob-doms">${obDomainBtns()}</div>
        <div class="ob-ops"><button class="btn ghost" data-action="ob-skip">跳过</button>
        <button class="btn primary" data-action="ob-next" ${ob.domains.length ? '' : 'disabled'}>下一步</button></div>`;
    } else if (ob.step === 2) {
      html = `<h1>立你的第一课</h1><p class="ob-sub">挑一格现成的，或自己写一句。</p>
        <div class="ob-tpls">${obTpls()}</div>
        <div class="ob-custom"><input id="ob-name" placeholder="或者，写你自己的任务…" maxlength="40"></div>
        <div class="ob-ops"><button class="btn ghost" data-action="ob-back">上一步</button>
        <button class="btn primary" data-action="ob-create" data-primary-action>就用这个</button></div>`;
    } else if (ob.step === 3) {
      html = `<h1>最后一小步</h1><p class="ob-sub">这件事为什么重要？在你不想起床的那天，这句话会还给你。可以跳过。</p>
        <div class="ob-custom"><input id="ob-why" placeholder="例如：想在孩子面前，做个读书的大人" maxlength="30"></div>
        <div class="ob-ops"><button class="btn ghost" data-action="ob-back">上一步</button>
        <button class="btn primary" data-action="ob-why-save">写好了</button>
        <button class="link-btn" data-action="ob-why-save" data-skip="1">跳过</button></div>`;
    } else if (ob.step === 4) {
      const st = C.get();
      const t = st.tasks[st.tasks.length - 1];
      html = `<div class="ob-hero">
        <h1>最后一小步</h1><p class="ob-sub">如果这件事今天已经做了（哪怕只做了一点点），点下面的按钮。这是你的第一次打卡。</p>
        <div class="ob-check-card"><span>${esc(t ? t.name : '')}</span>
        <button class="check big-check" data-action="ob-check" data-id="${t ? t.id : ''}" data-primary-action aria-label="完成打卡"></button></div>
        <p class="form-hint">只做了一部分也算完成。记录阻力越小，越容易坚持。</p></div>`;
    } else if (ob.step === 5) {
      html = `<div class="ob-hero">
        <div class="ob-logo">✅</div><h1>你已经开始了，明天见</h1>
        <p class="ob-sub">接下来：在「洞察」看热力图与周报，在「拾获」收集徽章、找个伙伴。</p>
        <p class="ob-sub">手机浏览器菜单里选「添加到主屏幕」，它会像一个真正的 App，断网也能打卡。</p>
        <button class="btn primary big" data-action="ob-done">进入我的今日</button></div>`;
    }
    root.innerHTML = html;
    root.hidden = false;
    document.body.classList.add('ob-mode');
    $('#sidebar').innerHTML = ''; $('#bottom-nav').innerHTML = '';
  };
  const obFinish = () => {
    C.get().meta.onboarded = true; C.save();
    $('#ob-root').hidden = true; $('#ob-root').innerHTML = '';
    document.body.classList.remove('ob-mode');
    render();
  };

  /* ---------- SECTION: check action（三层反馈：即时→里程碑庆祝→随机惊喜） ---------- */
  const afterCheck = (beforeSet, scene) => {
    playChime();
    const s = C.stats();
    const due = dueToday();
    const allDone = due.length > 0 && due.every(t => C.checkedOn(t.id, C.todayStr()));
    const newB = beforeSet ? C.earnedBadges().filter(b => !beforeSet.has(b.id)) : [];
    const msHit = [7, 21, 30, 60, 100, 365].indexOf(s.currentStreak) >= 0;
    if (msHit) {
      celebrate('🔥', `连续 ${s.currentStreak} 天`, D.SCENE_ENC.milestone(s.currentStreak));
    } else if (newB.length) {
      const b = newB[0];
      celebrate(b.icon, `解锁「${b.name}」`, b.desc);
    }
    const sp = C.rollSurprise();
    if (sp && sp.type === 'bonus') toast(sp.text);
    else if (sp && sp.type === 'easter') toast(`${sp.icon} ${sp.text}`);
    else if (scene === 'makeup') toast(C.nextEncouragement('makeup'));
    else if (C.get().meta.restartDate === C.todayStr() && C.currentStreak() === 1) toast(C.nextEncouragement('comeback'));
    else if (allDone) toast(C.nextEncouragement('all'));
    else toast(C.nextEncouragement());
  };

  /* ---------- SECTION: 完成光扫（重渲染后仍触发） ---------- */
  let sheenQueue = [];
  const markSheen = id => { sheenQueue.push(id); };
  const flushSheen = () => {
    if (!sheenQueue.length) return;
    sheenQueue.forEach(id => {
      const row = document.querySelector('.task-row[data-task="' + id + '"]');
      if (row) { row.classList.remove('justdone'); void row.offsetWidth; row.classList.add('justdone'); setTimeout(() => row.classList.remove('justdone'), 750); }
    });
    sheenQueue = [];
  };

  /* ---------- SECTION: render root ---------- */
  const render = () => {
    renderNav();
    const v = $('#view');
    if (view === 'today') v.innerHTML = renderToday();
    else if (view === 'tasks') v.innerHTML = renderTasks();
    else if (view === 'stats') v.innerHTML = renderStats();
    else if (view === 'badges') v.innerHTML = renderBadges();
    else if (view === 'archive') v.innerHTML = renderArchive();
    else if (view === 'report') v.innerHTML = renderReport();
    else v.innerHTML = renderSettings();
    window.scrollTo(0, 0);
    $('#main').scrollTop = 0;
    flushSheen();
    hydrateThumbs();
    if (view === 'settings') refreshSecStatus();
  };

  /* ---------- SECTION: events（事件委托） ---------- */
  const closest = (el, sel) => el.closest ? el.closest(sel) : null;
  document.addEventListener('click', e => {
    const el = closest(e.target, '[data-action]');
    if (!el) return;
    const a = el.dataset.action, id = el.dataset.id;

    if (a === 'nav') { go(el.dataset.view); return; }
    if (a === 'add-task') { taskModal(null); return; }
    if (a === 'open-tpl') { tplModal(); return; }
    if (a === 'close-modal') { closeModal(); return; }
    if (a === 'modal-mask') { if (e.target === el) closeModal(); return; }
    if (a === 'notif-dismiss') { C.get().meta.seen[el.dataset.type] = C.todayStr(); C.save(); render(); return; }

    if (a === 'check') {
      const done = C.checkedOn(id, C.todayStr());
      const t = C.taskById(id);
      /* 需要凭证的功课：未完成时先走凭证弹层 */
      if (!done && t && t.needProof) {
        const r = C.recOf(id, C.todayStr());
        if (!r || !r.att) { proofModal(id, C.todayStr(), 'req'); return; }
      }
      const beforeSet = done ? null : new Set(C.earnedBadges().map(b => b.id));
      if (done) C.uncheck(id, C.todayStr());
      else { C.checkin(id, C.todayStr(), false); markSheen(id); }
      if (!done) afterCheck(beforeSet);
      render();
      return;
    }
    if (a === 'proof') { const t = C.taskById(id); if (t && !C.checkedOn(id, C.todayStr())) { proofModal(id, C.todayStr(), 'opt'); return; } }
    if (a === 'proof-clear') { proofDraft.data = ''; proofDraft.att = ''; const pv = document.querySelector('.proof-prev'), pe = document.querySelector('.proof-empty'); if (pv) pv.hidden = true; if (pe) pe.style.display = ''; return; }
    if (a === 'proof-confirm') { doProofConfirm(el.dataset.mode); return; }
    if (a === 'view-proof') { proofLightbox(el.dataset.att); return; }
    if (a === 'bump') {
      const beforeSet = new Set(C.earnedBadges().map(b => b.id));
      const r = C.bump(id, C.todayStr(), parseFloat(el.dataset.d));
      if (r && r.done) { afterCheck(beforeSet); markSheen(id); }
      render();
      return;
    }
    if (a === 'makeup') {
      const yd = yesterdayStr();
      const list = C.get().tasks.filter(t => C.scheduledOn(t, yd) && !C.checkedOn(t.id, yd));
      const np = list.filter(t => t.needProof);
      list.forEach(t => C.checkin(t.id, yd, true));
      if (np.length) toast(`补了 ${list.length - np.length} 项；${np.length} 项要凭证，点开那天附证才算完成。`);
      else toast(C.nextEncouragement('makeup'));
      render(); return;
    }
    if (a === 'proof-at') { proofModal(el.dataset.id, el.dataset.ds, 'opt'); return; }
    if (a === 'rest-day') {
      if (C.takeRestDay(C.todayStr())) { toast('休息日已记录，连续天数不会断。'); render(); }
      else toast('本月 2 次休息额度已用完（升级 Pro 可不限量）。');
      return;
    }
    if (a === 'wb-rest') { C.takeRestDay(C.todayStr()); closeModal(); toast('休息日已记录。'); render(); return; }
    if (a === 'chal-done') {
      if (C.completeChallenge()) { playChime(); toast('挑战完成，+8 分。这就是给自己加的菜。'); render(); }
      return;
    }
    if (a === 'chal-skip') { C.skipChallenge(); render(); return; }
    if (a === 'reduce') {
      const rows = C.categoryRates().sort((x, y) => x.rate - y.rate);
      const worstCat = rows[rows.length - 1];
      let target = null, worst = 2;
      if (worstCat) {
        C.get().tasks.filter(t => t.status === 'active' && t.cat === worstCat.cat.id && C.scheduledOn(t, C.todayStr())).forEach(t => {
          const rate = worstCat.due ? worstCat.done / worstCat.due : 0;
          if (!target || rate < worst) { target = t; worst = rate; }
        });
      }
      if (target) { C.setTaskStatus(target.id, 'paused'); toast(`已暂停「${target.name}」。剩几件，做成几件。`); }
      else toast('任务已经不多了。那就先把今天的做到一件也好。');
      render(); return;
    }
    if (a === 'fatigue-later') { C.get().meta.fatigueDismiss = C.dateStr(C.addDays(new Date(), 7)); C.save(); render(); return; }
    if (a === 'coach-yes') {
      const adv = C.coachAdvice();
      const msg = adv ? C.applyCoach(adv.act) : '';
      if (adv) C.markCoachShown(adv.key);
      toast(msg ? msg + ' 调整好了。' : '已记下。');
      render(); return;
    }
    if (a === 'coach-no') { C.markCoachShown(el.dataset.key || 'no'); render(); return; }

    if (a === 'task-tab') { taskTab = el.dataset.tab; render(); return; }
    if (a === 'edit-task') { taskModal(id); return; }
    if (a === 'pause-task') { C.setTaskStatus(id, 'paused'); closeModal(); toast('已暂停，历史保留'); render(); return; }
    if (a === 'resume-task') { C.setTaskStatus(id, 'active'); closeModal(); toast('已恢复'); render(); return; }
    if (a === 'archive-task') { C.setTaskStatus(id, 'archived'); closeModal(); toast('已归档'); render(); return; }
    if (a === 'unarchive-task') { C.setTaskStatus(id, 'active'); closeModal(); toast('已放回'); render(); return; }
    if (a === 'delete-task') {
      openModal(`<div class="modal-head"><h2>删除任务</h2></div>
        <p class="confirm-txt">删除后该任务的打卡记录也会移除，无法恢复。如果只是暂时不做，建议「暂停」或「归档」。</p>
        <div class="modal-ops"><button class="btn ghost" data-action="close-modal">取消</button>
        <button class="btn danger" data-action="delete-yes" data-id="${id}">确认删除</button></div>`);
      return;
    }
    if (a === 'delete-yes') { C.deleteTask(id); closeModal(); toast('已删除'); render(); return; }
    if (a === 'dos-csv') {
      const d = C.taskStats(id); if (!d) return;
      const lines = [['日期', '完成量', '单位', '补打', '时间']];
      Object.keys(C.get().records[id] || {}).sort().forEach(ds => {
        const r = C.get().records[id][ds];
        lines.push([ds, r.v, d.t.unit || '', r.mk ? '是' : '', r.at || '']);
      });
      const csv = '\uFEFF' + lines.map(r => r.map(x => /[",\n]/.test(String(x)) ? '"' + String(x).replace(/"/g, '""') + '"' : x).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const lk = document.createElement('a');
      lk.href = url; lk.download = '功课-' + d.t.name + '-' + C.todayStr() + '.csv';
      document.body.appendChild(lk); lk.click(); lk.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('本课记录已导出'); return;
    }

    if (a === 'nl-parse') { nlPreview(); return; }
    if (a === 'nl-confirm') { nlConfirm(); return; }
    if (a === 'nl-manual') {
      const p = $('#modal-root').__parsed; closeModal();
      if (p) taskModal(null, p);
      return;
    }

    if (a === 'freq') {
      document.querySelectorAll('#modal-root .chip[data-freq]').forEach(c => c.classList.remove('on'));
      el.classList.add('on');
      $('#f-week').style.display = el.dataset.freq === 'weekly' ? '' : 'none';
      return;
    }
    if (a === 'cat') {
      document.querySelectorAll('#modal-root .chip[data-cat]').forEach(c => c.classList.remove('on'));
      el.classList.add('on'); return;
    }
    if (a === 'day') { el.classList.toggle('on'); return; }
    if (a === 'diff') {
      document.querySelectorAll('#modal-root .chip[data-diff]').forEach(c => c.classList.remove('on'));
      el.classList.add('on'); return;
    }
    if (a === 'proof-flag') {
      document.querySelectorAll('#modal-root .chip[data-proof-flag], #modal-root [data-action="proof-flag"]').forEach(c => c.classList.remove('on'));
      el.classList.add('on');
      $('#modal-root').__proof = el.dataset.v === '1';
      return;
    }
    if (a === 'open-dossier') { dossierModal(id); return; }
    if (a === 'save-task') {
      const weekly = document.querySelector('#modal-root .chip.on[data-freq="weekly"]');
      const root = $('#modal-root');
      if (weekly) root.__draft.weekDays = Array.from(root.querySelectorAll('.chip.day.on')).map(b => +b.dataset.day);
      saveTaskFromModal(id || null); return;
    }
    if (a === 'use-tpl') {
      const tp = D.TEMPLATES[+el.dataset.i];
      C.addTask(tplToTask(tp));
      closeModal(); toast('已按模板创建'); view = 'today'; render(); return;
    }
    if (a === 'heat-filter') { heatFilter = el.dataset.cat; render(); return; }
    if (a === 'cal-prev') { const p = calMonth.split('-').map(Number); const d = new Date(p[0], p[1] - 2, 1); calMonth = d.getFullYear() + '-' + C.pad(d.getMonth() + 1); render(); return; }
    if (a === 'cal-next') { const p = calMonth.split('-').map(Number); const d = new Date(p[0], p[1], 1); const nk = d.getFullYear() + '-' + C.pad(d.getMonth() + 1); if (nk <= C.monthKey(C.todayStr())) { calMonth = nk; render(); } return; }
    if (a === 'day-detail') { dayDetailModal(el.dataset.ds); return; }
    if (a === 'week-report') { weekReportModal(); return; }
    if (a === 'month-report') { monthSel = null; monthReportModal(); return; }
    if (a === 'month-pick') { monthSel = el.dataset.mk; monthReportModal(); return; }
    if (a === 'send-monthly') {
      C.get().meta.monthlySent[el.dataset.key] = true; C.save();
      toast('邮件版月报已生成（模拟发送，不连接真实邮件服务）');
      monthReportModal(); return;
    }
    if (a === 'send-weekly') {
      C.get().meta.weeklySent[el.dataset.key] = true; C.save();
      toast('邮件版周报已生成（模拟发送，不连接真实邮件服务）');
      weekReportModal(); return;
    }
    if (a === 'year-report') { if (yearGate()) { view = 'report'; render(); } return; }
    if (a === 'rep-print') { window.print(); return; }
    if (a === 'rep-back') { go('stats'); return; }

    if (a === 'share-card') { shareModal(); return; }
    if (a === 'save-card') { saveCard(); return; }
    if (a === 'open-chat') { chatModal(id); return; }
    if (a === 'chat-send') { chatSend(id); return; }

    if (a === 'open-pro') { closeModal(); proModal(); return; }
    if (a === 'buy-pro') { buyPro(el.dataset.plan); return; }
    if (a === 'pay-confirm') {
      C.activatePro(el.dataset.plan); closeModal(); applyTheme();
      toast('✦ Pro 已开通（模拟）。皮肤与年度报告已解锁。');
      render(); return;
    }
    if (a === 'cancel-pro') {
      C.cancelPro(); closeModal();
      toast('已取消订阅。Pro 权益保留至本周期结束，数据不受影响。');
      render(); return;
    }
    if (a === 'buy-theme') {
      const cost = +el.dataset.cost;
      const p = C.points();
      if (p < cost) { toast('积分还差一点。徽章会等你。'); return; }
      const m = C.get().meta;
      m.unlockedThemes = (m.unlockedThemes || []).concat([el.dataset.id]);
      m.spent = (m.spent || 0) + cost;
      m.themeId = el.dataset.id;
      C.save(); applyTheme(); toast('已解锁并换上「' + D.THEMES.find(t => t.id === el.dataset.id).name + '」');
      render(); return;
    }
    if (a === 'use-theme') { C.get().meta.themeId = el.dataset.id; C.save(); applyTheme(); render(); return; }
    if (a === 'skin') {
      const t = D.THEMES.find(x => x.id === el.dataset.id);
      if (t && skinUnlocked(t.id)) { C.get().meta.themeId = t.id; C.save(); applyTheme(); render(); }
      else if (t) toast(`需要 ${t.cost} 积分解锁，或升级 Pro。在成就页的积分商店兑换。`);
      return;
    }

    if (a === 'theme') { C.get().meta.theme = el.dataset.theme; C.save(); applyTheme(); render(); return; }
    if (a === 'sound-toggle') { C.setSound(!C.get().meta.sound); render(); toast(C.get().meta.sound ? '音效已开启' : '音效已关闭'); return; }
    if (a === 'export-csv') {
      const blob = new Blob([C.exportCSV()], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const lk = document.createElement('a');
      lk.href = url; lk.download = '打卡记录-' + C.todayStr() + '.csv';
      document.body.appendChild(lk); lk.click(); lk.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('打卡记录已导出 CSV'); return;
    }
    if (a === 'notif-toggle') { const k = el.dataset.key; C.get().meta.notif[k] = !C.get().meta.notif[k]; C.save(); render(); return; }
    if (a === 'backup-now') {
      C.makeBackup('手动备份 ' + C.todayStr()).then(r => {
        if (r.ok) { toast('已备份到本机（含凭证）'); refreshSecStatus(); }
        else toast(r.reason === 'idb' ? '此浏览器不支持本地备份存储' : '备份失败，请重试');
      }); return;
    }
    if (a === 'backup-list') { backupModal(); return; }
    if (a === 'backup-restore') {
      const bid = el.dataset.bid;
      openModal(`<div class="modal-head"><h2>恢复这份备份？</h2></div>
        <p class="confirm-txt">恢复会用备份内容替换当前数据。建议先点「立即备份」存一份现状。</p>
        <div class="modal-ops"><button class="btn ghost" data-action="close-modal">取消</button>
        <button class="btn primary" data-action="backup-restore-yes" data-bid="${bid}">确认恢复</button></div>`);
      return;
    }
    if (a === 'backup-restore-yes') {
      C.restoreBackup(el.dataset.bid).then(ok => { closeModal(); if (ok) { toast('已从备份恢复'); applyTheme(); render(); } else toast('恢复失败：备份不可读'); });
      return;
    }
    if (a === 'backup-del') { C.deleteBackup(el.dataset.bid).then(() => backupModal()); return; }
    if (a === 'export-bundle') {
      C.exportBundle().then(str => {
        const blob = new Blob([str], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const lk = document.createElement('a');
        lk.href = url; lk.download = '日课完整备份-' + C.todayStr() + '.json';
        document.body.appendChild(lk); lk.click(); lk.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1500);
        toast('完整包已导出（含凭证）');
      }); return;
    }
    if (a === 'import-bundle') {
      openModal(`<div class="modal-head"><h2>导入完整包</h2><button class="x" data-action="close-modal">×</button></div>
        <p class="confirm-txt">选择或粘贴此前导出的「完整包」JSON（含凭证）。导入会替换当前数据，请先备份现状。</p>
        <textarea id="bundle-txt" class="imp-area" placeholder='{"app":"rike", …}'></textarea>
        <label class="btn soft" style="margin-top:10px;display:inline-block">从文件读取<input id="bundle-file" type="file" accept="application/json,.json" hidden></label>
        <div class="modal-ops"><button class="btn ghost" data-action="close-modal">取消</button>
        <button class="btn primary" data-action="import-bundle-yes">确认导入</button></div>`);
      return;
    }
    if (a === 'import-bundle-yes') {
      const txt = $('#bundle-txt').value;
      C.importBundle(txt).then(ok => { closeModal(); if (ok) { toast('完整包导入成功'); applyTheme(); render(); } else toast('格式不对，导入失败'); });
      return;
    }
    if (a === 'export') {
      const blob = new Blob([C.exportJSON()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const lk = document.createElement('a');
      lk.href = url; lk.download = 'task-tracker-export-' + C.todayStr() + '.json';
      document.body.appendChild(lk); lk.click(); lk.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('数据已导出'); return;
    }
    if (a === 'import') {
      openModal(`<div class="modal-head"><h2>导入备份</h2><button class="x" data-action="close-modal">×</button></div>
        <p class="confirm-txt">粘贴之前导出的 JSON。导入会替换当前所有数据。</p>
        <textarea id="imp-txt" class="imp-area" placeholder='{"version":2,"tasks":[…]}'></textarea>
        <div class="modal-ops"><button class="btn ghost" data-action="close-modal">取消</button>
        <button class="btn primary" data-action="import-yes">确认导入</button></div>`);
      return;
    }
    if (a === 'import-yes') {
      const ok = C.importJSON($('#imp-txt').value);
      closeModal();
      if (ok) { applyTheme(); toast('导入成功'); render(); }
      else toast('格式不对，导入失败');
      return;
    }
    if (a === 'seed') { C.seedDemo(); applyTheme(); render(); toast('示例数据已载入'); return; }
    if (a === 'clear') {
      openModal(`<div class="modal-head"><h2>清空所有数据</h2></div>
        <p class="confirm-txt">所有任务、打卡记录、积分和徽章都会被删除，且无法恢复。建议先导出备份。</p>
        <div class="modal-ops"><button class="btn ghost" data-action="close-modal">取消</button>
        <button class="btn danger" data-action="clear-yes">确认清空</button></div>`);
      return;
    }
    if (a === 'clear-yes') { closeModal(); C.resetAll(); obStart(); return; }

    /* onboarding */
    if (a === 'ob-next') { ob.step++; renderOb(); return; }
    if (a === 'ob-back') { ob.step--; renderOb(); return; }
    if (a === 'ob-skip') { ob.step = 2; renderOb(); return; }
    if (a === 'ob-dom') {
      const c = el.dataset.cat, i = ob.domains.indexOf(c);
      if (i >= 0) ob.domains.splice(i, 1);
      else if (ob.domains.length < 3) ob.domains.push(c);
      else { toast('最多选 3 个'); return; }
      renderOb(); return;
    }
    if (a === 'ob-tpl') {
      ob.tplIdx = +el.dataset.i;
      document.querySelectorAll('#ob-root .ob-tpl').forEach(b => b.classList.remove('on'));
      el.classList.add('on');
      return;
    }
    if (a === 'ob-create') {
      const nameEl = document.getElementById('ob-name');
      const custom = nameEl ? nameEl.value.trim() : '';
      const tp = ob.tplIdx != null ? D.TEMPLATES[ob.tplIdx] : null;
      if (custom) C.addTask({ name: custom, cat: (ob.domains[0] || 'life'), freq: 'daily', type: 'habit' });
      else if (tp) C.addTask(tplToTask(tp));
      else { toast('挑一格，或自己写一句'); return; }
      ob.step = 3; renderOb(); return;
    }
    if (a === 'ob-why-save') {
      const wEl = document.getElementById('ob-why');
      const why = el.dataset.skip === '1' ? '' : (wEl ? wEl.value.trim() : '');
      const st = C.get();
      const t = st.tasks[st.tasks.length - 1];
      if (why && t) C.updateTask(t.id, { why });
      ob.step = 4; renderOb(); return;
    }
    if (a === 'ob-check') {
      C.checkin(id, C.todayStr(), false);
      ob.step = 5; renderOb();
      playChime();
      setTimeout(() => { celebrate('🌱', '第 1 天', C.nextEncouragement('first')); }, 250);
      return;
    }
    if (a === 'ob-done') { obFinish(); return; }
    if (a === 'ob-demo') { C.seedDemo(); C.get().meta.onboarded = true; C.get().meta.lastVisit = C.todayStr(); C.save(); obFinish(); toast('示例数据已载入，随便改'); return; }
  });

  /* 年度报告年份切换 + 凭证选图（input 不走 click 委托） */
  document.addEventListener('change', e => {
    if (e.target && e.target.id === 'rep-year') { render(); return; }
    if (e.target && e.target.id === 'proof-file') { onProofFile(e.target); return; }
    if (e.target && e.target.id === 'bundle-file') {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      const fr = new FileReader();
      fr.onload = () => { const box = $('#bundle-txt'); if (box) box.value = fr.result; toast('文件已读入，点确认导入'); };
      fr.readAsText(f);
      return;
    }
  });

  /* ---------- SECTION: 点击涟漪（全局，作用于 .btn/.chip/.check/.nav-item 等） ---------- */
  document.addEventListener('pointerdown', e => {
    const tgt = closest(e.target, '.btn, .chip, .check, .nav-item, .bn-item, .dossier-item, .tpl, .ghost-btn, .add-fab');
    if (!tgt) return;
    try {
      const rect = tgt.getBoundingClientRect();
      const sz = Math.max(rect.width, rect.height);
      const sp = document.createElement('span');
      sp.className = 'rip';
      sp.style.width = sp.style.height = sz + 'px';
      sp.style.left = (e.clientX - rect.left - sz / 2) + 'px';
      sp.style.top = (e.clientY - rect.top - sz / 2) + 'px';
      if (getComputedStyle(tgt).position === 'static') tgt.style.position = 'relative';
      if (getComputedStyle(tgt).overflow !== 'hidden') { tgt.style.overflow = 'hidden'; tgt.dataset.ripClip = '1'; }
      tgt.appendChild(sp);
      setTimeout(() => { sp.remove(); if (tgt.dataset.ripClip) { tgt.style.overflow = ''; delete tgt.dataset.ripClip; } }, 520);
    } catch (err) { /* 涟漪失败不影响操作 */ }
  });

  /* 桌面端快捷键：N 新建任务，T 返回今日（输入框聚焦时不触发；不劫持组合键） */
  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (e.target && e.target.tagName) || '';
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag) || (e.target && e.target.isContentEditable)) return;
    if (!C.get().meta.onboarded) return;
    const k = e.key.toLowerCase();
    if (k === 'n') { e.preventDefault(); taskModal(null); }
    else if (k === 't') { e.preventDefault(); go('today'); }
  });

  /* ---------- SECTION: boot（数据防丢三道防线在此启动） ---------- */
  const boot = () => {
    C.load(); applyTheme();
    /* 防线一：localStorage 缺失或损坏 → 自动从 IndexedDB 镜像恢复 */
    const recover = C.loadFromIDB().then(fromIDB => {
      if (fromIDB && !C.hadData()) toast('本地数据损坏，已从备份镜像自动恢复');
      /* 防线二：每日静默自动备份（含凭证），留最近 14 份 */
      C.autoBackup();
      /* 防线三：离开页面前补一次镜像（save 已同步，这里兜住未落盘的编辑） */
      window.addEventListener('beforeunload', () => { C.save(); });
      if (!C.get().meta.onboarded) { obStart(); return; }
      welcomeBackCheck();
      render();
    });
    return recover;
  };
  document.addEventListener('DOMContentLoaded', boot);

  return { render, go, toast };
})();
window.TTApp = TTApp;
