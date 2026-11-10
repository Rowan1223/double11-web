/* =========================================================
   双十一购物节 · 核心交互脚本（原生 JavaScript）
   模块划分：
     1) 工具函数（toast / 价格格式化 / 本地存储）
     2) 倒计时（全站 + 秒杀）
     3) 领券中心
     4) 限时秒杀
     5) 商品会场（分类筛选 + 搜索）
     6) 购物车（增删改 + 持久化）
     7) 返回顶部 / 导航
   ========================================================= */

/* ---------- 1. 工具函数 ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// 轻提示：短暂展示一条消息
let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

// 金额格式化：数字 -> ¥xxx
const fmt = (n) => '¥' + Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 0 });

// 本地存储读写（兼容隐私模式下异常）
const store = {
  get(key, def) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; }
    catch { return def; }
  },
  set(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* 忽略 */ }
  }
};

/* ---------- 2. 倒计时 ---------- */
// 2.1 全站倒计时：距离下一个 11 月 11 日 00:00
function getNextDouble11() {
  const now = new Date();
  let year = now.getFullYear();
  // 若今年双十一已过，则目标为明年
  const target = new Date(year, 10, 11, 0, 0, 0); // 月份 10 = 11月
  if (now > target) target.setFullYear(year + 1);
  return target;
}

function pad(n) { return String(n).padStart(2, '0'); }

function tickGlobalCountdown() {
  const diff = getNextDouble11() - new Date();
  if (diff <= 0) { // 到点了
    $('#cdDay').textContent = '00';
    $('#cdHour').textContent = '00';
    $('#cdMin').textContent = '00';
    $('#cdSec').textContent = '00';
    return;
  }
  const day = Math.floor(diff / 86400000);
  const hour = Math.floor(diff / 3600000) % 24;
  const min = Math.floor(diff / 60000) % 60;
  const sec = Math.floor(diff / 1000) % 60;
  $('#cdDay').textContent = pad(day);
  $('#cdHour').textContent = pad(hour);
  $('#cdMin').textContent = pad(min);
  $('#cdSec').textContent = pad(sec);
}

