import { useState, useEffect } from 'react'
import axios from 'axios'
import { FileText, Download, AlertTriangle, CheckCircle } from 'lucide-react'

export default function ReportTab({ summary }) {
  const [kpi, setKpi] = useState(null)
  const [anomalies, setAnomalies] = useState([])
  const [fi, setFi] = useState([])
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    Promise.all([
      axios.get('/api/kpi'),
      axios.get('/api/anomalies'),
      axios.get('/api/feature-importance'),
    ]).then(([k, a, f]) => {
      setKpi(k.data)
      setAnomalies(a.data.anomalies)
      setFi(f.data.feature_importance)
    }).catch(() => {})
  }, [])

  const downloadPDF = async () => {
    setDownloading(true)
    try {
      const res = await axios.get('/api/report/pdf', { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = 'student_performance_report.pdf'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert('Lỗi khi tạo PDF: ' + e.message)
    }
    setDownloading(false)
  }

  const featureLabels = {
    study_hours: 'Giờ tự học',
    attendance_percentage: 'Chuyên cần',
    study_method: 'Phương pháp học',
    school_type: 'Loại trường',
    parent_education: 'Học vấn phụ huynh',
    internet_access: 'Truy cập Internet',
    travel_time: 'Thời gian di chuyển',
    extra_activities: 'Hoạt động ngoại khóa',
    age: 'Tuổi',
    gender: 'Giới tính'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Báo cáo tự động</h2>
          <p className="text-gray-500 text-sm">Tổng hợp phân tích, bất thường, và khuyến nghị từ ML</p>
        </div>
        <button
          onClick={downloadPDF}
          disabled={downloading}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-xl transition-colors shadow-md"
        >
          <Download className="w-4 h-4" />
          {downloading ? 'Đang tạo PDF...' : 'Xuất báo cáo PDF'}
        </button>
      </div>

      {/* Report preview */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Report header */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-700 p-8 text-white">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-blue-200 text-sm font-medium mb-2">HỆ THỐNG AI HỖ TRỢ GIẢNG VIÊN</div>
              <h1 className="text-2xl font-bold mb-1">Báo cáo Phân tích Hiệu suất Học sinh</h1>
              <p className="text-blue-200">Machine Learning Edition — Random Forest Classifier</p>
            </div>
            <FileText className="w-16 h-16 text-blue-300/50" />
          </div>
          <div className="mt-6 grid grid-cols-4 gap-4">
            {kpi && [
              { label: 'Tổng học sinh', value: kpi.total_students?.toLocaleString() },
              { label: 'Độ chính xác ML', value: `${kpi.model_accuracy}%` },
              { label: 'Nguy cơ cao', value: kpi.high_risk_count?.toLocaleString() },
              { label: 'Điểm TB', value: kpi.avg_score },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white/10 backdrop-blur rounded-xl p-3 text-center">
                <div className="text-xl font-bold">{value}</div>
                <div className="text-blue-200 text-xs mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-8 space-y-8">
          {/* Section 1: KPI */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 bg-blue-600 text-white rounded-lg flex items-center justify-center text-xs font-bold">1</div>
              <h3 className="text-lg font-bold text-gray-900">Chỉ số tổng quan (KPI)</h3>
            </div>
            {kpi && (
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Nguy cơ cao (ML)', value: `${kpi.high_risk_count?.toLocaleString()} học sinh`, color: 'red', icon: AlertTriangle },
                  { label: 'Nguy cơ trung bình', value: `${kpi.medium_risk_count?.toLocaleString()} học sinh`, color: 'yellow', icon: AlertTriangle },
                  { label: 'Xuất sắc (A)', value: `${kpi.excellent_pct}%`, color: 'green', icon: CheckCircle },
                ].map(({ label, value, color, icon: Icon }) => (
                  <div key={label} className={`p-4 rounded-xl border-2 ${
                    color === 'red' ? 'border-red-200 bg-red-50' :
                    color === 'yellow' ? 'border-yellow-200 bg-yellow-50' :
                    'border-green-200 bg-green-50'
                  }`}>
                    <Icon className={`w-5 h-5 mb-2 ${
                      color === 'red' ? 'text-red-500' : color === 'yellow' ? 'text-yellow-500' : 'text-green-500'
                    }`} />
                    <div className="text-xl font-bold text-gray-900">{value}</div>
                    <div className="text-sm text-gray-600 mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Feature importance */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 bg-green-600 text-white rounded-lg flex items-center justify-center text-xs font-bold">2</div>
              <h3 className="text-lg font-bold text-gray-900">Yếu tố ảnh hưởng (Feature Importance)</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {fi.slice(0, 6).map((f, idx) => (
                <div key={f.feature} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <span className="w-6 h-6 bg-green-100 text-green-700 rounded-lg flex items-center justify-center text-xs font-bold">
                    {idx + 1}
                  </span>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-800">{featureLabels[f.feature] || f.feature}</div>
                    <div className="w-full h-1.5 bg-gray-200 rounded-full mt-1 overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full"
                        style={{ width: `${(f.importance / fi[0].importance * 100).toFixed(0)}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs font-bold text-gray-600">{(f.importance * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Anomalies */}
          {anomalies.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 bg-red-600 text-white rounded-lg flex items-center justify-center text-xs font-bold">3</div>
                <h3 className="text-lg font-bold text-gray-900">Phát hiện bất thường tự động</h3>
              </div>
              <div className="space-y-3">
                {anomalies.map((a, i) => (
                  <div key={i} className={`p-4 rounded-xl border ${a.severity === 'high' ? 'border-red-200 bg-red-50' : 'border-yellow-200 bg-yellow-50'}`}>
                    <div className="flex items-start gap-3">
                      <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${a.severity === 'high' ? 'text-red-500' : 'text-yellow-500'}`} />
                      <div>
                        <p className="text-sm text-gray-800 font-medium leading-relaxed">{a.description}</p>
                        <span className="text-xs text-gray-500">Ảnh hưởng: {a.affected_count?.toLocaleString()} học sinh</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 4: Recommendations */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 bg-purple-600 text-white rounded-lg flex items-center justify-center text-xs font-bold">4</div>
              <h3 className="text-lg font-bold text-gray-900">Khuyến nghị cho nhà trường</h3>
            </div>
            <div className="space-y-2">
              {[
                'Tập trung can thiệp học sinh có giờ tự học <3h/ngày — đây là yếu tố dự đoán nguy cơ mạnh nhất',
                'Theo dõi chặt chẽ học sinh có chuyên cần <65% — nhóm này có nguy cơ rớt hạng rất cao',
                'Xem xét lại chương trình "group study" — phương pháp này tương quan với điểm thấp hơn các phương pháp khác',
                'Cung cấp hỗ trợ đặc biệt cho học sinh thiếu internet và học sinh đi học xa (>60 phút)',
                'Tăng cường hỗ trợ học sinh có phụ huynh học vấn thấp — họ thiếu môi trường học tập tại nhà',
              ].map((rec, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-purple-50 rounded-xl">
                  <span className="text-purple-600 font-bold text-sm flex-shrink-0">✓</span>
                  <p className="text-sm text-gray-700 leading-relaxed">{rec}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
