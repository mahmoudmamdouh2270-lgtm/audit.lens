// --- Analytics stub: replace body with GA4/Plausible calls when ready ---
function track(event, data) {
  // window.gtag?.("event", event, data);
}

const form = document.querySelector("#financeForm");
const resultPanel = document.querySelector(".result-panel");
const statusTitle = document.querySelector("#statusTitle");
const statusText = document.querySelector("#statusText");
const scoreValue = document.querySelector("#scoreValue");
const insightsEl = document.querySelector("#insights");
const actionsEl = document.querySelector("#actionsList");
const openReport = document.querySelector("#openReport");
const closeReport = document.querySelector("#closeReport");
const printReport = document.querySelector("#printReport");
const reportModal = document.querySelector("#reportModal");
const fullReport = document.querySelector("#fullReport");
const followUpForm = document.querySelector("#followUpForm");
let latestReport = null;

// --- Sample datasets ---
const sampleData = {
  restaurant: {
    businessName: "مطعم النيل",
    businessType: "مطعم أو كافيه",
    currency: "جنيه",
    employees: 6,
    revenue: 120000,
    cost: 55000,
    expenses: 18000,
    salaries: 22000,
    cash: 35000,
    receivables: 8000,
    payables: 25000,
    inventory: 15000,
    collectionDays: 7,
    paymentDays: 30,
  },
  services: {
    businessName: "مكتب الخبراء",
    businessType: "خدمات",
    currency: "جنيه",
    employees: 4,
    revenue: 95000,
    cost: 15000,
    expenses: 22000,
    salaries: 38000,
    cash: 42000,
    receivables: 55000,
    payables: 18000,
    inventory: 0,
    collectionDays: 45,
    paymentDays: 30,
  },
  trade: {
    businessName: "مؤسسة الفجر التجارية",
    businessType: "تجارة",
    currency: "جنيه",
    employees: 8,
    revenue: 380000,
    cost: 265000,
    expenses: 28000,
    salaries: 32000,
    cash: 68000,
    receivables: 95000,
    payables: 110000,
    inventory: 180000,
    collectionDays: 35,
    paymentDays: 45,
  },
};

function loadExample(type) {
  const d = sampleData[type];
  if (!d) return;
  Object.entries(d).forEach(([key, value]) => {
    const field = form.elements[key];
    if (field) field.value = value;
  });
  track("example", { type });
  analyze();
}