// 2.2 秒杀倒计时：本场固定 2 小时循环（演示用）
function tickSeckill() {
  const total = 2 * 3600; // 2 小时
  const elapsed = Math.floor((Date.now() / 1000)) % total; // 循环演示
  const remain = total - elapsed;
  const h = Math.floor(remain / 3600);
  const m = Math.floor(remain / 60) % 60;
  const s = remain % 60;
  $('#seckillTimer').textContent = `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/* ---------- 2.5 促销轮播图 ---------- */
// 轮播数据：4 张促销 banner，不同渐变主题
const banners = [
  { cls: 'slide-1', emoji: '🎉', title: '11.11 巅峰开门红', desc: '跨店满 300 减 50，上不封顶', btn: '立即抢购' },
  { cls: 'slide-2', emoji: '💝', title: '超级品牌日',     desc: '大牌直降，会员再享折上折', btn: '查看大牌' },
  { cls: 'slide-3', emoji: '🚚', title: '0 元包邮到家',    desc: '全场包邮，晚到必赔',       btn: '去逛会场' },
  { cls: 'slide-4', emoji: '🎁', title: '百亿补贴专场',   desc: '官方补贴，全网比价更底',   btn: '马上领' },
];

let carIndex = 0;       // 当前幻灯片索引
let carTimer = null;    // 自动播放定时器

function renderCarousel() {
  $('#carouselTrack').innerHTML = banners.map(b => `
    <div class="slide ${b.cls}">
      <div class="slide-text">
        <h3>${b.title}</h3>
        <p>${b.desc}</p>
        <span class="slide-btn">${b.btn}</span>
      </div>
      <div class="slide-emoji">${b.emoji}</div>
    </div>`).join('');

  // 生成指示圆点
  $('#carDots').innerHTML = banners.map((_, i) =>
    `<span class="${i === 0 ? 'active' : ''}" data-i="${i}"></span>`).join('');
}

// 切换到第 i 张：移动轨道 + 更新圆点高亮
function goSlide(i) {
  carIndex = (i + banners.length) % banners.length; // 循环
  $('#carouselTrack').style.transform = `translateX(-${carIndex * 100}%)`;
  $$('#carDots span').forEach((dot, idx) =>
    dot.classList.toggle('active', idx === carIndex));
}

// 自动播放
function startAutoPlay() {
  stopAutoPlay();
  carTimer = setInterval(() => goSlide(carIndex + 1), 4000);
}
function stopAutoPlay() { clearInterval(carTimer); }

function bindCarousel() {
  $('#carPrev').addEventListener('click', () => { goSlide(carIndex - 1); startAutoPlay(); });
  $('#carNext').addEventListener('click', () => { goSlide(carIndex + 1); startAutoPlay(); });
  $('#carDots').addEventListener('click', (e) => {
    const dot = e.target.closest('span');
    if (!dot) return;
    goSlide(Number(dot.dataset.i));
    startAutoPlay();
  });
  // 鼠标悬停暂停，移出恢复
  const car = $('#carousel');
  car.addEventListener('mouseenter', stopAutoPlay);
  car.addEventListener('mouseleave', startAutoPlay);
}

/* ---------- 3. 领券中心 ---------- */
const coupons = [
  { id: 'c1', amount: 50,  cond: '满 299 可用', title: '全场通用券', desc: '双十一专享' },
  { id: 'c2', amount: 100, cond: '满 599 可用', title: '数码家电券', desc: '限数码家居' },
  { id: 'c3', amount: 30,  cond: '满 99 可用',  title: '美妆个护券', desc: '限美妆食品' },
  { id: 'c4', amount: 200, cond: '满 1299 可用', title: '超级红包',   desc: '大额神券' },
];

function renderCoupons() {
  const claimed = store.get('claimedCoupons', []);
  const grid = $('#couponGrid');
  grid.innerHTML = coupons.map(c => {
    const isClaimed = claimed.includes(c.id);
    return `
      <div class="coupon">
        <div class="coupon-amount"><small>¥</small>${c.amount}</div>
        <div class="coupon-info">
          <b>${c.title}</b>
          <span>${c.cond} · ${c.desc}</span>
        </div>
        <button class="coupon-btn ${isClaimed ? 'claimed' : ''}" data-id="${c.id}" ${isClaimed ? 'disabled' : ''}>
          ${isClaimed ? '已领取' : '立即领取'}
        </button>
      </div>`;
  }).join('');
}

// 领取逻辑：点击后记录到本地存储，避免重复领取
function bindCoupons() {
  $('#couponGrid').addEventListener('click', (e) => {
    const btn = e.target.closest('.coupon-btn');
    if (!btn || btn.classList.contains('claimed')) return;
    const id = btn.dataset.id;
    const claimed = store.get('claimedCoupons', []);
    claimed.push(id);
    store.set('claimedCoupons', claimed);
    btn.textContent = '已领取';
    btn.classList.add('claimed');
    btn.disabled = true;
    toast('🎉 优惠券领取成功，结算时自动抵扣');
  });
}

/* ---------- 4. 限时秒杀 ---------- */
const seckills = [
  { emoji: '🎧', name: '降噪蓝牙耳机', price: 199, old: 499, sold: 72 },
  { emoji: '👟', name: '潮流运动鞋',   price: 259, old: 599, sold: 45 },
  { emoji: '📱', name: '旗舰智能手机', price: 2999, old: 3999, sold: 18 },
  { emoji: '💄', name: '限定口红套装', price: 99,  old: 199, sold: 88 },
];

function renderSeckill() {
  $('#seckillGrid').innerHTML = seckills.map(s => {
    const pct = Math.min(100, s.sold); // 演示进度
    return `
      <div class="seckill-card">
        <div class="seckill-thumb">${s.emoji}</div>
        <div class="info">
          <div class="name">${s.name}</div>
          <div class="price">${fmt(s.price)}<s>${fmt(s.old)}</s></div>
          <div class="progress"><i style="width:${pct}%"></i></div>
          <div class="progress-text">已抢 ${pct}%</div>
          <button class="buy" data-name="${s.name}" data-price="${s.price}" data-emoji="${s.emoji}">马上抢</button>
        </div>
      </div>`;
  }).join('');
}

function bindSeckill() {
  $('#seckillGrid').addEventListener('click', (e) => {
    const btn = e.target.closest('.buy');
    if (!btn) return;
    addToCart({
      name: btn.dataset.name,
      price: Number(btn.dataset.price),
      emoji: btn.dataset.emoji
    });
    toast('⚡ 秒杀商品已加入购物车');
  });
}

/* ---------- 5. 商品会场 ---------- */
const products = [
  { emoji: '📱', name: '5G 智能手机 Pro', cat: 'digital', price: 3299, old: 3999, tag: '爆款' },
  { emoji: '💻', name: '轻薄笔记本 14"',  cat: 'digital', price: 4599, old: 5299, tag: '直降' },
  { emoji: '🎮', name: '无线游戏手柄',     cat: 'digital', price: 199,  old: 299,  tag: '热卖' },
  { emoji: '🧹', name: '智能扫地机器人',   cat: 'home',    price: 1299, old: 1999, tag: '新品' },
  { emoji: '🛋️', name: '懒人沙发',         cat: 'home',    price: 399,  old: 599,  tag: '优选' },
  { emoji: '☕', name: '胶囊咖啡机',       cat: 'home',    price: 699,  old: 999,  tag: '爆款' },
  { emoji: '💄', name: '水光精华礼盒',     cat: 'beauty',  price: 289,  old: 459,  tag: '限定' },
  { emoji: '🧴', name: '氨基酸洁面',       cat: 'beauty',  price: 89,   old: 139,  tag: '回购' },
  { emoji: '🌸', name: '香氛身体乳',       cat: 'beauty',  price: 119,  old: 189,  tag: '热卖' },
  { emoji: '🍫', name: '进口巧克力礼盒',   cat: 'food',    price: 69,   old: 109,  tag: '囤货' },
  { emoji: '🍵', name: '明前龙井茶',       cat: 'food',    price: 159,  old: 259,  tag: '直降' },
  { emoji: '🥜', name: '每日坚果 30 包',   cat: 'food',    price: 99,   old: 159,  tag: '爆款' },

  /* —— 以下为新增品类，丰富会场内容 —— */
  { emoji: '👕', name: '纯棉宽松卫衣',     cat: 'clothes', price: 129,  old: 219,  tag: '新品' },
  { emoji: '🧥', name: '轻薄羽绒服',       cat: 'clothes', price: 399,  old: 699,  tag: '爆款' },
  { emoji: '👟', name: '复古运动板鞋',     cat: 'clothes', price: 259,  old: 459,  tag: '热卖' },
  { emoji: '🍼', name: '恒温调奶器',       cat: 'baby',    price: 159,  old: 269,  tag: '优选' },
  { emoji: '🧸', name: '安抚毛绒玩偶',     cat: 'baby',    price: 89,   old: 159,  tag: '回购' },
  { emoji: '🚼', name: '婴儿纸尿裤 L 码',  cat: 'baby',    price: 119,  old: 199,  tag: '囤货' },
  { emoji: '📚', name: '经典文学套装',     cat: 'books',   price: 99,   old: 198,  tag: '直降' },
  { emoji: '✏️', name: '国誉手帐文具礼盒', cat: 'books',   price: 69,   old: 129,  tag: '热卖' },
  { emoji: '📖', name: '畅销经管书单',     cat: 'books',   price: 139,  old: 259,  tag: '爆款' },
];

let currentCat = 'all';
let currentKey = '';

// 根据分类与搜索关键字渲染商品列表
function renderProducts() {
  const list = products.filter(p => {
    const matchCat = currentCat === 'all' || p.cat === currentCat;
    const matchKey = !currentKey || p.name.toLowerCase().includes(currentKey);
    return matchCat && matchKey;
  });

  const grid = $('#productGrid');
  $('#emptyTip').hidden = list.length > 0;

  grid.innerHTML = list.map(p => `
    <div class="product-card">
      <div class="product-thumb">${p.emoji}</div>
      <div class="info">
        <span class="tag">${p.tag}</span>
        <div class="name">${p.name}</div>
        <div class="price">${fmt(p.price)}<s>${fmt(p.old)}</s></div>
        <button class="add-cart" data-name="${p.name}" data-price="${p.price}" data-emoji="${p.emoji}">加入购物车</button>
      </div>
    </div>`).join('');
}

// 分类标签切换
function bindFilterTabs() {
  $('#filterTabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    $$('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentCat = tab.dataset.cat;
    renderProducts();
  });
}

// 搜索：输入即过滤（输入防抖，提升响应速度）
let searchTimer = null;
function bindSearch() {
  const input = $('#searchInput');
  input.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      currentKey = input.value.trim().toLowerCase();
      renderProducts();
    }, 200);
  });
  $('#searchBtn').addEventListener('click', () => {
    currentKey = input.value.trim().toLowerCase();
    renderProducts();
  });
}

/* ---------- 6. 购物车 ---------- */
// 购物车数据结构：[{ name, price, emoji, qty }]
let cart = store.get('cart', []);

function addToCart(item) {
  const exist = cart.find(i => i.name === item.name);
  if (exist) exist.qty += 1;
  else cart.push({ ...item, qty: 1 });
  saveCart();
  renderCart();
  updateBadge();
}

function changeQty(name, delta) {
  const item = cart.find(i => i.name === name);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter(i => i.name !== name);
  saveCart();
  renderCart();
  updateBadge();
}

function removeItem(name) {
  cart = cart.filter(i => i.name !== name);
  saveCart();
  renderCart();
  updateBadge();
}

function saveCart() { store.set('cart', cart); }

// 计算合计金额
function cartTotal() {
  return cart.reduce((sum, i) => sum + i.price * i.qty, 0);
}

// 更新右上角徽标数量
function updateBadge() {
  const count = cart.reduce((s, i) => s + i.qty, 0);
  $('#cartBadge').textContent = count;
}

// 渲染购物车抽屉内容
function renderCart() {
  const body = $('#cartBody');
  if (cart.length === 0) {
    body.innerHTML = '<div class="cart-empty">🛒 购物车还是空的，去逛逛吧～</div>';
  } else {
    body.innerHTML = cart.map(i => `
      <div class="cart-item">
        <div class="ci-thumb">${i.emoji}</div>
        <div class="ci-info">
          <div class="ci-name">${i.name}</div>
          <div class="ci-price">${fmt(i.price)}</div>
          <div class="ci-qty">
            <button class="qty-btn" data-act="minus" data-name="${i.name}">−</button>
            <span>${i.qty}</span>
            <button class="qty-btn" data-act="plus" data-name="${i.name}">+</button>
            <button class="ci-remove" data-act="remove" data-name="${i.name}">删除</button>
          </div>
        </div>
      </div>`).join('');
  }
  $('#cartTotal').textContent = fmt(cartTotal());
}

// 抽屉开关
function openCart() { $('#cartDrawer').classList.add('show'); $('#cartMask').classList.add('show'); }
function closeCart() { $('#cartDrawer').classList.remove('show'); $('#cartMask').classList.remove('show'); }

function bindCart() {
  $('#cartBtn').addEventListener('click', openCart);
  $('#cartClose').addEventListener('click', closeCart);
  $('#cartMask').addEventListener('click', closeCart);

  // 商品列表“加入购物车”
  $('#productGrid').addEventListener('click', (e) => {
    const btn = e.target.closest('.add-cart');
    if (!btn) return;
    addToCart({
      name: btn.dataset.name,
      price: Number(btn.dataset.price),
      emoji: btn.dataset.emoji
    });
    toast('✅ 已加入购物车');
  });

  // 抽屉内数量加减 / 删除（事件委托）
  $('#cartBody').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const name = btn.dataset.name;
    if (btn.dataset.act === 'plus') changeQty(name, 1);
    else if (btn.dataset.act === 'minus') changeQty(name, -1);
    else if (btn.dataset.act === 'remove') removeItem(name);
  });

  // 结算（演示：清空购物车并提示）
  $('#checkoutBtn').addEventListener('click', () => {
    if (cart.length === 0) { toast('购物车是空的哦～'); return; }
    const total = cartTotal();
    cart = []; saveCart(); renderCart(); updateBadge(); closeCart();
    toast(`🎉 下单成功，共支付 ${fmt(total)}（演示）`);
  });
}

/* ---------- 7. 返回顶部 / 导航 ---------- */
function bindBackTop() {
  const btn = $('#backTop');
  window.addEventListener('scroll', () => {
    btn.classList.toggle('show', window.scrollY > 400);
  });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

/* ---------- 初始化 ---------- */
function init() {
  renderCoupons();
  bindCoupons();
  renderSeckill();
  bindSeckill();
  renderCarousel();
  bindCarousel();
  startAutoPlay();      // 轮播自动播放
  renderProducts();
  bindFilterTabs();
  bindSearch();
  bindCart();
  bindBackTop();
  renderCart();
  updateBadge();

  // 启动倒计时（每秒刷新）
  tickGlobalCountdown();
  tickSeckill();
  setInterval(tickGlobalCountdown, 1000);
  setInterval(tickSeckill, 1000);
}

// DOM 就绪后初始化
document.addEventListener('DOMContentLoaded', init);
