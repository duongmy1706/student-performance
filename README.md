# 🎓 Student Performance ML Dashboard

Ứng dụng web phân tích và dự đoán nguy cơ học tập của học sinh dựa trên mô hình Machine Learning (Random Forest). Hệ thống cho phép upload dữ liệu CSV, tự động huấn luyện mô hình, trực quan hoá kết quả và dự đoán nguy cơ cho từng học sinh.

---

## ✨ Tính năng chính

| Tab | Mô tả |
|-----|-------|
| **Overview** | Tổng quan KPI, phân phối điểm, tỷ lệ nguy cơ |
| **Students** | Danh sách học sinh, tìm kiếm & lọc theo trạng thái |
| **Analysis** | Biểu đồ phân tích đa chiều (phương pháp học, điểm danh, v.v.) |
| **ML Model** | Độ chính xác mô hình, tầm quan trọng đặc trưng |
| **Predict** | Nhập thông tin học sinh → dự đoán nguy cơ học tập |
| **Report** | Xuất báo cáo PDF đầy đủ |
| **Chatbot** | Hỏi đáp thông minh về dữ liệu (tích hợp Ollama) |

---

## 🛠️ Công nghệ sử dụng

**Frontend**
- React 18 + Vite
- Tailwind CSS
- Recharts (biểu đồ)
- Axios, React Router DOM, Lucide React

**Backend**
- FastAPI + Uvicorn
- scikit-learn (Random Forest Classifier)
- pandas, numpy, matplotlib, seaborn
- ReportLab (xuất PDF)
- httpx (kết nối Ollama)

---

## 🚀 Hướng dẫn chạy

### Cách 1 — Chạy thủ công (không dùng Docker)

**Bước 1 — Khởi động Backend**

Mở **Terminal 1** trong VS Code:

```bash
cd backend
python -m venv venv
```

Kích hoạt môi trường ảo:

```bash
# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate
```

Cài thư viện và chạy server:

```bash
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Backend sẽ chạy tại: **http://localhost:8000**

---

**Bước 2 — Khởi động Frontend**

Mở **Terminal 2** trong VS Code (nhấn dấu **+** ở panel terminal):

```bash
cd frontend
npm install
npm run dev
```

Frontend sẽ chạy tại: **http://localhost:5173**

---

**Bước 3 — Sử dụng ứng dụng**

1. Mở trình duyệt tại **http://localhost:5173**
2. Upload file `backend/data/Student_Performance.csv`
3. Chờ hệ thống huấn luyện mô hình (~10–30 giây)
4. Khám phá các tab phân tích hoặc vào **"Predict"** → nhập thông tin → bấm **Dự đoán nguy cơ**

---

### Cách 2 — Chạy bằng Docker

> **Yêu cầu:** Docker Desktop đang chạy

```bash
docker-compose up --build
```

| Dịch vụ | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend  | http://localhost:8000 |

Để dừng toàn bộ dịch vụ:

```bash
docker-compose down
```

---

## 🤖 Chatbot (tuỳ chọn)

Tính năng Chatbot sử dụng [Ollama](https://ollama.com) chạy local. Để kích hoạt:

1. Cài đặt Ollama và pull model (ví dụ: `ollama pull llama3`)
2. Đảm bảo Ollama đang chạy tại `http://localhost:11434`
3. Biến môi trường `OLLAMA_BASE_URL` có thể tuỳ chỉnh trong `docker-compose.yml`

---

## 📁 Cấu trúc dự án

```
student-performance/
├── backend/
│   ├── data/
│   │   └── Student_Performance.csv
│   ├── main.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/      # OverviewTab, StudentsTab, AnalysisTab, ...
│   │   ├── pages/           # Dashboard, UploadPage
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
├── docker-compose.yml
├── Dockerfile.backend
├── Dockerfile.frontend
└── README.md
```
