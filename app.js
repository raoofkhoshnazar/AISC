const weekDetails = {
  1: {
    label: 'هفتهٔ ۱ تا ۲',
    title: 'خودت، مخاطبت و مسئله‌ای که حل می‌کنی را پیدا کن.',
    text: 'با تمرین‌های کوتاه و راهنمای مستطاب، مهارت‌ها، علایق، تجربه‌ها و ارزشی را که می‌توانی ارائه دهی، به یک ایدهٔ قابل آزمایش تبدیل می‌کنی.',
    tags: ['تکلیف عملی', 'بازخورد پشتیبان', 'راهنمای AI'],
  },
  2: {
    label: 'هفتهٔ ۳ تا ۴',
    title: 'از حدس زدن دست بردار؛ ایده‌ات را با مخاطب واقعی بررسی کن.',
    text: 'مخاطب هدف، مسئلهٔ مهم او و نمونه‌های موجود بازار را بررسی می‌کنی تا محصولی بسازی که واقعاً کسی به آن نیاز دارد.',
    tags: ['تحقیق بازار', 'مصاحبه با مخاطب', 'تأیید دو مرحله‌ای'],
  },
  3: {
    label: 'هفتهٔ ۵ تا ۶',
    title: 'محصول آموزشی‌ات را برای یک تجربهٔ خوب طراحی کن.',
    text: 'محتوا، مسیر کاربر و نسخهٔ اولیهٔ محصولت را طراحی می‌کنی؛ کوچک، روشن و آماده برای ساخت.',
    tags: ['نقشهٔ محتوا', 'طراحی تجربه', 'نمونهٔ اولیه'],
  },
  4: {
    label: 'هفتهٔ ۷ تا ۹',
    title: 'SaaS خودت را با ابزارهای هوش مصنوعی بساز.',
    text: 'صفحه‌ها، محتوا و قابلیت‌های اصلی محصولت را مرحله‌به‌مرحله می‌سازی و با کمک AI آن را بهتر می‌کنی.',
    tags: ['ساخت محصول', 'کانبان شخصی', 'بازبینی مستطاب'],
  },
  5: {
    label: 'هفتهٔ ۱۰ تا ۱۲',
    title: 'آمادهٔ انتشار شو و اولین مشتری‌هایت را پیدا کن.',
    text: 'قیمت‌گذاری، پرداخت، تست محصول و برنامهٔ انتشار را تکمیل می‌کنی تا محصولت برای فروش آماده باشد.',
    tags: ['پرداخت', 'تست کاربر', 'اولین فروش'],
  },
};

const detail = document.querySelector('#week-detail');
const timeline = document.querySelector('#timeline');

timeline.addEventListener('click', (event) => {
  const item = event.target.closest('.timeline-item');
  if (!item) return;

  const content = weekDetails[item.dataset.week];
  document.querySelectorAll('.timeline-item').forEach((button) => button.classList.remove('active'));
  item.classList.add('active');
  detail.innerHTML = `<span class="week-number">${content.label}</span><h3>${content.title}</h3><p>${content.text}</p><div class="detail-tags">${content.tags.map((tag) => `<span>${tag}</span>`).join('')}</div>`;
});
