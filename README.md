# 🎯 IELTS Buddy Bot - Telegram Study Tracker

Bot Telegram hỗ trợ và giám sát quá trình học IELTS, mục tiêu đạt band 7.0.

## ✨ Features

- 📋 **Study Plan** - Kế hoạch học 3 phase (Foundation → Intensive → Mock Test)
- 📊 **Progress Tracking** - Theo dõi tiến trình với progress bars và trend analysis
- 📝 **Daily Logging** - Ghi nhận thời gian học hàng ngày, streak tracking
- 🧪 **Placement Test** - Bài test 20 câu đánh giá trình độ hiện tại
- 📚 **Resources** - Tài liệu websites + sách cho từng kỹ năng
- 🗓️ **Test Scheduling** - Lên lịch kiểm tra hàng tháng
- 🧠 **Vocabulary Quiz** - Mini quiz từ vựng IELTS nâng cao
- ⏰ **Reminders** - Nhắc nhở học hàng ngày + báo cáo tuần
- 🌐 **Bilingual** - Hỗ trợ Tiếng Việt & English
- 📅 **Notion Calendar** - Tích hợp Notion cho quản lý lịch

## 🛠️ Tech Stack

- **Runtime**: Node.js 20 + TypeScript
- **Bot Framework**: Telegraf v4
- **Database**: SQLite (better-sqlite3)
- **Calendar**: Notion API
- **Scheduler**: node-cron
- **Deploy**: Docker + GitHub Actions CI/CD

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Telegram Bot Token (from [@BotFather](https://t.me/botfather))

### Local Development

```bash
# Install dependencies
npm install

# Create .env from example
cp .env.example .env
# Edit .env with your BOT_TOKEN

# Run in dev mode (hot reload)
npm run dev
```

### Docker Deployment

```bash
# Build and run
docker compose up -d

# View logs
docker compose logs -f ielts-bot
```

## 📱 Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Khởi tạo bot, welcome message |
| `/plan` | Xem kế hoạch học theo phase |
| `/resources` | Tài liệu websites & sách |
| `/log <skill> <minutes>` | Ghi nhận thời gian học |
| `/today` | Tổng kết hôm nay |
| `/week` | Báo cáo tuần |
| `/score <L> <R> <W> <S>` | Nhập điểm mock test |
| `/history` | Lịch sử điểm số |
| `/progress` | Báo cáo tiến trình tổng quan |
| `/placement` | Test đánh giá trình độ |
| `/quiz` | Vocabulary quiz |
| `/schedule` | Lên lịch bài kiểm tra |
| `/next_test` | Xem bài test tiếp theo |
| `/tips` | Mẹo học theo phase hiện tại |
| `/remind <HH:MM>` | Đặt giờ nhắc nhở |
| `/settings` | Cài đặt target, deadline |
| `/lang` | Đổi ngôn ngữ VI/EN |

## 🗓️ Notion Calendar Setup

1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Create new integration, copy token
3. Create a Notion Database with columns: `Name` (title), `Date` (date), `Description` (text)
4. Share database with your integration
5. Copy database ID from URL
6. Set `NOTION_API_TOKEN` and `NOTION_DATABASE_ID` in `.env`

## 🔧 CI/CD Setup

Add these secrets to your GitHub repository:
- `VPS_HOST` - VPS IP address
- `VPS_USER` - SSH username
- `VPS_SSH_KEY` - SSH private key

## 📄 License

MIT