// --- Utility functions ---
function getNumber(formData, key) {
  return Number(formData.get(key)) || 0;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function setText(id, value) {
  const el = document.querySelector(`#${id}`);
  if (el) el.textContent = value;
}

function setWidth(id, value) {
  const el = document.querySelector(`#${id}`);
  if (el) el.style.width = `${clamp(value, 0, 100)}%`;
}

function setHeight(id, value) {
  const el = document.querySelector(`#${id}`);
  if (el) el.style.height = `${clamp(value, 6, 100)}%`;
}

function formatMoney(value, currency) {
  return `${Math.round(value).toLocaleString("ar-EG")} ${currency}`;
}

function formatPercent(value) {
  return `${Math.round(value * 10) / 10}%`;
}

function rating(value) {
  if (value >= 75) return "قوي";
  if (value >= 50) return "متوسط";
  return "ضعيف";
}

function ratingWithPercent(value) {
  return `${rating(value)} - ${Math.round(value)}%`;
}

// --- Core calculation ---
function calculateScore(data) {
  const grossMargin = data.revenue ? data.grossProfit / data.revenue : 0;
  const netMargin = data.revenue ? data.netProfit / data.revenue : 0;
  const monthlyBurn = Math.max(data.expenses + data.salaries + Math.max(data.cost - data.revenue, 0), 1);
  const runway = data.cash / monthlyBurn;
  const expenseRatio = data.revenue ? (data.expenses + data.salaries) / data.revenue : 1;
  const liquidityCoverage = data.payables ? (data.cash + data.receivables * 0.65) / data.payables : 2;
  const collectionPressure = data.collectionDays <= data.paymentDays ? 1 : data.paymentDays / data.collectionDays;

  const profitabilityScore = clamp((grossMargin * 35) + (netMargin * 95), 0, 30);
  const liquidityScore = clamp((runway / 3) * 18 + liquidityCoverage * 6, 0, 30);
  const expensesScore = clamp((1 - expenseRatio) * 28, 0, 20);
  const collectionScore = clamp(collectionPressure * 13 + (data.collectionDays <= 45 ? 7 : 3), 0, 20);

  return {
    score: Math.round(profitabilityScore + liquidityScore + expensesScore + collectionScore),
    grossMargin,
    netMargin,
    runway,
    expenseRatio,
    liquidityCoverage,
    profitabilityScore,
    liquidityScore,
    expensesScore,
    collectionScore,
  };
}

function buildInsights(data, ratios) {
  const insights = [];
  const actions = [];

  if (ratios.netMargin >= 0.15) {
    insights.push("هامش صافي الربح جيد ويعطي مساحة لتحسين السيولة أو إعادة الاستثمار.");
  } else if (ratios.netMargin > 0) {
    insights.push("الشركة رابحة، لكن هامش صافي الربح محدود ويحتاج متابعة دقيقة للمصروفات والتسعير.");
    actions.push("راجع أكبر 10 بنود مصروفات وحدد بندين يمكن تخفيضهما خلال الشهر الحالي.");
  } else {
    insights.push("صافي الربح سلبي، وهذا يعني أن النشاط يحتاج قرارا سريعا في التسعير أو التكلفة أو المصروفات.");
    actions.push("ابدأ بمراجعة الأسعار وتكلفة الخدمة أو البضاعة قبل إضافة أي مصروف جديد.");
  }

  if (ratios.runway >= 3) {
    insights.push("النقدية الحالية تغطي أكثر من 3 أشهر تقريبا، وهذا مستوى مريح نسبيا للشركات الصغيرة.");
  } else if (ratios.runway >= 1) {
    insights.push("النقدية تغطي فترة قصيرة، لذلك أي تأخير في التحصيل قد يضغط على الالتزامات.");
    actions.push("حدد حد أدنى للنقدية لا يقل عن شهرين من المصروفات الشهرية.");
  } else {
    insights.push("السيولة تحت ضغط واضح، والنقدية الحالية لا تكفي شهرا كاملا من الالتزامات التشغيلية.");
    actions.push("اجمع التحصيلات المتأخرة ووقف المصروفات غير الضرورية لمدة 30 يوم.");
  }

  if (data.collectionDays > data.paymentDays) {
    insights.push("متوسط التحصيل أبطأ من السداد للموردين، وهذا قد يخلق فجوة نقدية حتى لو المبيعات جيدة.");
    actions.push("ضع سياسة تحصيل أقصر أو دفعة مقدمة للعملاء الجدد.");
  } else {
    insights.push("دورة التحصيل أفضل من دورة السداد، وهذا يساعد على تقليل ضغط الكاش.");
  }

  if (ratios.expenseRatio > 0.45) {
    insights.push("نسبة المصروفات والرواتب إلى الإيرادات مرتفعة وتحتاج مراجعة قبل التوسع.");
  }

  if (data.receivables > data.cash) {
    actions.push("قسم العملاء المدينين حسب العمر وابدأ بالمديونيات الأكبر والأقدم.");
  }

  actions.push("اعمل تقريرا شهريا بنفس المؤشرات: الربحية، السيولة، المصروفات، والتحصيل.");

  return {
    insights: insights.slice(0, 5),
    actions: actions.slice(0, 5),
  };
}

// --- Report builder (enriched for print) ---
function createFullReport(data, ratios, narrative) {
  const scoreColor = ratios.score >= 72 ? "#2f8f73" : ratios.score >= 48 ? "#b9872d" : "#b44955";
  const scoreLabel = ratios.score >= 72 ? "قراءة مطمئنة" : ratios.score >= 48 ? "تحتاج ضبط" : "إنذار مالي مبكر";

  return `
    <section class="report-section report-score-block">
      <div class="report-score-ring" style="border-color:${scoreColor}; color:${scoreColor}">
        <strong>${ratios.score}</strong>
        <small>من 100</small>
      </div>
      <div class="report-score-meta">
        <h3 style="color:${scoreColor}; margin-bottom:4px">${scoreLabel}</h3>
        <p style="margin:0; color:#555">${data.businessName} — ${data.businessType} — ${new Date().toLocaleDateString("ar-EG")}</p>
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
          <strong style="color:${data.netProfit >= 0 ? "#2f8f73" : "#b44955"}">${formatMoney(data.netProfit, data.currency)}</strong>
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

    <section class="report-section">
      <h3>مقاييس الأداء</h3>
      <div class="report-meters">
        <div class="report-meter-row">
          <span>الربحية</span>
          <div class="report-meter-bar"><div style="width:${Math.round((ratios.profitabilityScore/30)*100)}%; background:${scoreColor}"></div></div>
          <strong>${ratingWithPercent((ratios.profitabilityScore/30)*100)}</strong>
        </div>
        <div class="report-meter-row">
          <span>السيولة</span>
          <div class="report-meter-bar"><div style="width:${Math.round((ratios.liquidityScore/30)*100)}%; background:${scoreColor}"></div></div>
          <strong>${ratingWithPercent((ratios.liquidityScore/30)*100)}</strong>
        </div>
        <div class="report-meter-row">
          <span>المصروفات</span>
          <div class="report-meter-bar"><div style="width:${Math.round((ratios.expensesScore/20)*100)}%; background:${scoreColor}"></div></div>
          <strong>${ratingWithPercent((ratios.expensesScore/20)*100)}</strong>
        </div>
        <div class="report-meter-row">
          <span>التحصيل</span>
          <div class="report-meter-bar"><div style="width:${Math.round((ratios.collectionScore/20)*100)}%; background:${scoreColor}"></div></div>
          <strong>${ratingWithPercent((ratios.collectionScore/20)*100)}</strong>
        </div>
      </div>
    </section>

    <section class="report-section">
      <h3>جدول المؤشرات المالية</h3>
      <table class="report-table">
        <thead>
          <tr><th>المؤشر</th><th>القيمة</th></tr>
        </thead>
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
        </tbody>
      </table>
    </section>

    <section class="report-section">
      <h3>أهم الملاحظات</h3>
      <ul>${narrative.insights.map((item) => `<li>${item}</li>`).join("")}</ul>
    </section>

    <section class="report-section">
      <h3>خطة 30 يوم</h3>
      <ul>${narrative.actions.map((item) => `<li>${item}</li>`).join("")}</ul>
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
    </section>
  `;
}

function setList(element, items) {
  element.innerHTML = "";
  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    element.appendChild(li);
  });
}

