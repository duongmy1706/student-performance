import { useEffect, useState } from 'react'
import axios from 'axios'
import { Brain, TrendingUp, AlertTriangle } from 'lucide-react'

export default function MLTab() {
  const [fi, setFi] = useState([])
  const [charts, setCharts] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [fiRes, chartFI, chartRisk, chartAttend] = await Promise.all([
          axios.get('/api/feature-importance'),
          axios.get('/api/charts/feature-importance'),
          axios.get('/api/charts/risk-distribution'),
          axios.get('/api/charts/attendance-risk'),
        ])
        setFi(fiRes.data.feature_importance)
        setCharts({
          fi: chartFI.data.image,
          risk: chartRisk.data.image,
          attend: chartAttend.data.image,
        })
      } catch (e) {}
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="flex justify-center items-center h-64"><div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>

  const featureLabels = {
    study_hours: 'Giờ tự học',
    attendance_percentage: 'Chuyên cần (%)',
    study_method: 'Phương pháp học',
    school_type: 'Loại trường',
    parent_education: 'Học vấn phụ huynh',
    internet_access: 'Truy cập Internet',
    travel_time: 'Thời gian di chuyển',
    extra_activities: 'Hoạt động ngoại khóa',
    age: 'Tuổi',
    gender: 'Giới tính'
  }

  const maxFI = fi[0]?.importance || 1
  const chartData = fi.map(f => ({
    feature: featureLabels[f.feature] || f.feature,
    importance: f.importance,
    pct: Math.round(f.importance / maxFI * 100)
  }))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Phân tích Machine Learning</h2>
        <p className="text-gray-500 text-sm">Random Forest Classifier — Dự đoán nguy cơ học yếu từ yếu tố hành vi</p>
      </div>

      {/* Model info cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center border-blue-100">
          <div className="text-3xl font-bold text-blue-600 mb-1">RandomForest</div>
          <div className="text-sm text-gray-500">Thuật toán ML</div>
        </div>
        <div className="card text-center border-green-100">
          <div className="text-3xl font-bold text-green-600 mb-1">100</div>
          <div className="text-sm text-gray-500">Số cây quyết định</div>
        </div>
        <div className="card text-center border-purple-100">
          <div className="text-3xl font-bold text-purple-600 mb-1">E + F</div>
          <div className="text-sm text-gray-500">Nhãn "nguy cơ"</div>
        </div>
      </div>

      {/* Feature importance */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          <h3 className="font-bold text-gray-800">Tầm quan trọng của từng yếu tố — Feature Importance</h3>
        </div>
        <p className="text-sm text-gray-500 mb-5">
          Mô hình Random Forest học từ dữ liệu thực để xác định yếu tố nào quan trọng nhất trong việc dự đoán học sinh có bị rớt hạng hay không.
        </p>
        <div className="space-y-3">
          {chartData.map((item, idx) => (
            <div key={item.feature} className="flex items-center gap-3">
              <div className="w-40 text-sm text-gray-700 text-right flex-shrink-0 font-medium">
                {item.feature}
              </div>
              <div className="flex-1 h-8 bg-gray-100 rounded-lg overflow-hidden">
                <div
                  className="h-full rounded-lg flex items-center pl-2 transition-all duration-500"
                  style={{
                    width: `${item.pct}%`,
                    background: `hsl(${220 - idx * 20}, 80%, ${55 + idx * 2}%)`
                  }}
                >
                  <span className="text-white text-xs font-semibold">{item.importance.toFixed(4)}</span>
                </div>
              </div>
              <div className="w-12 text-xs text-gray-500 text-right">
                {(item.importance * 100).toFixed(1)}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {charts.risk && (
          <div className="card">
            <h3 className="font-semibold text-gray-800 mb-3">Phân bố mức độ nguy cơ (xác suất ML)</h3>
            <img src={`data:image/png;base64,${charts.risk}`} alt="Phân bố nguy cơ" className="w-full rounded-lg" />
          </div>
        )}
        {charts.attend && (
          <div className="card">
            <h3 className="font-semibold text-gray-800 mb-3">Chuyên cần vs Nguy cơ</h3>
            <img src={`data:image/png;base64,${charts.attend}`} alt="Chuyên cần và nguy cơ" className="w-full rounded-lg" />
          </div>
        )}
      </div>

      {charts.fi && (
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-3">Biểu đồ Feature Importance (matplotlib/seaborn)</h3>
          <img src={`data:image/png;base64,${charts.fi}`} alt="Biểu đồ Feature Importance" className="w-full rounded-lg" />
        </div>
      )}

      {/* Explanation */}
      <div className="card bg-amber-50 border-amber-200">
        <div className="flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-amber-900 mb-2">Giải thích phương pháp</h4>
            <p className="text-amber-800 text-sm leading-relaxed">
              <strong>Đầu vào của mô hình</strong>: Các yếu tố hành vi và nhân khẩu học — KHÔNG dùng điểm số (math_score, science_score) làm đầu vào.<br/>
              <strong>Đầu ra</strong>: Xác suất học sinh rơi vào nhóm E hoặc F (học yếu).<br/>
              <strong>Phân loại</strong>: Nguy cơ cao (≥60%), trung bình (30-60%), thấp (&lt;30%).<br/>
              Đây là mô hình dự đoán sớm — giúp giảng viên can thiệp trước khi kết quả học tập sụt giảm.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
