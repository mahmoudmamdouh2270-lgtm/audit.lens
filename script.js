// ─── Analytics ────────────────────────────────────────────────────────────────
function track(event, data) {
  if (typeof clarity !== "undefined") clarity("event", event);
  // GA4: window.gtag?.("event", event, data || {});
}

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const form        = document.querySelector("#financeForm");
const resultPanel = document.querySelector(".result-panel");
const statusTitle = document.querySelector("#statusTitle");
const statusText  = document.querySelector("#statusText");
const scoreValue  = document.querySelector("#scoreValue");
const insightsEl  = document.querySelector("#insights");
const actionsEl   = document.querySelector("#actionsList");
const openReport  = document.querySelector("#openReport");
const closeReport = document.querySelector("#closeReport");
const printReport = document.querySelector("#printReport");
const reportModal = document.querySelector("#reportModal");
const fullReport  = document.querySelector("#fullReport");
const followUpForm= document.querySelector("#followUpForm");
let latestReport  = null;

// ─── Floating tooltip (fixes z-index / stacking-context issue) ────────────────
(function () {
  const popup = document.createElement("div");
  popup.className = "tooltip-popup";
  document.body.appendChild(popup);
  let activeEl = null;

  function show(tip) {
    popup.textContent = tip.dataset.tip;
    popup.classList.add("is-visible");
    activeEl = tip;
    reposition(tip);
  }
  function hide() {
    popup.classList.remove("is-visible");
    activeEl = null;
  }
  function reposition(tip) {
    const r = tip.getBoundingClientRect();
    const w = 248;
    let top  = r.bottom + 8;
    let left = r.left;
    if (left + w > window.innerWidth - 8) left = window.innerWidth - w - 8;
    if (left < 8) left = 8;
    if (top + 160 > window.innerHeight) top = r.top - 160 - 8;
    popup.style.top  = top  + "px";
    popup.style.left = left + "px";
  }

  document.querySelectorAll(".tip").forEach((tip) => {
    tip.addEventListener("mouseenter", () => show(tip));
    tip.addEventListener("mouseleave",  hide);
    tip.addEventListener("focus",       () => show(tip));
    tip.addEventListener("blur",        hide);
    tip.addEventListener("touchstart", (e) => {
      e.preventDefault();
      activeEl === tip ? hide() : show(tip);
    }, { passive: false });
  });
  document.addEventListener("touchstart", (e) => {
    if (activeEl && !e.target.closest(".tip")) hide();
  });
})();

// ─── Sample datasets (clearly contrasted) ────────────────────────────────────
// good  ≈ score 77 | mid ≈ score 62 | weak ≈ score 27
const sampleData = {
  good: {
    businessName: "مؤسسة الفجر التجارية",
    businessType: "تجارة",
    currency: "جنيه",
    employees: 10,
    revenue: 300000,
    cost: 225000,
    expenses: 22000,
    salaries: 28000,
    cash: 80000,
    receivables: 35000,
    payables: 55000,
    inventory: 120000,
    collectionDays: 20,
    paymentDays: 45,
  },
  mid: {
    businessName: "مكتب الاستشارات المالية",
    businessType: "خدمات",
    currency: "جنيه",
    employees: 4,
    revenue: 95000,
    cost: 30000,
    expenses: 25000,
    salaries: 35000,
    cash: 18000,
    receivables: 55000,
    payables: 32000,
    inventory: 0,
    collectionDays: 50,
    paymentDays: 30,
  },
  weak: {
    businessName: "مطعم الوردة",
    businessType: "مطعم أو كافيه",
    currency: "جنيه",
    employees: 5,
    revenue: 70000,
    cost: 60000,
    expenses: 14000,
    salaries: 18000,
    cash: 9000,
    receivables: 22000,
    payables: 48000,
    inventory: 8000,
    collectionDays: 65,
    paymentDays: 20,
  },
};

