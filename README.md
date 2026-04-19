# Student Performance ML Dashboard

## Lỗi đã sửa

**Lỗi form "Tự nhập dự đoán" bị nhảy thông tin khi bấm Dự đoán:**
- Nguyên nhân: Dòng `setResult(null)` trong hàm `handleSubmit` (file `PredictTab.jsx` dòng 183) xóa kết quả cũ ngay lúc bấm nút, khiến panel bên phải thay đổi kích thước đột ngột → trang bị giật/nhảy.
- Cách sửa: Xóa dòng `setResult(null)` khỏi `handleSubmit`. Kết quả chỉ bị xóa khi người dùng bấm Reset.
- Các phần khác KHÔNG thay đổi.

---

## Cách 1: Chạy không dùng Docker (npm install / npm run dev)

### Bước 1 — Chạy Backend

Mở **Terminal 1** trong VS Code:

```bash
cd backend
python -m venv venv
```

Kích hoạt môi trường ảo:
```bash
# Windows
venv\Scripts\activate

# Mac / Linux
source venv/bin/activate
```

Cài thư viện và chạy:
```bash
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Backend chạy tại: **http://localhost:8000**

---

### Bước 2 — Chạy Frontend

Mở **Terminal 2** trong VS Code (nhấn dấu **+** trong panel terminal):

```bash
cd frontend
npm install
npm run dev
```

Frontend chạy tại: **http://localhost:5173**

---

### Bước 3 — Sử dụng

1. Mở trình duyệt tại **http://localhost:5173**
2. Upload file `backend/data/Student_Performance.csv`
3. Chờ train mô hình (~10-30 giây)
4. Vào tab **"Tự nhập dự đoán"** → nhập thông tin → bấm **Dự đoán nguy cơ**

---

## Cách 2: Chạy bằng Docker

### Yêu cầu: Docker Desktop đang chạy

```bash
docker-compose up --build
```

- Frontend: http://localhost:5173
- Backend:  http://localhost:8000

Để dừng:
```bash
docker-compose down
```