function updateDashboard(data, ratios) {
  setText("grossProfitValue", formatMoney(data.grossProfit, data.currency));
  setText("grossMarginValue", `هامش إجمالي ${formatPercent(ratios.grossMargin * 100)}`);
  setText("netProfitValue", formatMoney(data.netProfit, data.currency));
  setText("netMarginValue", `هامش صافي ${formatPercent(ratios.netMargin * 100)}`);
  setText("runwayValue", `${Math.round(ratios.runway * 10) / 10} شهر`);
  setText("cashValue", `نقدية ${formatMoney(data.cash, data.currency)}`);
  setText("collectionValue", `${data.collectionDays} يوم`);
  setText("paymentValue", `السداد ${data.paymentDays} يوم`);
  setText("revenueTotal", formatMoney(data.revenue, data.currency));

  const revenueBase = Math.max(data.revenue, data.cost + data.expenses + data.salaries + Math.max(data.netProfit, 0), 1);
  const costPct = (data.cost / revenueBase) * 100;
  const expensePct = (data.expenses / revenueBase) * 100;
  const salaryPct = (data.salaries / revenueBase) * 100;
  const profitPct = (Math.max(data.netProfit, 0) / revenueBase) * 100;
  setHeight("costBar", costPct);
  setHeight("expenseBar", expensePct);
  setHeight("salaryBar", salaryPct);
  setHeight("profitBar", profitPct);
  setText("costLabel", `${formatPercent(costPct)} من الإيراد`);
  setText("expenseLabel", `${formatPercent(expensePct)} من الإيراد`);
  setText("salaryLabel", `${formatPercent(salaryPct)} من الإيراد`);
  setText("profitLabel", `${formatPercent(profitPct)} من الإيراد`);

  const maxLiquidity = Math.max(data.cash, data.receivables, data.payables, 1);
  setHeight("cashBar", (data.cash / maxLiquidity) * 100);
  setHeight("receivablesBar", (data.receivables / maxLiquidity) * 100);
  setHeight("payablesBar", (data.payables / maxLiquidity) * 100);
  setText("cashLabel", formatMoney(data.cash, data.currency));
  setText("receivablesLabel", formatMoney(data.receivables, data.currency));
  setText("payablesLabel", formatMoney(data.payables, data.currency));
  setText("liquidityRatio", `تغطية ${Math.round(ratios.liquidityCoverage * 10) / 10}x`);

  const profitabilityPct = (ratios.profitabilityScore / 30) * 100;
  const liquidityPct = (ratios.liquidityScore / 30) * 100;
  const expensesPct = (ratios.expensesScore / 20) * 100;
  const collectionPct = (ratios.collectionScore / 20) * 100;

  setWidth("profitabilityMeter", profitabilityPct);
  setWidth("liquidityMeter", liquidityPct);
  setWidth("expensesMeter", expensesPct);
  setWidth("collectionMeter", collectionPct);
  setText("profitabilityLabel", ratingWithPercent(profitabilityPct));
  setText("liquidityLabel", ratingWithPercent(liquidityPct));
  setText("expensesLabel", ratingWithPercent(expensesPct));
  setText("collectionLabel", ratingWithPercent(collectionPct));
}

