/* SECTION: static-data —— 模板库、鼓励语、徽章、等级等静态定义 */
'use strict';
const TTData = {
  /* 品牌：日课 —— 文人称每日必修的功课。英文名 RIKE */
  BRAND: {
    name: '日课',
    latin: 'RÌKÈ · DAILY PRACTICE',
    motto: '日日不断，功不唐捐',
    welcome: '把想做的事，过成每天都在做的事。',
    pages: { today: 'TODAY', tasks: 'TASKS', stats: 'INSIGHTS', badges: 'TROPHIES', settings: 'SETTINGS', archive: 'DOSSIER' }
  },

  DIFFS: [
    { lv: 1, name: '顺手', hint: '几乎不费力气就能完成' },
    { lv: 2, name: '费力', hint: '需要挤出一段专门的时间' },
    { lv: 3, name: '硬核', hint: '常常需要和自己谈判才能开始' }
  ],

  CATEGORIES: [
    { id: 'health', name: '健康', icon: '🌿', color: '#3FA66A' },
    { id: 'fitness', name: '运动', icon: '🏃', color: '#E07A3F' },
    { id: 'sleep',  name: '作息', icon: '🌙', color: '#6B7EC1' },
    { id: 'study',  name: '学习', icon: '📚', color: '#4E7CC1' },
    { id: 'work',   name: '工作', icon: '💼', color: '#B08A3E' },
    { id: 'create', name: '创作', icon: '✍️', color: '#9A6BC1' },
    { id: 'mood',   name: '心境', icon: '🫧', color: '#C77BA6' },
    { id: 'life',   name: '生活', icon: '🏠', color: '#C1694E' },
    { id: 'social', name: '社交', icon: '🤝', color: '#3E9E96' },
    { id: 'money',  name: '理财', icon: '🪙', color: '#8A8F3E' }
  ],

  /* 模板按生活领域分组，课格弹层分区呈现 */
  TPL_GROUPS: ['晨间作息', '身体运动', '学习精进', '工作事业', '创作表达', '心境情绪', '生活家务', '人际社交', '财富理财'],

  TEMPLATES: [
    /* 晨间作息 */
    { name: '7 点前起床',       cat: 'sleep',  freq: 'daily',  group: '晨间作息', remind: '07:00' },
    { name: '起床后一杯温水',    cat: 'health', freq: 'daily',  group: '晨间作息' },
    { name: '23:30 前放下手机',  cat: 'sleep',  freq: 'daily',  group: '晨间作息', remind: '23:00', needProof: false },
    { name: '睡前拉伸 5 分钟',   cat: 'fitness',freq: 'daily',  group: '晨间作息', target: '5分钟' },
    /* 身体运动 */
    { name: '每天跑步 / 快走',   cat: 'fitness',freq: 'daily',  group: '身体运动', unit: '公里', goal: 3 },
    { name: '每周力量训练 3 次', cat: 'fitness',freq: 'weekly', group: '身体运动', weekDays: [1, 3, 5], needProof: true },
    { name: '每天平板支撑',      cat: 'fitness',freq: 'daily',  group: '身体运动', unit: '组', goal: 3 },
    { name: '每天走 8000 步',    cat: 'fitness',freq: 'daily',  group: '身体运动', unit: '步', goal: 8000 },
    { name: '每天喝水 2 升',     cat: 'health', freq: 'daily',  group: '身体运动', unit: '升', goal: 2 },
    /* 学习精进 */
    { name: '每天阅读 30 分钟',  cat: 'study',  freq: 'daily',  group: '学习精进', target: '30分钟' },
    { name: '每天背单词 20 个',  cat: 'study',  freq: 'daily',  group: '学习精进', unit: '个', goal: 20 },
    { name: '每天学英语 20 分钟',cat: 'study',  freq: 'daily',  group: '学习精进', target: '20分钟' },
    { name: '每周读完一本书',    cat: 'study',  freq: 'weekly', group: '学习精进', weekDays: [0] },
    { name: '每天练字 15 分钟',  cat: 'create', freq: 'daily',  group: '学习精进', target: '15分钟' },
    /* 工作事业 */
    { name: '每天写工作复盘',    cat: 'work',   freq: 'daily',  group: '工作事业', remind: '18:30' },
    { name: '专注块（番茄钟）',  cat: 'work',   freq: 'daily',  group: '工作事业', unit: '个', goal: 6 },
    { name: '每天清空收件箱',    cat: 'work',   freq: 'daily',  group: '工作事业' },
    { name: '每周复盘一次',      cat: 'work',   freq: 'weekly', group: '工作事业', weekDays: [5] },
    /* 创作表达 */
    { name: '每天写作 500 字',   cat: 'create', freq: 'daily',  group: '创作表达', unit: '字', goal: 500 },
    { name: '每天拍一张照',      cat: 'create', freq: 'daily',  group: '创作表达', needProof: true },
    { name: '每天画画 / 设计 20 分钟', cat: 'create', freq: 'daily', group: '创作表达', target: '20分钟' },
    /* 心境情绪 */
    { name: '每天写 3 件小确幸', cat: 'mood',   freq: 'daily',  group: '心境情绪', remind: '21:00' },
    { name: '每天冥想 10 分钟',  cat: 'mood',   freq: 'daily',  group: '心境情绪', target: '10分钟', remind: '21:30' },
    { name: '每天记录心情',      cat: 'mood',   freq: 'daily',  group: '心境情绪' },
    { name: '每天晒 15 分钟太阳',cat: 'mood',   freq: 'daily',  group: '心境情绪' },
    /* 生活家务 */
    { name: '每天整理 10 分钟',  cat: 'life',   freq: 'daily',  group: '生活家务' },
    { name: '每天自己做一顿饭',  cat: 'life',   freq: 'daily',  group: '生活家务' },
    { name: '每周大扫除',        cat: 'life',   freq: 'weekly', group: '生活家务', weekDays: [6] },
    { name: '每天给植物浇水',    cat: 'life',   freq: 'anytime',group: '生活家务' },
    /* 人际社交 */
    { name: '每周给家人打电话',  cat: 'social', freq: 'weekly', group: '人际社交', weekDays: [0] },
    { name: '每天联系一位朋友',  cat: 'social', freq: 'daily',  group: '人际社交' },
    { name: '每周见一次朋友',    cat: 'social', freq: 'weekly', group: '人际社交', weekDays: [6] },
    /* 财富理财 */
    { name: '每天记账',          cat: 'money',  freq: 'daily',  group: '财富理财', remind: '22:00' },
    { name: '每天存一笔',        cat: 'money',  freq: 'daily',  group: '财富理财', unit: '元', goal: 50 },
    { name: '每周核对一次预算',  cat: 'money',  freq: 'weekly', group: '财富理财', weekDays: [1] }
  ],

  /* 鼓励语：循环轮换使用，任意相邻两次不重复；禁用"太棒了/加油"类空洞口号 */
  ENCOURAGEMENTS: [
    '又是坚持的一天。',
    '你比昨天更接近目标。',
    '今天也来了，这就是胜利。',
    '不管快慢，你在前进。',
    '做完了就不要再想它，去享受余下的时间。',
    '留给明天的你一个轻松的开始。',
    '第{day}天。没有那么多观众，但你自己在看。',
    '完成了，合上它，去忙别的。',
    '今天的你，值得这一个勾选。',
    '不轰烈，但每天都在。',
    '坚持的声音很小，但你听见了。',
    '这就够了。明天见。'
  ],

  EMPTY_HINT: '今天还空着。选一件最小的事，先做 5 分钟。',

  /* 场景化鼓励语（优先于轮换库；同一场景内轮换不重复）
     行为依据：即时强化——反馈越具体、越贴近当下行为，强化效果越好 */
  SCENE_ENC: {
    first: ['好的开始。事情都是从第一次开始的。', '第一步完成了。后面的路会熟。'],
    makeup: ['补上了，很好。账还是连着的。', '昨天的事今天收了，这就叫负责。'],
    comeback: ['回来了，这就是最重要的事。', '隔了几天再来，说明这件事对你是真的。'],
    all: ['今天全清，去休息。剩下的时间是赚的。', '全部完成。不看表了，去过日子。'],
    partial: n => `今天完成了 ${n} 个，够好了。剩下的明天还能要回来。`,
    milestone: m => `连续 ${m} 天。你已经不是"在做这件事"，你是"做这件事的人"。`
  },

  /* 随机惊喜（完成打卡时小概率触发）
     行为依据：变比率强化——不可预测的奖励最能维持行为 */
  SURPRISE: {
    bonus: [2, 3, 5, 8],
    lines: [
      '今天有个小彩蛋：额外 {n} 分。不是因为你做了什么特别的事，就是想让你开心一下。',
      '叮——{n} 分砸中了你。坚持的人偶尔会遇到好事。',
      '系统偷偷给你加了 {n} 分。别问为什么，问就是你值得。'
    ],
    easter: [
      { icon: '🌈', text: '一道小彩虹路过你的打卡。' },
      { icon: '⭐', text: '有颗星掉进了你的任务列表。' },
      { icon: '🍀', text: '四叶草出现了。今天运气不错。' }
    ]
  },

  WEEKDAY: ['日', '一', '二', '三', '四', '五', '六'],

  FREQ_LABEL: { daily: '每天', weekly: '每周', anytime: '随时可做', once: '一次性' },

  /* 积分规则（展示用，计算为纯推导） */
  POINTS_RULES: [
    '完成一次打卡 +5',
    '当日全部任务完成 +5',
    '完成每日小挑战 +8',
    '完美一周（连续 7 天每天至少一项） +10',
    '连续 7 天 +20',
    '连续 30 天 +100',
    '连续 60 天 +200',
    '连续 100 天 +300',
    '连续 365 天 +600'
  ],

  MILESTONE_BONUS: { 7: 20, 30: 100, 60: 200, 100: 300, 365: 600 },

  LEVELS: [
    { lv: 1,  min: 0,     name: '起步' },
    { lv: 2,  min: 100,   name: '行动者' },
    { lv: 3,  min: 250,   name: '稳定前行' },
    { lv: 4,  min: 500,   name: '习惯初成' },
    { lv: 5,  min: 900,   name: '坚持者' },
    { lv: 6,  min: 1500,  name: '进阶' },
    { lv: 7,  min: 2500,  name: '深耕' },
    { lv: 8,  min: 4000,  name: '恒者' },
    { lv: 9,  min: 6500,  name: '大师' },
    { lv: 10, min: 10000, name: '传奇' }
  ],

  /* 徽章：全部由打卡数据推导，达成即点亮，永不倒扣 */
  BADGES: [
    { id: 'start',   icon: '🌱', name: '启程',     desc: '完成第一次打卡',            test: s => s.total >= 1 },
    { id: 's7',      icon: '🔥', name: '七日之约', desc: '连续完成 7 天',             test: s => s.bestStreak >= 7 },
    { id: 's21',     icon: '⚡', name: '习惯成型', desc: '连续完成 21 天',            test: s => s.bestStreak >= 21 },
    { id: 's30',     icon: '🏕️', name: '月度坚守', desc: '连续完成 30 天',           test: s => s.bestStreak >= 30 },
    { id: 's60',     icon: '🌙', name: '双月之约', desc: '连续完成 60 天',            test: s => s.bestStreak >= 60 },
    { id: 's100',    icon: '💯', name: '百日打卡', desc: '连续完成 100 天',           test: s => s.bestStreak >= 100 },
    { id: 's365',    icon: '👑', name: '年度之冠', desc: '连续完成 365 天',           test: s => s.bestStreak >= 365 },
    { id: 'n10',     icon: '✅', name: '十次达成', desc: '累计打卡 10 次',            test: s => s.total >= 10 },
    { id: 'n50',     icon: '🎯', name: '五十次',   desc: '累计打卡 50 次',            test: s => s.total >= 50 },
    { id: 'n100',    icon: '🏅', name: '一百次',   desc: '累计打卡 100 次',           test: s => s.total >= 100 },
    { id: 'n500',    icon: '🚀', name: '五百次',   desc: '累计打卡 500 次',           test: s => s.total >= 500 },
    { id: 'week',    icon: '🗓️', name: '完美一周', desc: '一整周每天至少完成一项',    test: s => s.perfectWeeks >= 1 },
    { id: 'perfect1', icon: '💠', name: '全清的一天', desc: '单日完成全部应做任务',   test: s => s.perfectDays >= 1 },
    { id: 'restart', icon: '🌄', name: '重新出发', desc: '中断后再次坚持起来',         test: s => !!s.hasRestart },
    { id: 'h30',     icon: '📆', name: '习惯达人', desc: '单个任务累计打卡 30 次',    test: s => s.maxTaskCount >= 30 },
    { id: 'poly',    icon: '🌈', name: '多面手',   desc: '3 个及以上类别都有过打卡',  test: s => s.catsWithCheckins >= 3 },
    { id: 'month20', icon: '🌟', name: '月度坚持', desc: '单月完成 20 天以上',        test: s => s.maxMonthDays >= 20 },
    { id: 'why',     icon: '🧭', name: '知其所以', desc: '为一个任务写下「为什么重要」', test: s => !!s.hasWhy },
    { id: 'proof10', icon: '📸', name: '有图有真相', desc: '累计 10 次打卡附凭证',      test: s => (s.proofs || 0) >= 10 },
    { id: 'multi5',  icon: '🎯', name: '多线并进',   desc: '一天完成 5 项不同功课',     test: s => !!s.busyDay },
    { id: 'week8',   icon: '🗓️', name: '八周稳定',   desc: '累计 8 个完美一周',         test: s => s.perfectWeeks >= 8 },
    { id: 'chal5',   icon: '🎲', name: '乐意接招', desc: '完成 5 次每日小挑战',        test: s => (s.challenges || 0) >= 5 },
    { id: 'yearly',  icon: '📜', name: '回望来路', desc: '打开一次年度报告',           test: s => !!s.reportViewed }
  ],

  /* 周反思问题：周报里引导用户自己看一眼，不替用户下结论 */
  WEEK_QUESTIONS: [
    '这周哪一天最难？难在哪？',
    '如果下周只保一件事，保哪件？',
    '有没有哪次完成，其实只花了不到 5 分钟？'
  ],

  /* 主题皮肤：warm 免费；其余用积分解锁（Pro 全解锁） */
  THEMES: [
    { id: 'warm',   name: '暖白（默认）', cost: 0,   pri: '#3FA66A' },
    { id: 'sunset', name: '暮橘',        cost: 120, pri: '#D07A45' },
    { id: 'indigo', name: '靛蓝夜',      cost: 180, pri: '#5B6ABF' },
    { id: 'sakura', name: '樱粉',        cost: 240, pri: '#C75B8A' },
    { id: 'matcha', name: '抹茶',        cost: 200, pri: '#7A9B44' },
    { id: 'dusk',   name: '烟紫',        cost: 260, pri: '#8A6BB8' }
  ],

  /* Pro 套餐（模拟支付，不产生真实扣款） */
  PLANS: [
    { id: 'monthly', name: '月度', price: '¥12 / 月', days: 30 },
    { id: 'yearly',  name: '年度', price: '¥98 / 年', days: 365, save: '约 3 折' }
  ],
  PRO_PERKS: [
    '年度报告（打印存 PDF）',
    '额外主题皮肤',
    '不限量休息日',
    '周反思导出'
  ],

  /* 结伴伙伴：示例数据，未连接真实账号 */
  PARTNER_DEMO: [
    { id: 'p1', name: '小徐', icon: '🦊', line: '最近在坚持晨跑', today: '今天跑了 5 公里，配速很慢但跑完了' },
    { id: 'p2', name: '阿玫', icon: '🐢', line: '每晚写作的人', today: '昨天断了一天，今天重新开始写' }
  ],
  PARTNER_CHEERS: [
    '今天也看到你打卡了。',
    '我这周断了一天，又开始了。你也可以。',
    '一起把 30 天熬过去。',
    '刚跑完，你在干嘛？',
    '不用回，就想让你知道有人也在。'
  ],

  /* 每日随机小挑战（约三成天数出现）：打破日常平淡，完成 +8 分 */
  CHALLENGES: [
    { id: 'c1', t: '把今天最先完成的功课，提前到早上第一件事。' },
    { id: 'c2', t: '给一个超过 7 天没打卡的功课一次机会：今天只做 5 分钟。' },
    { id: 'c3', t: '今晚睡前，给明天的自己留一句话（写进任意功课的「为什么」）。' },
    { id: 'c4', t: '今天每完成一项，合上页面 30 秒，再打开下一项。' },
    { id: 'c5', t: '打开洞察页，找到完成率最低的功课，把它暂停或把标准减半。' },
    { id: 'c6', t: '给「喝水」这类最小功课，在下班前全部清掉。' },
    { id: 'c7', t: '今天给至少一项打卡附上照片凭证。' },
    { id: 'c8', t: '把拖延最久的一次补打上，别让它继续欠着。' },
    { id: 'c9', t: '只做最重要的三件事，其余今天允许没做。' },
    { id: 'c10', t: '把提醒时间挪到你的黄金时段，看看今晚顺不顺手。' },
    { id: 'c11', t: '去档案页，翻一翻你最久的那门功课，看看它走了多远。' },
    { id: 'c12', t: '今天提前十分钟开始，体会一下从容。' }
  ],

  /* 智能教练建议话术（邀请而非指令，每次只给一条）
     行为依据：心流理论——挑战与能力匹配才能持续；自主感——用户可否决 */
  COACH: {
    harder: t => `最近 ${t.days} 天，「${t.name}」你 ${t.hit}/${t.due} 天都完成了，看起来有点游刃有余。要不要把标准提高一点，让它继续值得做？`,
    easier: t => `「${t.name}」最近 ${t.days} 天完成了 ${t.hit} 次，失败通常不是意志力的问题，是标准的问题。把目标减半（比如改成 5 分钟版本），坚持会容易得多。`,
    time: r => `过去 30 天你在 ${r.bucket} 的完成率最高（${r.rate}%）。把「${r.task}」的提醒设在 ${r.suggest}，在它之前一点。`,
    load: n => `你同时在追踪 ${n} 个任务，最近完成率被拉低了。挑 3-5 个此刻最重要的，其余暂停——它们的数据都会保留，随时可以回来。`,
    freq: t => `「${t.name}」你每周能完成 ${t.avg} 天。如果按每周 ${t.suggest} 天设置，它会更容易变成"顺手就做了"的事。`
  },

  /* 月度报告引导问题 */
  MONTH_QUESTIONS: [
    '这个月哪天最难，后来怎么过去的？',
    '哪个任务你最不想丢？',
    '下个月想在哪件事上多走一步？'
  ],

  /* 流失欢迎回来文案：不指责、不焦虑 */
  WELCOME_BACK: [
    '回来了就好。不用补昨天的账。',
    '隔了几天，也没什么。今天还是今天。',
    '你不在的时候，这里什么都没变。'
  ]
};
window.TTData = TTData;
