import { useState } from 'react'
import axios from 'axios'
import { UserPlus, AlertTriangle, CheckCircle, Clock, Brain, Send, RotateCcw } from 'lucide-react'

const INITIAL_FORM = {
  study_hours: 4,
  attendance_percentage: 75,
  extra_activities: 'yes',
  study_method: 'notes',
  school_type: 'public',
  parent_education: 'high school',
  internet_access: 'yes',
  travel_time: '<30 min',
  age: 17,
  gender: 'male',
}

const FIELD_CONFIG = [
  {
    key: 'study_hours',
    label: 'Số giờ tự học / ngày',
    type: 'number',
    min: 0,
    max: 24,
    step: 0.5,
    unit: 'giờ/ngày',
    hint: 'Số giờ học sinh tự học mỗi ngày (0-24)',
  },
  {
    key: 'attendance_percentage',
    label: 'Tỷ lệ chuyên cần (%)',
    type: 'number',
    min: 0,
    max: 100,
    step: 1,
    unit: '%',
    hint: 'Tỷ lệ điểm danh trên lớp (0-100%)',
  },
  {
    key: 'age',
    label: 'Tuổi',
    type: 'number',
    min: 10,
    max: 30,
    step: 1,
    unit: 'tuổi',
    hint: 'Tuổi của học sinh (10-30)',
  },
  {
    key: 'gender',
    label: 'Giới tính',
    type: 'select',
    options: [
      { value: 'male', label: 'Nam' },
      { value: 'female', label: 'Nữ' },
      { value: 'other', label: 'Khác' },
    ],
  },
  {
    key: 'study_method',
    label: 'Phương pháp học',
    type: 'select',
    options: [
      { value: 'notes', label: 'Ghi chú (Notes)' },
      { value: 'textbook', label: 'Sách giáo khoa (Textbook)' },
      { value: 'group study', label: 'Học nhóm (Group Study)' },
      { value: 'coaching', label: 'Học thêm (Coaching)' },
      { value: 'mixed', label: 'Kết hợp (Mixed)' },
      { value: 'online videos', label: 'Video trực tuyến (Online Videos)' },
    ],
  },
  {
    key: 'school_type',
    label: 'Loại trường',
    type: 'select',
    options: [
      { value: 'public', label: 'Công lập (Public)' },
      { value: 'private', label: 'Tư thục (Private)' },
    ],
  },
  {
    key: 'parent_education',
    label: 'Học vấn phụ huynh',
    type: 'select',
    options: [
      { value: 'no formal', label: 'Không có bằng cấp' },
      { value: 'high school', label: 'Trung học phổ thông' },
      { value: 'bachelor', label: 'Cử nhân (Bachelor)' },
      { value: 'post graduate', label: 'Sau đại học (Post Graduate)' },
      { value: 'phd', label: 'Tiến sĩ (PhD)' },
    ],
  },
  {
    key: 'internet_access',
    label: 'Truy cập Internet',
    type: 'select',
    options: [
      { value: 'yes', label: 'Có' },
      { value: 'no', label: 'Không' },
    ],
  },
  {
    key: 'extra_activities',
    label: 'Hoạt động ngoại khóa',
    type: 'select',
    options: [
      { value: 'yes', label: 'Có tham gia' },
      { value: 'no', label: 'Không tham gia' },
    ],
  },
  {
    key: 'travel_time',
    label: 'Thời gian di chuyển đến trường',
    type: 'select',
    options: [
      { value: '<30 min', label: 'Dưới 30 phút' },
      { value: '30-60 min', label: '30-60 phút' },
      { value: '>60 min', label: 'Trên 60 phút' },
    ],
  },
]

const RISK_STYLES = {
  high: {
    bg: 'bg-red-50',
    border: 'border-red-300',
    text: 'text-red-700',
    icon: AlertTriangle,
    iconColor: 'text-red-500',
    barColor: 'bg-red-500',
    gradientFrom: 'from-red-500',
    gradientTo: 'to-red-600',
  },
  medium: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-300',
    text: 'text-yellow-700',
    icon: Clock,
    iconColor: 'text-yellow-500',
    barColor: 'bg-yellow-500',
    gradientFrom: 'from-yellow-500',
    gradientTo: 'to-yellow-600',
  },
  low: {
    bg: 'bg-green-50',
    border: 'border-green-300',
    text: 'text-green-700',
    icon: CheckCircle,
    iconColor: 'text-green-500',
    barColor: 'bg-green-500',
    gradientFrom: 'from-green-500',
    gradientTo: 'to-green-600',
  },
}

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
  gender: 'Giới tính',
}

