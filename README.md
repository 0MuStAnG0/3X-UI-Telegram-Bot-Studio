# 3X-UI Telegram Bot Studio

ربات تلگرامی مدیریت و فروش پنل‌های **3X-UI** همراه با وب‌پنل داخلی، ابزار خط‌فرمان اختصاصی `vpn-bot` و سرویس `systemd`.

## ویژگی‌های کلیدی

- 🐍 **Python 3 و aiogram 3.x** (کاملاً async)
- 🗄️ **دیتابیس SQLite** با حالت WAL و ۹ ایندکس B-Tree بهینه برای سرعت بالا
- 🌐 **پشتیبانی از پروکسی SOCKS5** برای دور زدن تحریم (اختیاری، مناسب سرورهای ایران)
- 🔌 **اتصال به پنل 3X-UI صرفاً با API Token** (`Authorization: Bearer` بدون نیاز به یوزرنیم/پسورد پنل)
- 🖥️ **ابزار خط‌فرمان اختصاصی `vpn-bot`** برای کنترل سرویس، مشاهده لاگ، بکاپ، بازیابی و بررسی سلامت
- ⚙️ **سرویس `systemd` (`vpnbot.service`)** با ری‌استارت خودکار در صورت کرش یا ریبوت سرور
- 🌍 **وب‌پنل مدیریت داخلی** (نمایش آدرس و رمز ورود در پایان نصب)

---

## 🚀 نصب یک‌خطی در سرور لینوکس

کافی است دستور زیر را با دسترسی `root` در ترمینال سرور (Ubuntu / Debian / CentOS) اجرا کنید:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/0MuStAnG0/3X-UI-Telegram-Bot-Studio/main/install.sh)
```

یا اگر مخزن را کلون کرده‌اید:

```bash
git clone https://github.com/0MuStAnG0/3X-UI-Telegram-Bot-Studio.git
cd 3X-UI-Telegram-Bot-Studio
sudo bash install.sh
```

در پایان نصب، سرویس `vpnbot` به صورت خودکار اجرا شده و **آدرس وب‌پنل** (`http://<SERVER_IP>:8080`) و رمز عبور در ترمینال نمایش داده می‌شود.

---

## 🖥️ مدیریت با ابزار `vpn-bot`

```bash
vpn-bot           # منوی تعاملی مدیریت
vpn-bot start     # شروع سرویس
vpn-bot stop      # توقف سرویس
vpn-bot restart   # ری‌استارت سرویس
vpn-bot status    # وضعیت سرویس systemd
vpn-bot logs      # مشاهده لاگ زنده
vpn-bot health    # بررسی سلامت ربات، توکن پنل، پروکسی SOCKS5، دیتابیس و وب‌پنل
vpn-bot stats     # آمار سریع دیتابیس SQLite
vpn-bot backup    # بکاپ کامل از کد، .env و دیتابیس
vpn-bot restore   # بازیابی از بکاپ
```
