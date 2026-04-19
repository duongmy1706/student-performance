import { useState, useCallback } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Upload, Brain, BarChart2, Users, FileText } from 'lucide-react'

export default function UploadPage({ onDataLoaded }) {
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState('')

  const handleFile = async (file) => {
    if (!file || !file.name.endsWith('.csv')) {
      toast.error('Vui lòng chọn file CSV')
      return
    }
    setLoading(true)
    setProgress('Đang upload và phân tích dữ liệu...')
    const formData = new FormData()
    formData.append('file', file)
    try {
      setProgress('Đang train mô hình Random Forest...')
      const res = await axios.post('/api/upload', formData)
      setProgress('Hoàn tất! Đang chuyển sang dashboard...')
      toast.success(`Đã nạp ${res.data.total_students.toLocaleString()} học sinh. Độ chính xác ML: ${res.data.model_accuracy}%`)
      setTimeout(() => onDataLoaded(res.data), 800)
    } catch (e) {
      toast.error('Lỗi: ' + (e.response?.data?.detail || e.message))
      setLoading(false)
      setProgress('')
    }
  }

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    handleFile(file)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex flex-col items-center justify-center p-6">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-10 animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 backdrop-blur rounded-2xl mb-5">
            <Brain className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">
            Student Performance ML
          </h1>
          <p className="text-blue-200 text-lg">
            Hệ thống AI phát hiện học sinh nguy cơ & đề xuất can thiệp cá nhân hóa
          </p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <span className="px-3 py-1 bg-green-500/20 text-green-300 rounded-full text-sm font-medium border border-green-500/30">
              scikit-learn Random Forest
            </span>
            <span className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm font-medium border border-purple-500/30">
              25,000+ học sinh
            </span>
            <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm font-medium border border-blue-500/30">
              4 Module phân tích
            </span>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { icon: Brain, title: 'ML Dự đoán', desc: 'Random Forest dự đoán nguy cơ từ hành vi học tập' },
            { icon: Users, title: 'Can thiệp AI', desc: 'Khuyến nghị cá nhân hóa cho từng học sinh' },
            { icon: BarChart2, title: 'Dashboard', desc: 'KPI, so sánh nhóm, phân tích nhân tố' },
            { icon: FileText, title: 'Báo cáo PDF', desc: 'Xuất báo cáo tự động với phát hiện bất thường' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white/10 backdrop-blur rounded-xl p-4 text-center border border-white/20">
              <Icon className="w-7 h-7 text-blue-200 mx-auto mb-2" />
              <div className="text-white font-semibold text-sm mb-1">{title}</div>
              <div className="text-blue-200 text-xs leading-relaxed">{desc}</div>
            </div>
          ))}
        </div>

        {/* Upload Area */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`relative bg-white rounded-2xl p-10 text-center transition-all duration-200 shadow-xl ${
            dragging ? 'border-4 border-blue-400 scale-[1.02]' : 'border-2 border-dashed border-gray-200'
          } ${loading ? 'pointer-events-none' : ''}`}
        >
          {loading ? (
            <div className="py-4">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
              </div>
              <p className="text-gray-700 font-semibold text-lg mb-2">{progress}</p>
              <p className="text-gray-400 text-sm">Mô hình đang học từ dữ liệu, vui lòng chờ...</p>
            </div>
          ) : (
            <>
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Upload className="w-8 h-8 text-blue-500" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">
                Kéo & thả file CSV vào đây
              </h2>
              <p className="text-gray-500 mb-6">
                Hoặc nhấn nút bên dưới để chọn file từ máy tính
              </p>
              <label className="inline-block cursor-pointer">
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files[0])}
                />
                <span className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors shadow-md">
                  Chọn file CSV
                </span>
              </label>
              <p className="text-gray-400 text-xs mt-4">
                Hỗ trợ: Student_Performance.csv (có các cột: study_hours, attendance_percentage, study_method, ...)
              </p>
            </>
          )}
        </div>

        <p className="text-center text-blue-300/60 text-sm mt-6">
          Dữ liệu chỉ được xử lý tại máy của bạn — không gửi lên internet
        </p>
      </div>
    </div>
  )
}