function loadExample(type) {
  const d = sampleData[type];
  if (!d) return;
  Object.entries(d).forEach(([key, val]) => {
    const f = form.elements[key];
    if (f) f.value = val;
  });
  track("example", { type });
  analyze();
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function getNumber(fd, key) { return Number(fd.get(key)) || 0; }
function clamp(v, lo, hi)   { return Math.max(lo, Math.min(hi, v)); }
function setText(id, val)    { const el = document.querySelector(`#${id}`); if (el) el.textContent = val; }
function setWidth(id, val)   { const el = document.querySelector(`#${id}`); if (el) el.style.width  = `${clamp(val,0,100)}%`; }
function setHeight(id, val)  { const el = document.querySelector(`#${id}`); if (el) el.style.height = `${clamp(val,6,100)}%`; }
function formatMoney(v, cur) { return `${Math.round(v).toLocaleString("ar-EG")} ${cur}`; }
function formatPercent(v)    { return `${Math.round(v * 10) / 10}%`; }
function rating(v)           { return v >= 75 ? "قوي" : v >= 50 ? "متوسط" : "ضعيف"; }
function ratingWithPercent(v){ return `${rating(v)} — ${Math.round(v)}%`; }

// ─── Core scoring ─────────────────────────────────────────────────────────────
function calculateScore(data) {
  const grossMargin      = data.revenue ? data.grossProfit / data.revenue : 0;
  const netMargin        = data.revenue ? data.netProfit   / data.revenue : 0;
  const monthlyBurn      = Math.max(data.expenses + data.salaries + Math.max(data.cost - data.revenue, 0), 1);
  const runway           = data.cash / monthlyBurn;
  const expenseRatio     = data.revenue ? (data.expenses + data.salaries) / data.revenue : 1;
  const liquidityCoverage= data.payables ? (data.cash + data.receivables * 0.65) / data.payables : 2;
  const collectionPressure= data.collectionDays <= data.paymentDays ? 1 : data.paymentDays / data.collectionDays;

  const profitabilityScore= clamp((grossMargin * 35) + (netMargin * 95), 0, 30);
  const liquidityScore    = clamp((runway / 3) * 18 + liquidityCoverage * 6, 0, 30);
  const expensesScore     = clamp((1 - expenseRatio) * 28, 0, 20);
  const collectionScore   = clamp(collectionPressure * 13 + (data.collectionDays <= 45 ? 7 : 3), 0, 20);

  return { score: Math.round(profitabilityScore + liquidityScore + expensesScore + collectionScore),
    grossMargin, netMargin, runway, expenseRatio, liquidityCoverage,
    profitabilityScore, liquidityScore, expensesScore, collectionScore };
}

// ─── Break-even ───────────────────────────────────────────────────────────────
function calcBreakeven(data, ratios) {
  if (data.revenue > 0 && ratios.grossMargin > 0) {
    const be  = (data.expenses + data.salaries) / ratios.grossMargin;
    const gap = data.revenue - be;
    return { be, gap, valid: true };
  }
  return { be: 0, gap: 0, valid: false };
}

// ─── Insights ─────────────────────────────────────────────────────────────────
function buildInsights(data, ratios) {
  const insights = [], actions = [];

  if (ratios.netMargin >= 0.15) {
    insights.push("هامش صافي الربح جيد ويعطي مساحة لتحسين السيولة أو إعادة الاستثمار.");
  } else if (ratios.netMargin > 0) {
    insights.push("الشركة رابحة، لكن هامش صافي الربح محدود ويحتاج متابعة دقيقة للمصروفات والتسعير.");
    actions.push("راجع أكبر 10 بنود مصروفات وحدد بندين يمكن تخفيضهما خلال الشهر الحالي.");
  } else {
    insights.push("صافي الربح سلبي — النشاط يحتاج قراراً سريعاً في التسعير أو التكلفة أو المصروفات.");
    actions.push("ابدأ بمراجعة الأسعار وتكلفة الخدمة أو البضاعة قبل إضافة أي مصروف جديد.");
  }

  if (ratios.runway >= 3) {
    insights.push("النقدية الحالية تغطي أكثر من 3 أشهر — مستوى مريح نسبيا للشركات الصغيرة.");
  } else if (ratios.runway >= 1) {
    insights.push("النقدية تغطي فترة قصيرة، وأي تأخير في التحصيل قد يضغط على الالتزامات.");
    actions.push("حدد حداً أدنى للنقدية لا يقل عن شهرين من المصروفات الشهرية.");
  } else {
    insights.push("السيولة تحت ضغط واضح — النقدية الحالية لا تكفي شهراً كاملاً من الالتزامات.");
    actions.push("اجمع التحصيلات المتأخرة وأوقف المصروفات غير الضرورية 30 يوماً.");
  }

  if (data.collectionDays > data.paymentDays) {
    insights.push("متوسط التحصيل أبطأ من السداد للموردين — قد تنشأ فجوة نقدية حتى لو المبيعات جيدة.");
    actions.push("ضع سياسة تحصيل أقصر أو دفعة مقدمة للعملاء الجدد.");
  } else {
    insights.push("دورة التحصيل أفضل من دورة السداد — يساعد على تقليل ضغط الكاش.");
  }

  if (ratios.expenseRatio > 0.45) {
    insights.push("نسبة المصروفات والرواتب إلى الإيرادات مرتفعة وتحتاج مراجعة قبل التوسع.");
  }
  if (data.receivables > data.cash) {
    actions.push("قسّم العملاء المدينين حسب العمر وابدأ بالمديونيات الأكبر والأقدم.");
  }
  actions.push("اعمل تقريراً شهرياً بنفس المؤشرات: الربحية، السيولة، المصروفات، والتحصيل.");

  return { insights: insights.slice(0, 5), actions: actions.slice(0, 5) };
}

// ─── Full report (enriched — appears in print/PDF) ────────────────────────────
function createFullReport(data, ratios, narrative, be) {
  const col   = ratios.score >= 72 ? "#2f8f73" : ratios.score >= 48 ? "#b9872d" : "#b44955";
  const label = ratios.score >= 72 ? "قراءة مطمئنة" : ratios.score >= 48 ? "تحتاج ضبط" : "إنذار مالي مبكر";

  const beRow = be.valid
    ? `<tr><td>نقطة التعادل الشهرية</td><td>${formatMoney(Math.round(be.be), data.currency)}</td></tr>
       <tr><td>فجوة التعادل</td><td style="color:${be.gap>=0?"#2f8f73":"#b44955"}">${be.gap>=0?"+":""}${formatMoney(Math.round(be.gap), data.currency)}</td></tr>`
    : `<tr><td>نقطة التعادل</td><td>لا يمكن الحساب (هامش صفر أو سالب)</td></tr>`;

  const beSection = be.valid ? `
    <section class="report-section report-be-section">
      <h3>نقطة التعادل</h3>
      <div class="report-be-grid">
        <div class="report-be-item">
          <span>نقطة التعادل الشهرية</span>
          <strong>${formatMoney(Math.round(be.be), data.currency)}</strong>
          <small>الإيراد الأدنى لتغطية كل التكاليف</small>
        </div>
        <div class="report-be-item">
          <span>${be.gap >= 0 ? "فائض فوق نقطة التعادل" : "عجز عن نقطة التعادل"}</span>
          <strong style="color:${be.gap>=0?"#2f8f73":"#b44955"}">${be.gap>=0?"+":""}${formatMoney(Math.round(be.gap), data.currency)}</strong>
          <small>${be.gap >= 0 ? "النشاط يتجاوز نقطة التعادل ✓" : "النشاط تحت نقطة التعادل ✗"}</small>
        </div>
      </div>
    </section>` : "";

  return `
    <section class="report-section report-score-block">
      <div class="report-score-ring" style="border-color:${col};color:${col}">
        <strong>${ratios.score}</strong><small>من 100</small>
      </div>
      <div class="report-score-meta">
        <h3 style="color:${col};margin-bottom:4px">${label}</h3>
        <p style="margin:0;color:#555">${data.businessName} — ${data.businessType} — ${new Date().toLocaleDateString("ar-EG")}</p>
      </div>
    </section>

    <section class="report-section">
      <h3>ملخص تنفيذي</h3>
      <p>${data.businessName} حصل على درجة ${ratios.score}/100. التقرير يوضح قراءة عملية للربحية والسيولة والمصروفات والتحصيل بناء على الأرقام المدخلة.</p>
    </section>

    <section class="report-section">
      <h3>المؤشرات الرئيسية</h3>
      <div class="report-kpi-grid">
        <div class="report-kpi">
          <span>إجمالي الربح</span>
          <strong>${formatMoney(data.grossProfit, data.currency)}</strong>
          <small>هامش ${formatPercent(ratios.grossMargin * 100)}</small>
        </div>
        <div class="report-kpi">
          <span>صافي الربح</span>
          <strong style="color:${data.netProfit>=0?"#2f8f73":"#b44955"}">${formatMoney(data.netProfit, data.currency)}</strong>
          <small>هامش ${formatPercent(ratios.netMargin * 100)}</small>
        </div>
        <div class="report-kpi">
          <span>كفاية النقدية</span>
          <strong>${Math.round(ratios.runway * 10) / 10} شهر</strong>
          <small>نقدية ${formatMoney(data.cash, data.currency)}</small>
        </div>
        <div class="report-kpi">
          <span>تغطية السيولة</span>
          <strong>${Math.round(ratios.liquidityCoverage * 10) / 10}x</strong>
          <small>التزامات ${formatMoney(data.payables, data.currency)}</small>
        </div>
      </div>
    </section>

    ${beSection}

    <section class="report-section">
      <h3>مقاييس الأداء</h3>
      <div class="report-meters">
        ${[
          ["الربحية",   ratios.profitabilityScore, 30],
          ["السيولة",   ratios.liquidityScore,      30],
          ["المصروفات", ratios.expensesScore,        20],
          ["التحصيل",   ratios.collectionScore,      20],
        ].map(([name, score, max]) => {
          const pct = Math.round((score / max) * 100);
          return `<div class="report-meter-row">
            <span>${name}</span>
            <div class="report-meter-bar"><div style="width:${pct}%;background:${col}"></div></div>
            <strong>${ratingWithPercent(pct)}</strong>
          </div>`;
        }).join("")}
      </div>
    </section>

    <section class="report-section">
      <h3>جدول المؤشرات المالية</h3>
      <table class="report-table">
        <thead><tr><th>المؤشر</th><th>القيمة</th></tr></thead>
        <tbody>
          <tr><td>الإيرادات الشهرية</td><td>${formatMoney(data.revenue, data.currency)}</td></tr>
          <tr><td>تكلفة البضاعة/الخدمة</td><td>${formatMoney(data.cost, data.currency)}</td></tr>
          <tr><td>إجمالي الربح</td><td>${formatMoney(data.grossProfit, data.currency)}</td></tr>
          <tr><td>هامش إجمالي الربح</td><td>${formatPercent(ratios.grossMargin * 100)}</td></tr>
          <tr><td>المصروفات التشغيلية</td><td>${formatMoney(data.expenses, data.currency)}</td></tr>
          <tr><td>الرواتب</td><td>${formatMoney(data.salaries, data.currency)}</td></tr>
          <tr><td>صافي الربح</td><td>${formatMoney(data.netProfit, data.currency)}</td></tr>
          <tr><td>هامش صافي الربح</td><td>${formatPercent(ratios.netMargin * 100)}</td></tr>
          <tr><td>النقدية المتاحة</td><td>${formatMoney(data.cash, data.currency)}</td></tr>
          <tr><td>العملاء المدينون</td><td>${formatMoney(data.receivables, data.currency)}</td></tr>
          <tr><td>الالتزامات قصيرة الأجل</td><td>${formatMoney(data.payables, data.currency)}</td></tr>
          <tr><td>كفاية النقدية</td><td>${Math.round(ratios.runway * 10) / 10} شهر</td></tr>
          <tr><td>تغطية السيولة</td><td>${Math.round(ratios.liquidityCoverage * 10) / 10}x</td></tr>
          <tr><td>متوسط التحصيل</td><td>${data.collectionDays} يوم</td></tr>
          <tr><td>متوسط السداد</td><td>${data.paymentDays} يوم</td></tr>
          ${beRow}
        </tbody>
      </table>
    </section>

    <section class="report-section">
      <h3>أهم الملاحظات</h3>
      <ul>${narrative.insights.map((i) => `<li>${i}</li>`).join("")}</ul>
    </section>

    <section class="report-section">
      <h3>خطة 30 يوم</h3>
      <ul>${narrative.actions.map((a) => `<li>${a}</li>`).join("")}</ul>
    </section>

    <section class="report-section">
      <h3>تنبيه مهني</h3>
      <p>هذا التقرير لأغراض إرشادية وتحليلية فقط، ولا يعد استشارة مالية أو ضريبية أو محاسبية رسمية.</p>
    </section>

    <section class="report-section report-contact">
      <h3>بيانات التواصل</h3>
      <p><strong>@ / Email:</strong> mahmoud.mamdouh2270@gmail.com</p>
      <p><strong>W / WhatsApp:</strong> 01148889091</p>
      <p><strong>in / LinkedIn:</strong> https://www.linkedin.com/in/mahmoud-mamdouh2270/</p>
    </section>`;
}

// ─── Dashboard updaters ───────────────────────────────────────────────────────
function setList(el, items) {
  el.innerHTML = "";
  items.forEach((t) => { const li = document.createElement("li"); li.textContent = t; el.appendChild(li); });
}

function updateBreakeven(data, be) {
  if (!be.valid) {
    setText("breakevenValue", "لا يمكن الحساب");
    setText("breakevenGap",   "--");
    setText("breakevenStatus","هامش الربح صفر أو سالب");
    return;
  }
  const gapEl = document.querySelector("#breakevenGap");
  setText("breakevenValue",  formatMoney(Math.round(be.be),  data.currency));
  if (gapEl) {
    gapEl.textContent = `${be.gap >= 0 ? "+" : ""}${formatMoney(Math.round(be.gap), data.currency)}`;
    gapEl.style.color = be.gap >= 0 ? "#2f8f73" : "#b44955";
  }
  setText("breakevenStatus", be.gap >= 0 ? "فوق نقطة التعادل ✓" : "تحت نقطة التعادل ✗");
}

function updateDashboard(data, ratios) {
  setText("grossProfitValue", formatMoney(data.grossProfit, data.currency));
  setText("grossMarginValue", `هامش إجمالي ${formatPercent(ratios.grossMargin * 100)}`);
  setText("netProfitValue",   formatMoney(data.netProfit,   data.currency));
  setText("netMarginValue",   `هامش صافي ${formatPercent(ratios.netMargin * 100)}`);
  setText("runwayValue",      `${Math.round(ratios.runway * 10) / 10} شهر`);
  setText("cashValue",        `نقدية ${formatMoney(data.cash, data.currency)}`);
  setText("collectionValue",  `${data.collectionDays} يوم`);
  setText("paymentValue",     `السداد ${data.paymentDays} يوم`);
  setText("revenueTotal",     formatMoney(data.revenue, data.currency));

  const base = Math.max(data.revenue, data.cost + data.expenses + data.salaries + Math.max(data.netProfit, 0), 1);
  const cp = (data.cost      / base) * 100;
  const ep = (data.expenses  / base) * 100;
  const sp = (data.salaries  / base) * 100;
  const pp = (Math.max(data.netProfit, 0) / base) * 100;
  setHeight("costBar",    cp); setHeight("expenseBar", ep);
  setHeight("salaryBar",  sp); setHeight("profitBar",  pp);
  setText("costLabel",    `${formatPercent(cp)} من الإيراد`);
  setText("expenseLabel", `${formatPercent(ep)} من الإيراد`);
  setText("salaryLabel",  `${formatPercent(sp)} من الإيراد`);
  setText("profitLabel",  `${formatPercent(pp)} من الإيراد`);

  const mx = Math.max(data.cash, data.receivables, data.payables, 1);
  setHeight("cashBar",         (data.cash        / mx) * 100);
  setHeight("receivablesBar",  (data.receivables / mx) * 100);
  setHeight("payablesBar",     (data.payables    / mx) * 100);
  setText("cashLabel",         formatMoney(data.cash,        data.currency));
  setText("receivablesLabel",  formatMoney(data.receivables, data.currency));
  setText("payablesLabel",     formatMoney(data.payables,    data.currency));
  setText("liquidityRatio",    `تغطية ${Math.round(ratios.liquidityCoverage * 10) / 10}x`);

  const pp2 = (ratios.profitabilityScore / 30) * 100;
  const lp  = (ratios.liquidityScore     / 30) * 100;
  const exp = (ratios.expensesScore      / 20) * 100;
  const cop = (ratios.collectionScore    / 20) * 100;
  setWidth("profitabilityMeter", pp2); setWidth("liquidityMeter",  lp);
  setWidth("expensesMeter",      exp); setWidth("collectionMeter", cop);
  setText("profitabilityLabel", ratingWithPercent(pp2));
  setText("liquidityLabel",     ratingWithPercent(lp));
  setText("expensesLabel",      ratingWithPercent(exp));
  setText("collectionLabel",    ratingWithPercent(cop));
}

function updateHero(score, ratios) {
  setText("heroScore",  `${score}/100`);
  setText("heroRunway", `${Math.round(ratios.runway * 10) / 10} شهر`);
  setText("heroMargin", formatPercent(ratios.netMargin * 100));
}

// ─── Main analyze ─────────────────────────────────────────────────────────────
function analyze() {
  const fd   = new FormData(form);
  const data = {
    businessName: fd.get("businessName") || "النشاط",
    businessType: fd.get("businessType") || "النشاط",
    currency:     fd.get("currency")     || "جنيه",
    employees:    getNumber(fd, "employees"),
    revenue:      getNumber(fd, "revenue"),
    cost:         getNumber(fd, "cost"),
    expenses:     getNumber(fd, "expenses"),
    salaries:     getNumber(fd, "salaries"),
    cash:         getNumber(fd, "cash"),
    receivables:  getNumber(fd, "receivables"),
    payables:     getNumber(fd, "payables"),
    inventory:    getNumber(fd, "inventory"),
    collectionDays: getNumber(fd, "collectionDays"),
    paymentDays:    getNumber(fd, "paymentDays"),
  };
  data.grossProfit = data.revenue - data.cost;
  data.netProfit   = data.grossProfit - data.expenses - data.salaries;

  const ratios    = calculateScore(data);
  const narrative = buildInsights(data, ratios);
  const be        = calcBreakeven(data, ratios);
  latestReport    = createFullReport(data, ratios, narrative, be);

  const cls   = ratios.score >= 72 ? "status-good" : ratios.score >= 48 ? "status-watch" : "status-risk";
  const title = ratios.score >= 72 ? "قراءة مطمئنة" : ratios.score >= 48 ? "تحتاج ضبط" : "إنذار مالي مبكر";
  const text  = ratios.score >= 72
    ? `${data.businessName} لديه مؤشرات جيدة نسبيا. الأولوية الآن هي تثبيت الأداء وتحسين التحصيل.`
    : ratios.score >= 48
      ? `${data.businessName} يعمل بمستوى مقبول، لكن توجد نقاط ضغط تحتاج متابعة خلال الشهر القادم.`
      : `${data.businessName} يحتاج إجراءات عاجلة لتحسين السيولة والربحية قبل التوسع أو زيادة المصروفات.`;

  resultPanel.classList.remove("status-good", "status-watch", "status-risk");
  resultPanel.classList.add(cls);
  statusTitle.textContent = title;
  statusText.textContent  = text;
  scoreValue.textContent  = ratios.score;
  resultPanel.style.setProperty("--score", ratios.score);

  updateDashboard(data, ratios);
  updateBreakeven(data, be);
  setList(insightsEl, narrative.insights);
  setList(actionsEl,  narrative.actions);
  updateHero(ratios.score, ratios);

  if (followUpForm) followUpForm.classList.remove("is-hidden");
}

// ─── Events ───────────────────────────────────────────────────────────────────
form.addEventListener("submit", (e) => { e.preventDefault(); track("analyze"); analyze(); });

document.querySelectorAll("[data-example]").forEach((btn) =>
  btn.addEventListener("click", () => loadExample(btn.dataset.example))
);

openReport.addEventListener("click", () => {
  if (!latestReport) return;
  track("report_open");
  fullReport.innerHTML = latestReport;
  reportModal.classList.add("is-open");
  reportModal.setAttribute("aria-hidden", "false");
});

closeReport.addEventListener("click", () => {
  reportModal.classList.remove("is-open");
  reportModal.setAttribute("aria-hidden", "true");
});

printReport.addEventListener("click", () => window.print());

reportModal.addEventListener("click", (e) => {
  if (e.target === reportModal) closeReport.click();
});

if (followUpForm) {
  followUpForm.addEventListener("submit", () => track("followup_submit"));
}

document.querySelectorAll(".interactive-card").forEach((card) => {
  card.addEventListener("click", (e) => {
    if (e.target.closest("a, button, input, select, textarea")) return;
    card.classList.toggle("is-pinned");
  });
});