export default function PredictTab() {
  const [form, setForm] = useState({ ...INITIAL_FORM })
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    // KHÔNG setResult(null) ở đây — giữ kết quả cũ trong lúc loading
    // để cột phải không bị thu nhỏ → không gây layout jump
    setLoading(true)
    setError('')
    try {
      const payload = {
        ...form,
        study_hours: parseFloat(form.study_hours),
        attendance_percentage: parseFloat(form.attendance_percentage),
        age: parseInt(form.age),
      }
      const res = await axios.post('/api/predict', payload)
      setResult(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Lỗi khi dự đoán. Hãy thử lại.')
    }
    setLoading(false)
  }

  const handleReset = () => {
    setForm({ ...INITIAL_FORM })
    setResult(null)
    setError('')
  }

  const riskStyle = result ? RISK_STYLES[result.risk_level] : null
  const RiskIcon = riskStyle?.icon

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Dự đoán nguy cơ học sinh (Tự nhập)</h2>
        <p className="text-gray-500 text-sm">
          Nhập thông tin học sinh để mô hình Random Forest dự đoán xác suất nguy cơ học yếu
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Form — sticky so it stays put when result column grows */}
        <div className="card lg:sticky lg:top-6">
          <div className="flex items-center gap-2 mb-5">
            <UserPlus className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-gray-800">Nhập thông tin học sinh</h3>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {FIELD_CONFIG.map((field) => (
              <div key={field.key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {field.label}
                  {field.hint && (
                    <span className="text-gray-400 font-normal ml-1 text-xs">({field.hint})</span>
                  )}
                </label>
                {field.type === 'number' ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={form[field.key]}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none transition-all bg-white"
                      required
                    />
                    {field.unit && (
                      <span className="text-xs text-gray-400 w-16">{field.unit}</span>
                    )}
                  </div>
                ) : (
                  <select
                    value={form[field.key]}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none transition-all bg-white"
                  >
                    {field.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                )}
              </div>
            ))}

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                ⚠️ {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-xl transition-colors shadow-md"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {loading ? 'Đang dự đoán...' : 'Dự đoán nguy cơ'}
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-3 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
            </div>
          </form>
        </div>

        {/* Result — minHeight cố định để không gây layout jump khi chưa có kết quả */}
        <div className="space-y-4" style={{ minHeight: 420 }}>
          {/* Empty state: chỉ hiện khi chưa có kết quả lần nào */}
          {!result && !loading && (
            <div className="card flex flex-col items-center justify-center min-h-[400px] text-center">
              <Brain className="w-16 h-16 text-gray-200 mb-4" />
              <h3 className="text-lg font-semibold text-gray-400 mb-2">Chưa có kết quả</h3>
              <p className="text-gray-400 text-sm max-w-xs">
                Nhập thông tin học sinh ở form bên trái và nhấn "Dự đoán nguy cơ" để xem kết quả từ mô hình ML
              </p>
            </div>
          )}

          {/* Spinner nhỏ khi loading lần đầu (chưa có result) */}
          {loading && !result && (
            <div className="card flex flex-col items-center justify-center min-h-[400px]">
              <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
              <p className="text-gray-600 font-medium">Đang phân tích và dự đoán...</p>
              <p className="text-gray-400 text-sm mt-1">Mô hình Random Forest đang xử lý</p>
            </div>
          )}

          {result && riskStyle && (
            <div className={`space-y-4 transition-opacity duration-200 ${loading ? 'opacity-60 pointer-events-none' : 'opacity-100'}`}>

              {/* Risk Result Card */}
              <div className={`card ${riskStyle.bg} border-2 ${riskStyle.border}`}>
                <div className="flex items-start gap-4">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${riskStyle.gradientFrom} ${riskStyle.gradientTo} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                    <RiskIcon className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className={`text-xl font-bold ${riskStyle.text} mb-1`}>
                      {result.risk_label}
                    </h3>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-3xl font-bold text-gray-900">
                        {result.risk_probability}%
                      </span>
                      <span className="text-sm text-gray-500">xác suất nguy cơ học yếu</span>
                    </div>
                    <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${riskStyle.barColor} rounded-full transition-all duration-1000 ease-out`}
                        style={{ width: `${result.risk_probability}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>0% (An toàn)</span>
                      <span>30%</span>
                      <span>60%</span>
                      <span>100% (Nguy cơ cao)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Model Info */}
              <div className="card bg-blue-50 border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <Brain className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-semibold text-blue-800">Thông tin mô hình</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-2 bg-white rounded-xl">
                    <div className="text-lg font-bold text-blue-700">{result.model_accuracy}%</div>
                    <div className="text-xs text-gray-500">Độ chính xác</div>
                  </div>
                  <div className="text-center p-2 bg-white rounded-xl">
                    <div className="text-lg font-bold text-blue-700">Random Forest</div>
                    <div className="text-xs text-gray-500">Thuật toán</div>
                  </div>
                </div>
              </div>

              {/* Interventions */}
              <div className="card">
                <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Khuyến nghị can thiệp ({result.interventions?.length || 0})
                </h4>
                <div className="space-y-2">
                  {(result.interventions || []).map((tip, i) => (
                    <div key={i} className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100">
                      <span className="text-amber-500 font-bold flex-shrink-0 mt-0.5">→</span>
                      <span className="text-sm text-gray-700 leading-relaxed">{tip}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Feature Contributions */}
              {result.feature_contributions && result.feature_contributions.length > 0 && (
                <div className="card">
                  <h4 className="font-bold text-gray-800 mb-1">Mức độ ảnh hưởng thực tế</h4>
                  <p className="text-xs text-gray-400 mb-4">
                    Tính dựa trên giá trị nhập so với phân phối toàn bộ dữ liệu — <span className="text-red-500 font-medium">đỏ</span> = đang ở vùng nguy cơ cao, <span className="text-green-600 font-medium">xanh</span> = an toàn
                  </p>
                  <div className="space-y-3">
                    {result.feature_contributions.map((fc) => {
                      const barPct = Math.round(fc.risk_score * 100)
                      const barColor =
                        fc.risk_level === 'high'   ? 'bg-red-500' :
                        fc.risk_level === 'medium' ? 'bg-yellow-400' :
                                                     'bg-green-500'
                      const textColor =
                        fc.risk_level === 'high'   ? 'text-red-600' :
                        fc.risk_level === 'medium' ? 'text-yellow-600' :
                                                     'text-green-600'
                      const bgColor =
                        fc.risk_level === 'high'   ? 'bg-red-50' :
                        fc.risk_level === 'medium' ? 'bg-yellow-50' :
                                                     'bg-green-50'
                      const badge =
                        fc.risk_level === 'high'   ? '⚠ Nguy cơ cao' :
                        fc.risk_level === 'medium' ? '~ Trung bình' :
                                                     '✓ An toàn'
                      return (
                        <div key={fc.feature} className={`rounded-xl p-3 ${bgColor}`}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm font-semibold text-gray-700">
                              {featureLabels[fc.feature] || fc.feature}
                            </span>
                            <span className={`text-xs font-bold ${textColor}`}>{badge}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${barColor} rounded-full transition-all duration-700`}
                                style={{ width: `${barPct}%` }}
                              />
                            </div>
                            <span className={`text-xs font-bold w-8 text-right ${textColor}`}>
                              {barPct}%
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1.5 leading-snug">{fc.context}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Input Summary */}
              <div className="card">
                <h4 className="font-bold text-gray-800 mb-3">Thông tin đã nhập</h4>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(result.input_summary || {}).map(([key, val]) => (
                    <div key={key} className="flex justify-between p-2 bg-gray-50 rounded-lg text-xs">
                      <span className="text-gray-500">{featureLabels[key] || key}</span>
                      <span className="font-semibold text-gray-800">{String(val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Explanation */}
      <div className="card bg-indigo-50 border-indigo-200">
        <div className="flex gap-3">
          <Brain className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-indigo-900 mb-2">Hướng dẫn sử dụng</h4>
            <div className="text-indigo-800 text-sm leading-relaxed space-y-1">
              <p><strong>Bước 1:</strong> Nhập đầy đủ thông tin học sinh vào form bên trái</p>
              <p><strong>Bước 2:</strong> Nhấn "Dự đoán nguy cơ" để mô hình ML phân tích</p>
              <p><strong>Bước 3:</strong> Xem kết quả dự đoán, mức độ nguy cơ, và khuyến nghị can thiệp</p>
              <p className="text-indigo-600 mt-2">
                <strong>Lưu ý:</strong> Mô hình cần được train trước bằng cách upload file CSV ở trang chính.
                Sau khi upload, bạn có thể sử dụng tính năng dự đoán tự nhập này.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