function updateHero(score, ratios) {
  setText("heroScore", `${score}/100`);
  setText("heroRunway", `${Math.round(ratios.runway * 10) / 10} شهر`);
  setText("heroMargin", formatPercent(ratios.netMargin * 100));
}

// --- Main analyze function ---
function analyze() {
  const formData = new FormData(form);
  const data = {
    businessName: formData.get("businessName") || "النشاط",
    businessType: formData.get("businessType") || "النشاط",
    currency: formData.get("currency") || "جنيه",
    employees: getNumber(formData, "employees"),
    revenue: getNumber(formData, "revenue"),
    cost: getNumber(formData, "cost"),
    expenses: getNumber(formData, "expenses"),
    salaries: getNumber(formData, "salaries"),
    cash: getNumber(formData, "cash"),
    receivables: getNumber(formData, "receivables"),
    payables: getNumber(formData, "payables"),
    inventory: getNumber(formData, "inventory"),
    collectionDays: getNumber(formData, "collectionDays"),
    paymentDays: getNumber(formData, "paymentDays"),
  };

  data.grossProfit = data.revenue - data.cost;
  data.netProfit = data.grossProfit - data.expenses - data.salaries;

  const ratios = calculateScore(data);
  const narrative = buildInsights(data, ratios);
  latestReport = createFullReport(data, ratios, narrative);

  const statusClass = ratios.score >= 72 ? "status-good" : ratios.score >= 48 ? "status-watch" : "status-risk";
  const title = ratios.score >= 72 ? "قراءة مطمئنة" : ratios.score >= 48 ? "تحتاج ضبط" : "إنذار مالي مبكر";
  const text =
    ratios.score >= 72
      ? `${data.businessName} لديه مؤشرات جيدة نسبيا. الأولوية الآن هي تثبيت الأداء وتحسين التحصيل.`
      : ratios.score >= 48
        ? `${data.businessName} يعمل بمستوى مقبول، لكن توجد نقاط ضغط تحتاج متابعة خلال الشهر القادم.`
        : `${data.businessName} يحتاج إجراءات عاجلة لتحسين السيولة والربحية قبل التوسع أو زيادة المصروفات.`;

  resultPanel.classList.remove("status-good", "status-watch", "status-risk");
  resultPanel.classList.add(statusClass);
  statusTitle.textContent = title;
  statusText.textContent = text;
  scoreValue.textContent = ratios.score;
  resultPanel.style.setProperty("--score", ratios.score);

  updateDashboard(data, ratios);
  setList(insightsEl, narrative.insights);
  setList(actionsEl, narrative.actions);
  updateHero(ratios.score, ratios);

  // Show the follow-up form after first analysis
  if (followUpForm) followUpForm.classList.remove("is-hidden");
}

// --- Event listeners ---
form.addEventListener("submit", (event) => {
  event.preventDefault();
  track("analyze");
  analyze();
});

document.querySelectorAll("[data-example]").forEach((btn) => {
  btn.addEventListener("click", () => loadExample(btn.dataset.example));
});

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

printReport.addEventListener("click", () => {
  window.print();
});

reportModal.addEventListener("click", (event) => {
  if (event.target === reportModal) closeReport.click();
});

if (followUpForm) {
  followUpForm.addEventListener("submit", () => track("followup_submit"));
}

document.querySelectorAll(".interactive-card").forEach((card) => {
  card.addEventListener("click", (event) => {
    if (event.target.closest("a, button, input, select, textarea")) return;
    card.classList.toggle("is-pinned");
  });
});