import os
import io
import base64
import json
import warnings
import asyncio
import httpx
import re
warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage
from reportlab.lib.units import cm
import tempfile

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

app = FastAPI(title="Student Performance ML API", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FEATURE_COLS = [
    "study_hours", "attendance_percentage", "extra_activities",
    "study_method", "school_type", "parent_education",
    "internet_access", "travel_time", "age", "gender"
]
CATEGORICAL_COLS = [
    "extra_activities", "study_method", "school_type",
    "parent_education", "internet_access", "travel_time", "gender"
]

model_state = {
    "model": None,
    "encoders": {},
    "df": None,
    "feature_importance": [],
    "accuracy": 0,
    "trained": False
}


def load_and_preprocess(df: pd.DataFrame):
    df = df.copy()
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
    df["final_grade"] = df["final_grade"].str.strip().str.lower()
    df["is_at_risk"] = df["final_grade"].isin(["e", "f"]).astype(int)
    return df


def train_model(df: pd.DataFrame):
    encoders = {}
    df_enc = df.copy()
    for col in CATEGORICAL_COLS:
        if col in df_enc.columns:
            le = LabelEncoder()
            df_enc[col] = le.fit_transform(df_enc[col].astype(str))
            encoders[col] = le

    valid_features = [c for c in FEATURE_COLS if c in df_enc.columns]
    X = df_enc[valid_features]
    y = df_enc["is_at_risk"]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    rf = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42, n_jobs=-1)
    rf.fit(X_train, y_train)

    y_pred = rf.predict(X_test)
    acc = accuracy_score(y_test, y_pred)

    importance = [
        {"feature": feat, "importance": float(imp)}
        for feat, imp in zip(valid_features, rf.feature_importances_)
    ]
    importance.sort(key=lambda x: x["importance"], reverse=True)

    return rf, encoders, acc, importance, valid_features


def predict_students(df: pd.DataFrame, model, encoders, valid_features):
    df_enc = df.copy()
    for col in CATEGORICAL_COLS:
        if col in df_enc.columns and col in encoders:
            le = encoders[col]
            df_enc[col] = df_enc[col].astype(str).apply(
                lambda x: le.transform([x])[0] if x in le.classes_ else 0
            )
    X = df_enc[valid_features]
    proba = model.predict_proba(X)[:, 1]
    return proba


def generate_interventions(row: dict) -> list:
    tips = []
    if float(row.get("study_hours", 5)) < 3:
        tips.append("Cần tăng thời gian tự học lên ít nhất 4h/ngày")
    elif float(row.get("study_hours", 5)) < 5:
        tips.append("Nên tăng thêm 1-2h tự học mỗi ngày")

    if float(row.get("attendance_percentage", 80)) < 65:
        tips.append("Cần cải thiện chuyên cần — tỷ lệ điểm danh dưới 65% ảnh hưởng nghiêm trọng đến kết quả")
    elif float(row.get("attendance_percentage", 80)) < 75:
        tips.append("Nên cải thiện chuyên cần — cố gắng đạt trên 80%")

    method = str(row.get("study_method", "")).lower()
    if method == "group study":
        tips.append("Phương pháp group study chưa hiệu quả — thử chuyển sang online videos hoặc coaching")
    elif method == "notes":
        tips.append("Bổ sung thêm phương pháp học qua video giảng dạy để nâng cao hiệu quả")

    if str(row.get("internet_access", "yes")).lower() == "no":
        tips.append("Không có internet — cần tiếp cận tài liệu offline hoặc đến thư viện")

    edu = str(row.get("parent_education", "")).lower()
    if edu in ["no formal", "high school"]:
        tips.append("Nền tảng giáo dục gia đình thấp — cần hỗ trợ từ nhà trường nhiều hơn")

    travel = str(row.get("travel_time", "")).lower()
    if travel == ">60 min":
        tips.append("Thời gian di chuyển quá dài (>60 phút) — xem xét ký túc xá hoặc lịch học linh hoạt")

    if str(row.get("extra_activities", "yes")).lower() == "no":
        tips.append("Tham gia thêm hoạt động ngoại khóa để phát triển toàn diện và giảm stress")

    if not tips:
        tips.append("Học sinh có profile tốt — duy trì và phát huy")

    return tips


def fig_to_base64(fig) -> str:
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=150, bbox_inches="tight")
    buf.seek(0)
    img_base64 = base64.b64encode(buf.read()).decode("utf-8")
    plt.close(fig)
    return img_base64


@app.post("/api/upload")
async def upload_csv(file: UploadFile = File(...)):
    try:
        content = await file.read()
        df = pd.read_csv(io.BytesIO(content))
        df = load_and_preprocess(df)
        model_state["df"] = df

        rf, encoders, acc, importance, valid_features = train_model(df)
        model_state["model"] = rf
        model_state["encoders"] = encoders
        model_state["accuracy"] = acc
        model_state["feature_importance"] = importance
        model_state["valid_features"] = valid_features
        model_state["trained"] = True

        risk_proba = predict_students(df, rf, encoders, valid_features)
        df["risk_probability"] = risk_proba
        df["risk_level"] = pd.cut(risk_proba, bins=[0, 0.3, 0.6, 1.0], labels=["low", "medium", "high"])
        model_state["df"] = df

        return {
            "success": True,
            "total_students": len(df),
            "model_accuracy": round(acc * 100, 2),
            "at_risk_count": int(df["is_at_risk"].sum()),
            "high_risk_count": int((df["risk_level"] == "high").sum()),
            "columns": df.columns.tolist()
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/kpi")
def get_kpi():
    if not model_state["trained"]:
        raise HTTPException(status_code=400, detail="No data loaded")
    df = model_state["df"]
    return {
        "total_students": len(df),
        "avg_score": round(float(df["overall_score"].mean()), 2) if "overall_score" in df.columns else 0,
        "at_risk_pct": round(float(df["is_at_risk"].mean() * 100), 2),
        "high_risk_count": int((df["risk_level"] == "high").sum()),
        "medium_risk_count": int((df["risk_level"] == "medium").sum()),
        "low_risk_count": int((df["risk_level"] == "low").sum()),
        "excellent_pct": round(float((df["final_grade"] == "a").mean() * 100), 2) if "final_grade" in df.columns else 0,
        "model_accuracy": round(model_state["accuracy"] * 100, 2),
        "grade_distribution": df["final_grade"].value_counts().to_dict() if "final_grade" in df.columns else {}
    }


@app.get("/api/students")
def get_students(
    risk: str = None,
    gender: str = None,
    school_type: str = None,
    study_method: str = None,
    sort_by: str = "risk_probability",
    order: str = "desc",
    page: int = 1,
    page_size: int = 20
):
    if not model_state["trained"]:
        raise HTTPException(status_code=400, detail="No data loaded")
    df = model_state["df"].copy()

    if risk:
        df = df[df["risk_level"] == risk]
    if gender:
        df = df[df["gender"] == gender]
    if school_type:
        df = df[df["school_type"] == school_type]
    if study_method:
        df = df[df["study_method"] == study_method]

    if sort_by in df.columns:
        df = df.sort_values(sort_by, ascending=(order == "asc"))

    total = len(df)
    df_page = df.iloc[(page - 1) * page_size: page * page_size]

    students = []
    for _, row in df_page.iterrows():
        student = {k: v for k, v in row.items()}
        for k, v in student.items():
            if hasattr(v, 'item'):
                student[k] = v.item()
        student["interventions"] = generate_interventions(student)
        students.append(student)

    return {
        "students": students,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size
    }


@app.get("/api/feature-importance")
def get_feature_importance():
    if not model_state["trained"]:
        raise HTTPException(status_code=400, detail="No data loaded")
    return {"feature_importance": model_state["feature_importance"]}


@app.get("/api/charts/feature-importance")
def chart_feature_importance():
    if not model_state["trained"]:
        raise HTTPException(status_code=400, detail="No data loaded")
    fi = model_state["feature_importance"]
    features = [x["feature"] for x in fi]
    importances = [x["importance"] for x in fi]

    fig, ax = plt.subplots(figsize=(9, 5))
    colors_bar = sns.color_palette("RdYlGn_r", len(features))
    bars = ax.barh(features[::-1], importances[::-1], color=colors_bar[::-1])
    ax.set_xlabel("Feature Importance", fontsize=11)
    ax.set_title("Tam quan trong cua cac yeu to du doan nguy co hoc yeu\n(Random Forest)", fontsize=12, fontweight="bold")
    for bar, val in zip(bars, importances[::-1]):
        ax.text(bar.get_width() + 0.001, bar.get_y() + bar.get_height() / 2,
                f'{val:.3f}', va='center', fontsize=9)
    plt.tight_layout()
    return {"image": fig_to_base64(fig)}


@app.get("/api/charts/risk-distribution")
def chart_risk_distribution():
    if not model_state["trained"]:
        raise HTTPException(status_code=400, detail="No data loaded")
    df = model_state["df"]
    counts = df["risk_level"].value_counts()
    labels = {"high": "Nguy co cao", "medium": "Nguy co TB", "low": "An toan"}
    col_map = {"high": "#e74c3c", "medium": "#f39c12", "low": "#2ecc71"}

    fig, ax = plt.subplots(figsize=(7, 5))
    data = {labels[k]: counts.get(k, 0) for k in ["high", "medium", "low"]}
    clrs = [col_map[k] for k in ["high", "medium", "low"]]
    wedges, texts, autotexts = ax.pie(
        data.values(), labels=data.keys(), colors=clrs,
        autopct="%1.1f%%", startangle=90, pctdistance=0.8
    )
    for at in autotexts:
        at.set_fontsize(10)
    ax.set_title("Phan bo muc do nguy co hoc sinh\n(Du doan boi Random Forest)", fontsize=12, fontweight="bold")
    plt.tight_layout()
    return {"image": fig_to_base64(fig)}


@app.get("/api/charts/group-compare")
def chart_group_compare(group_by: str = "gender"):
    if not model_state["trained"]:
        raise HTTPException(status_code=400, detail="No data loaded")
    df = model_state["df"]
    if group_by not in df.columns:
        raise HTTPException(status_code=400, detail=f"Column {group_by} not found")

    fig, axes = plt.subplots(1, 2, figsize=(13, 5))
    group_labels = {
        "gender": "Gioi tinh", "school_type": "Loai truong",
        "study_method": "Phuong phap hoc", "internet_access": "Truy cap Internet",
        "parent_education": "Hoc van phu huynh"
    }
    title_label = group_labels.get(group_by, group_by)

    risk_data = df.groupby(group_by)["is_at_risk"].mean() * 100
    colors1 = sns.color_palette("Reds", len(risk_data))
    axes[0].bar(risk_data.index, risk_data.values, color=colors1)
    axes[0].set_title(f"% Nguy co hoc yeu theo {title_label}", fontsize=11, fontweight="bold")
    axes[0].set_ylabel("% Hoc sinh nguy co cao")
    for i, v in enumerate(risk_data.values):
        axes[0].text(i, v + 0.5, f"{v:.1f}%", ha="center", fontsize=9)
    axes[0].tick_params(axis='x', rotation=20)

    if "overall_score" in df.columns:
        score_data = df.groupby(group_by)["overall_score"].mean()
        colors2 = sns.color_palette("Blues", len(score_data))
        axes[1].bar(score_data.index, score_data.values, color=colors2)
        axes[1].set_title(f"Diem trung binh theo {title_label}", fontsize=11, fontweight="bold")
        axes[1].set_ylabel("Diem trung binh")
        for i, v in enumerate(score_data.values):
            axes[1].text(i, v + 0.3, f"{v:.1f}", ha="center", fontsize=9)
        axes[1].tick_params(axis='x', rotation=20)

    plt.tight_layout()
    return {"image": fig_to_base64(fig)}


@app.get("/api/charts/score-distribution")
def chart_score_distribution():
    if not model_state["trained"]:
        raise HTTPException(status_code=400, detail="No data loaded")
    df = model_state["df"]

    fig, axes = plt.subplots(1, 2, figsize=(13, 5))

    if "overall_score" in df.columns:
        axes[0].hist(df["overall_score"], bins=30, color="#3498db", alpha=0.7, edgecolor="white")
        axes[0].set_title("Phan bo diem tong the", fontsize=11, fontweight="bold")
        axes[0].set_xlabel("Diem")
        axes[0].set_ylabel("So hoc sinh")
        axes[0].axvline(df["overall_score"].mean(), color="red", linestyle="--", label=f'TB: {df["overall_score"].mean():.1f}')
        axes[0].legend()

    if "final_grade" in df.columns:
        grade_counts = df["final_grade"].value_counts().sort_index()
        grade_colors = {"a": "#2ecc71", "b": "#27ae60", "c": "#f39c12", "d": "#e67e22", "e": "#e74c3c", "f": "#c0392b"}
        clrs = [grade_colors.get(g, "#999") for g in grade_counts.index]
        axes[1].bar(grade_counts.index.str.upper(), grade_counts.values, color=clrs)
        axes[1].set_title("Phan bo xep loai hoc tap", fontsize=11, fontweight="bold")
        axes[1].set_xlabel("Xep loai")
        axes[1].set_ylabel("So hoc sinh")
        for i, v in enumerate(grade_counts.values):
            axes[1].text(i, v + 30, str(v), ha="center", fontsize=9)

    plt.tight_layout()
    return {"image": fig_to_base64(fig)}


@app.get("/api/charts/study-method-analysis")
def chart_study_method():
    if not model_state["trained"]:
        raise HTTPException(status_code=400, detail="No data loaded")
    df = model_state["df"]

    fig, ax = plt.subplots(figsize=(10, 5))
    pivot = df.groupby("study_method")["is_at_risk"].mean() * 100
    pivot_score = df.groupby("study_method")["overall_score"].mean() if "overall_score" in df.columns else None

    x = np.arange(len(pivot))
    width = 0.35
    bars1 = ax.bar(x - width / 2, pivot.values, width, label="% Nguy co", color="#e74c3c", alpha=0.8)
    if pivot_score is not None:
        ax2 = ax.twinx()
        bars2 = ax2.bar(x + width / 2, pivot_score.values, width, label="Diem TB", color="#3498db", alpha=0.8)
        ax2.set_ylabel("Diem trung binh", color="#3498db")
        ax2.legend(loc="upper right")

    ax.set_xticks(x)
    ax.set_xticklabels(pivot.index, rotation=20)
    ax.set_ylabel("% Hoc sinh nguy co", color="#e74c3c")
    ax.set_title("Phan tich theo phuong phap hoc\n(Nguy co vs Diem TB)", fontsize=12, fontweight="bold")
    ax.legend(loc="upper left")
    plt.tight_layout()
    return {"image": fig_to_base64(fig)}


@app.get("/api/charts/attendance-risk")
def chart_attendance_risk():
    if not model_state["trained"]:
        raise HTTPException(status_code=400, detail="No data loaded")
    df = model_state["df"]

    fig, ax = plt.subplots(figsize=(10, 5))
    bins = [0, 50, 60, 70, 80, 90, 100]
    labels_bin = ["<50%", "50-60%", "60-70%", "70-80%", "80-90%", ">90%"]
    df["attendance_bin"] = pd.cut(df["attendance_percentage"], bins=bins, labels=labels_bin)
    pivot = df.groupby("attendance_bin", observed=True)["is_at_risk"].mean() * 100

    colors_bar = ["#c0392b", "#e74c3c", "#e67e22", "#f39c12", "#2ecc71", "#27ae60"]
    ax.bar(pivot.index, pivot.values, color=colors_bar)
    ax.set_xlabel("Ty le chuyen can", fontsize=11)
    ax.set_ylabel("% Hoc sinh nguy co cao", fontsize=11)
    ax.set_title("Anh huong cua chuyen can den nguy co hoc yeu", fontsize=12, fontweight="bold")
    for i, v in enumerate(pivot.values):
        ax.text(i, v + 0.3, f"{v:.1f}%", ha="center", fontsize=9)
    plt.tight_layout()
    return {"image": fig_to_base64(fig)}


@app.get("/api/anomalies")
def detect_anomalies():
    if not model_state["trained"]:
        raise HTTPException(status_code=400, detail="No data loaded")
    df = model_state["df"]
    anomalies = []

    if "study_method" in df.columns and "overall_score" in df.columns:
        for method in df["study_method"].unique():
            subset = df[df["study_method"] == method]
            avg_score = subset["overall_score"].mean()
            risk_pct = subset["is_at_risk"].mean() * 100
            if avg_score < df["overall_score"].quantile(0.4) and len(subset) > 50:
                anomalies.append({
                    "type": "study_method_low",
                    "description": f"Nhom '{method}' co diem TB thap ({avg_score:.1f}) du chiem {len(subset)} hoc sinh ({risk_pct:.1f}% nguy co)",
                    "severity": "high" if risk_pct > 30 else "medium",
                    "affected_count": len(subset)
                })

    if "internet_access" in df.columns:
        no_internet = df[df["internet_access"] == "no"]
        yes_internet = df[df["internet_access"] == "yes"]
        diff = no_internet["is_at_risk"].mean() - yes_internet["is_at_risk"].mean()
        if diff > 0.05:
            anomalies.append({
                "type": "internet_gap",
                "description": f"Hoc sinh khong co internet co nguy co cao hon {diff * 100:.1f}% so voi nhom co internet",
                "severity": "high" if diff > 0.1 else "medium",
                "affected_count": int(no_internet["is_at_risk"].sum())
            })

    if "parent_education" in df.columns:
        low_edu = df[df["parent_education"].isin(["no formal", "high school"])]
        high_edu = df[df["parent_education"].isin(["phd", "post graduate"])]
        if len(low_edu) > 0 and len(high_edu) > 0:
            diff = low_edu["is_at_risk"].mean() - high_edu["is_at_risk"].mean()
            if diff > 0.05:
                anomalies.append({
                    "type": "parent_education_gap",
                    "description": f"Nhom phu huynh hoc van thap co nguy co cao hon {diff * 100:.1f}% so voi nhom phu huynh co hoc van cao",
                    "severity": "medium",
                    "affected_count": int(low_edu["is_at_risk"].sum())
                })

    if "school_type" in df.columns:
        for stype in df["school_type"].unique():
            subset = df[df["school_type"] == stype]
            risk = subset["is_at_risk"].mean() * 100
            if risk > 25:
                anomalies.append({
                    "type": "school_type_risk",
                    "description": f"Truong '{stype}' co ty le nguy co cao: {risk:.1f}%",
                    "severity": "high" if risk > 35 else "medium",
                    "affected_count": int(subset["is_at_risk"].sum())
                })

    if "travel_time" in df.columns:
        long_travel = df[df["travel_time"] == ">60 min"]
        if len(long_travel) > 0:
            risk = long_travel["is_at_risk"].mean() * 100
            if risk > 25:
                anomalies.append({
                    "type": "long_travel",
                    "description": f"Hoc sinh di hoc xa (>60 phut) co nguy co {risk:.1f}% — can can thiep ve dieu kien hoc tap",
                    "severity": "medium",
                    "affected_count": int(long_travel["is_at_risk"].sum())
                })

    return {"anomalies": anomalies}


@app.get("/api/report/pdf")
def generate_pdf():
    if not model_state["trained"]:
        raise HTTPException(status_code=400, detail="No data loaded")
    df = model_state["df"]
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=2*cm, bottomMargin=2*cm)
    styles = getSampleStyleSheet()
    story = []

    title_style = ParagraphStyle("Title", parent=styles["Title"], fontSize=18, textColor=colors.HexColor("#2c3e50"), spaceAfter=10)
    h2_style = ParagraphStyle("H2", parent=styles["Heading2"], fontSize=13, textColor=colors.HexColor("#3498db"), spaceAfter=6)
    body_style = ParagraphStyle("Body", parent=styles["Normal"], fontSize=10, leading=16)
    warn_style = ParagraphStyle("Warn", parent=styles["Normal"], fontSize=10, textColor=colors.HexColor("#e74c3c"), leading=16)

    story.append(Paragraph("BAO CAO PHAN TICH HIEU SUAT HOC SINH", title_style))
    story.append(Paragraph("He thong AI ho tro giang vien - Machine Learning Edition", body_style))
    story.append(Spacer(1, 0.5*cm))

    story.append(Paragraph("1. Tong quan du lieu", h2_style))
    kpi_data = [
        ["Chi so", "Gia tri"],
        ["Tong hoc sinh", str(len(df))],
        ["Do chinh xac mo hinh ML", f"{model_state['accuracy'] * 100:.2f}%"],
        ["Hoc sinh nguy co cao", f"{(df['risk_level'] == 'high').sum()} ({(df['risk_level'] == 'high').mean() * 100:.1f}%)"],
        ["Hoc sinh nguy co TB", f"{(df['risk_level'] == 'medium').sum()} ({(df['risk_level'] == 'medium').mean() * 100:.1f}%)"],
        ["Diem trung binh", f"{df['overall_score'].mean():.2f}"] if "overall_score" in df.columns else ["Diem TB", "N/A"],
        ["Hoc sinh xep loai A", f"{(df['final_grade'] == 'a').sum()} ({(df['final_grade'] == 'a').mean() * 100:.1f}%)"] if "final_grade" in df.columns else ["Xuat sac", "N/A"]
    ]
    t = Table(kpi_data, colWidths=[8*cm, 8*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#3498db")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#f8f9fa"), colors.white]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#dee2e6")),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.5*cm))

    story.append(Paragraph("2. Tam quan trong cua cac yeu to (Feature Importance)", h2_style))
    fi = model_state["feature_importance"]
    fi_data = [["Yeu to", "Muc do anh huong"]] + [[x["feature"], f"{x['importance']:.4f}"] for x in fi[:8]]
    t2 = Table(fi_data, colWidths=[8*cm, 8*cm])
    t2.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2ecc71")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#f8f9fa"), colors.white]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#dee2e6")),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(t2)
    story.append(Spacer(1, 0.5*cm))

    story.append(Paragraph("3. Top hoc sinh can can thiep ngay", h2_style))
    high_risk = df[df["risk_level"] == "high"].nlargest(10, "risk_probability")
    if len(high_risk) > 0:
        cols_show = ["student_id", "gender", "study_hours", "attendance_percentage", "risk_probability"]
        cols_show = [c for c in cols_show if c in high_risk.columns]
        hr_data = [cols_show]
        for _, row in high_risk.iterrows():
            hr_data.append([str(round(row[c], 2) if isinstance(row[c], float) else row[c]) for c in cols_show])
        t3 = Table(hr_data, colWidths=[16*cm / len(cols_show)] * len(cols_show))
        t3.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e74c3c")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#fff5f5"), colors.white]),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#dee2e6")),
            ("PADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(t3)
    story.append(Spacer(1, 0.5*cm))

    anomalies_resp = detect_anomalies()
    if anomalies_resp["anomalies"]:
        story.append(Paragraph("4. Phat hien bat thuong tu dong", h2_style))
        for a in anomalies_resp["anomalies"]:
            story.append(Paragraph(f"* {a['description']}", warn_style if a["severity"] == "high" else body_style))
        story.append(Spacer(1, 0.3*cm))

    doc.build(story)
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/pdf",
                             headers={"Content-Disposition": "attachment; filename=student_report.pdf"})


class PredictRequest(BaseModel):
    study_hours: float
    attendance_percentage: float
    extra_activities: str
    study_method: str
    school_type: str
    parent_education: str
    internet_access: str
    travel_time: str
    age: int
    gender: str


@app.post("/api/predict")
def predict_single(req: PredictRequest):
    if not model_state["trained"]:
        raise HTTPException(status_code=400, detail="Model chua duoc train. Hay upload CSV truoc.")

    model = model_state["model"]
    encoders = model_state["encoders"]
    valid_features = model_state["valid_features"]

    input_data = {
        "study_hours": req.study_hours,
        "attendance_percentage": req.attendance_percentage,
        "extra_activities": req.extra_activities,
        "study_method": req.study_method,
        "school_type": req.school_type,
        "parent_education": req.parent_education,
        "internet_access": req.internet_access,
        "travel_time": req.travel_time,
        "age": req.age,
        "gender": req.gender,
    }

    df_input = pd.DataFrame([input_data])

    df_enc = df_input.copy()
    for col in CATEGORICAL_COLS:
        if col in df_enc.columns and col in encoders:
            le = encoders[col]
            df_enc[col] = df_enc[col].astype(str).apply(
                lambda x: le.transform([x])[0] if x in le.classes_ else 0
            )

    X = df_enc[valid_features]
    proba = model.predict_proba(X)[0]
    risk_prob = float(proba[1])
    prediction = int(model.predict(X)[0])

    if risk_prob >= 0.6:
        risk_level = "high"
        risk_label = "Nguy co cao"
    elif risk_prob >= 0.3:
        risk_level = "medium"
        risk_label = "Nguy co trung binh"
    else:
        risk_level = "low"
        risk_label = "An toan"

    interventions = generate_interventions(input_data)

    # Tính risk contribution thực: so sánh giá trị nhập với phân phối trong data
    # risk_score = 0.0 (an toàn) → 1.0 (nguy cơ cao), dựa trên data thực
    df_ref = model_state["df"]
    fi = model_state["feature_importance"]
    fi_map = {x["feature"]: x["importance"] for x in fi}

    feature_contributions = []
    for feat in valid_features:
        val = input_data.get(feat, None)
        importance = fi_map.get(feat, 0.0)

        if feat in CATEGORICAL_COLS:
            # Tính tỉ lệ nguy cơ của nhóm này trong data thực
            if feat in df_ref.columns and val is not None:
                group = df_ref[df_ref[feat].astype(str).str.lower() == str(val).lower()]
                if len(group) > 0:
                    group_risk = float(group["is_at_risk"].mean())
                else:
                    group_risk = float(df_ref["is_at_risk"].mean())
                baseline_risk = float(df_ref["is_at_risk"].mean())
                # risk_score: 0 = thấp hơn baseline, 1 = cao nhất trong các nhóm
                all_group_risks = df_ref.groupby(feat)["is_at_risk"].mean()
                min_r, max_r = float(all_group_risks.min()), float(all_group_risks.max())
                risk_score = (group_risk - min_r) / (max_r - min_r + 1e-9)
                context = f"{round(group_risk * 100, 1)}% nguy cơ trong nhóm này (baseline: {round(baseline_risk * 100, 1)}%)"
            else:
                risk_score = 0.5
                context = "Không có dữ liệu tham chiếu"
        else:
            # Numeric: dùng percentile để tính nguy cơ tương đối
            if feat in df_ref.columns and val is not None:
                try:
                    val_f = float(val)
                    col_data = df_ref[feat].dropna()

                    # Tính tương quan: feature này tăng thì nguy cơ tăng hay giảm?
                    corr = float(df_ref[[feat, "is_at_risk"]].corr().iloc[0, 1])

                    # Percentile của giá trị này trong toàn bộ data
                    pct = float((col_data < val_f).mean())  # 0→1

                    # Nếu tương quan âm (vd study_hours cao → nguy cơ thấp): đảo ngược
                    if corr < 0:
                        risk_score = 1.0 - pct
                    else:
                        risk_score = pct

                    # Context: so với trung bình
                    mean_val = float(col_data.mean())
                    diff_pct = ((val_f - mean_val) / (mean_val + 1e-9)) * 100
                    direction = "cao hơn" if val_f > mean_val else "thấp hơn"
                    context = f"{val_f} ({abs(diff_pct):.0f}% {direction} trung bình {mean_val:.1f})"
                except Exception:
                    risk_score = 0.5
                    context = str(val)
            else:
                risk_score = 0.5
                context = str(val) if val is not None else "N/A"

        # Mức độ: kết hợp risk_score × importance để ra contribution thực
        contribution = round(float(risk_score) * float(importance), 4)

        if risk_score >= 0.65:
            risk_level_f = "high"
        elif risk_score >= 0.35:
            risk_level_f = "medium"
        else:
            risk_level_f = "low"

        feature_contributions.append({
            "feature": feat,
            "value": val,
            "importance": importance,
            "risk_score": round(risk_score, 3),   # 0→1, mức nguy cơ của giá trị này
            "contribution": contribution,           # risk_score × importance
            "risk_level": risk_level_f,             # "high"/"medium"/"low"
            "context": context,                     # mô tả so sánh
        })

    # Sắp xếp theo contribution giảm dần
    feature_contributions.sort(key=lambda x: x["contribution"], reverse=True)

    return {
        "risk_probability": round(risk_prob * 100, 2),
        "risk_level": risk_level,
        "risk_label": risk_label,
        "is_at_risk": prediction,
        "interventions": interventions,
        "model_accuracy": round(model_state["accuracy"] * 100, 2),
        "feature_contributions": feature_contributions,
        "input_summary": input_data,
    }


class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    model: Optional[str] = "llama3.2"


def detect_intent(question: str) -> list[str]:
    """Phát hiện intent từ câu hỏi, trả về list các chủ đề liên quan."""
    q = question.lower()
    intents = []

    kw_map = {
        "overview":      ["bao nhieu", "bao nhiêu", "tong so", "tổng số", "tong quan", "tổng quan", "overview", "summary", "tom tat", "tóm tắt"],
        "risk":          ["nguy co", "nguy cơ", "risk", "rui ro", "rủi ro", "hoc yeu", "học yếu", "at risk"],
        "score":         ["diem", "điểm", "score", "ket qua", "kết quả", "thanh tich", "thành tích", "xep loai", "xếp loại", "grade"],
        "attendance":    ["chuyen can", "chuyên cần", "attendance", "di hoc", "đi học", "diem danh", "điểm danh", "vang mat", "vắng mặt"],
        "study_hours":   ["gio hoc", "giờ học", "tu hoc", "tự học", "study hour", "thoi gian hoc", "thời gian học"],
        "study_method":  ["phuong phap", "phương pháp", "method", "cach hoc", "cách học", "online video", "coaching", "notes", "group study"],
        "gender":        ["gioi tinh", "giới tính", "gender", " nam ", " nu ", " nữ ", "con trai", "con gai"],
        "school_type":   ["truong", "trường", "school", "cong lap", "công lập", "tu thuc", "tư thục"],
        "internet":      ["internet", "mang", "mạng", "online", "truy cap", "truy cập"],
        "parent_edu":    ["phu huynh", "phụ huynh", "parent", "gia dinh", "gia đình", "hoc van", "học vấn"],
        "travel":        ["di chuyen", "di chuyển", "travel", "xa truong", "xa trường", "duong xa", "đường xa"],
        "extra":         ["ngoai khoa", "ngoại khóa", "extra", "hoat dong", "hoạt động", "clb", "the thao"],
        "model_info":    ["model", "mo hinh", "mô hình", "ml", "machine learning", "accuracy", "chinh xac", "chính xác", "random forest", "du doan", "dự đoán"],
        "advice":        ["khuyen", "khuyên", "loi khuyen", "lời khuyên", "can thiep", "can thiệp", "giai phap", "giải pháp", "cai thien", "cải thiện", "lam the nao", "làm thế nào", "nen lam", "nên làm", "de xuat", "đề xuất"],
        "age":           ["tuoi", "tuổi", "age"],
    }

    for intent, keywords in kw_map.items():
        if any(kw in q for kw in keywords):
            intents.append(intent)

    # Nếu không match gì → fallback về overview
    if not intents:
        intents = ["overview"]

    return intents


def query_data_for_question(question: str) -> str:
    if not model_state["trained"] or model_state["df"] is None:
        return ""

    df = model_state["df"]
    intents = detect_intent(question)
    results = []

    if "overview" in intents or any(kw in question.lower() for kw in ["bao nhieu", "bao nhiêu", "tong", "tổng", "so luong", "số lượng", "count", "dem", "đếm"]):
        results.append(f"TONG SO HOC SINH: {len(df):,}")

        if "risk_level" in df.columns:
            high = int((df["risk_level"] == "high").sum())
            med = int((df["risk_level"] == "medium").sum())
            low = int((df["risk_level"] == "low").sum())
            results.append(f"Nguy co cao: {high:,} hoc sinh ({high/len(df)*100:.1f}%)")
            results.append(f"Nguy co trung binh: {med:,} hoc sinh ({med/len(df)*100:.1f}%)")
            results.append(f"An toan: {low:,} hoc sinh ({low/len(df)*100:.1f}%)")

        if "final_grade" in df.columns:
            grade_counts = df["final_grade"].value_counts().sort_index()
            results.append("PHAN BO XEP LOAI:")
            for grade, count in grade_counts.items():
                results.append(f"  Loai {grade.upper()}: {count:,} hoc sinh ({count/len(df)*100:.1f}%)")

        if "is_at_risk" in df.columns:
            at_risk = int(df["is_at_risk"].sum())
            results.append(f"Tong hoc sinh nguy co (E/F): {at_risk:,} ({at_risk/len(df)*100:.1f}%)")

    if "risk" in intents:
        if "risk_level" in df.columns:
            high = int((df["risk_level"] == "high").sum())
            med = int((df["risk_level"] == "medium").sum())
            low = int((df["risk_level"] == "low").sum())
            results.append(f"\nPHAN TICH NGUY CO CHI TIET:")
            results.append(f"- Nguy co cao (xac suat >=60%): {high:,} hoc sinh ({high/len(df)*100:.1f}%)")
            results.append(f"- Nguy co trung binh (30-60%): {med:,} hoc sinh ({med/len(df)*100:.1f}%)")
            results.append(f"- An toan (<30%): {low:,} hoc sinh ({low/len(df)*100:.1f}%)")

        if "study_method" in df.columns:
            method_risk = df.groupby("study_method")["is_at_risk"].agg(["mean", "count"])
            results.append("\nNGUY CO THEO PHUONG PHAP HOC:")
            for method, row in method_risk.iterrows():
                results.append(f"  {method}: {row['mean']*100:.1f}% nguy co ({int(row['count']):,} hs)")

        if "school_type" in df.columns:
            school_risk = df.groupby("school_type")["is_at_risk"].agg(["mean", "count"])
            results.append("\nNGUY CO THEO LOAI TRUONG:")
            for stype, row in school_risk.iterrows():
                results.append(f"  {stype}: {row['mean']*100:.1f}% nguy co ({int(row['count']):,} hs)")

        if "gender" in df.columns:
            gender_risk = df.groupby("gender")["is_at_risk"].agg(["mean", "count"])
            results.append("\nNGUY CO THEO GIOI TINH:")
            for g, row in gender_risk.iterrows():
                results.append(f"  {g}: {row['mean']*100:.1f}% nguy co ({int(row['count']):,} hs)")

        if "internet_access" in df.columns:
            inet_risk = df.groupby("internet_access")["is_at_risk"].agg(["mean", "count"])
            results.append("\nNGUY CO THEO INTERNET:")
            for ia, row in inet_risk.iterrows():
                results.append(f"  Internet={ia}: {row['mean']*100:.1f}% nguy co ({int(row['count']):,} hs)")

    if "model_info" in intents:
        fi = model_state["feature_importance"]
        results.append(f"\nTHONG TIN MO HINH ML:")
        results.append(f"  Thuat toan: Random Forest Classifier")
        results.append(f"  Do chinh xac (accuracy): {model_state['accuracy']*100:.2f}%")
        results.append(f"  Feature Importance:")
        for i, f in enumerate(fi):
            results.append(f"    {i+1}. {f['feature']}: {f['importance']:.4f}")

    if "study_method" in intents:
        if "study_method" in df.columns:
            results.append("\nPHAN TICH PHUONG PHAP HOC:")
            for method in df["study_method"].unique():
                subset = df[df["study_method"] == method]
                results.append(f"\n  [{method}]:")
                results.append(f"    So luong: {len(subset):,} hoc sinh")
                results.append(f"    Ty le nguy co: {subset['is_at_risk'].mean()*100:.1f}%")
                if "overall_score" in df.columns:
                    results.append(f"    Diem TB: {subset['overall_score'].mean():.1f}")
                if "study_hours" in df.columns:
                    results.append(f"    Gio hoc TB: {subset['study_hours'].mean():.1f}h")
                if "attendance_percentage" in df.columns:
                    results.append(f"    Chuyen can TB: {subset['attendance_percentage'].mean():.1f}%")

    if "score" in intents:
        if "overall_score" in df.columns:
            results.append(f"\nTHONG KE DIEM SO:")
            results.append(f"  TB: {df['overall_score'].mean():.2f} | Trung vi: {df['overall_score'].median():.2f}")
            results.append(f"  Min: {df['overall_score'].min():.2f} | Max: {df['overall_score'].max():.2f}")
            results.append(f"  P25: {df['overall_score'].quantile(0.25):.2f} | P75: {df['overall_score'].quantile(0.75):.2f}")
        if "final_grade" in df.columns:
            grade_counts = df["final_grade"].value_counts().sort_index()
            results.append("  Phan bo xep loai: " + " | ".join([f"{g.upper()}={c:,}({c/len(df)*100:.1f}%)" for g, c in grade_counts.items()]))

    if "attendance" in intents:
        if "attendance_percentage" in df.columns:
            results.append(f"\nTHONG KE CHUYEN CAN:")
            results.append(f"  TB: {df['attendance_percentage'].mean():.1f}% | Min: {df['attendance_percentage'].min():.1f}% | Max: {df['attendance_percentage'].max():.1f}%")
            bins = [0, 50, 60, 70, 80, 90, 100]
            labels_bin = ["<50%", "50-60%", "60-70%", "70-80%", "80-90%", ">90%"]
            df_temp = df.copy()
            df_temp["att_bin"] = pd.cut(df_temp["attendance_percentage"], bins=bins, labels=labels_bin)
            att_risk = df_temp.groupby("att_bin", observed=True)["is_at_risk"].agg(["mean", "count"])
            results.append("  Nguy co theo nhom chuyen can:")
            for bin_label in labels_bin:
                if bin_label in att_risk.index:
                    results.append(f"    {bin_label}: {att_risk.loc[bin_label, 'mean']*100:.1f}% nguy co ({int(att_risk.loc[bin_label, 'count']):,} hs)")

    if "study_hours" in intents:
        if "study_hours" in df.columns:
            results.append(f"\nTHONG KE GIO TU HOC:")
            results.append(f"  TB: {df['study_hours'].mean():.2f}h/ngay | Min: {df['study_hours'].min():.1f}h | Max: {df['study_hours'].max():.1f}h")
            bins = [0, 2, 3, 4, 5, 6, 24]
            labels_bin = ["<2h", "2-3h", "3-4h", "4-5h", "5-6h", ">6h"]
            df_temp = df.copy()
            df_temp["sh_bin"] = pd.cut(df_temp["study_hours"], bins=bins, labels=labels_bin)
            sh_risk = df_temp.groupby("sh_bin", observed=True)["is_at_risk"].agg(["mean", "count"])
            results.append("  Nguy co theo gio hoc:")
            for bin_label in labels_bin:
                if bin_label in sh_risk.index:
                    results.append(f"    {bin_label}: {sh_risk.loc[bin_label, 'mean']*100:.1f}% nguy co ({int(sh_risk.loc[bin_label, 'count']):,} hs)")

    if "gender" in intents:
        if "gender" in df.columns:
            results.append("\nPHAN TICH THEO GIOI TINH:")
            for g in sorted(df["gender"].unique()):
                subset = df[df["gender"] == g]
                line = f"  {g}: {len(subset):,} hs | Nguy co: {subset['is_at_risk'].mean()*100:.1f}%"
                if "overall_score" in df.columns:
                    line += f" | Diem TB: {subset['overall_score'].mean():.1f}"
                if "study_hours" in df.columns:
                    line += f" | Gio hoc TB: {subset['study_hours'].mean():.1f}h"
                results.append(line)

    if "school_type" in intents:
        if "school_type" in df.columns:
            results.append("\nPHAN TICH THEO LOAI TRUONG:")
            for stype in sorted(df["school_type"].unique()):
                subset = df[df["school_type"] == stype]
                line = f"  {stype}: {len(subset):,} hs | Nguy co: {subset['is_at_risk'].mean()*100:.1f}%"
                if "overall_score" in df.columns:
                    line += f" | Diem TB: {subset['overall_score'].mean():.1f}"
                results.append(line)

    if "internet" in intents:
        if "internet_access" in df.columns:
            results.append("\nPHAN TICH THEO INTERNET:")
            for ia in sorted(df["internet_access"].unique()):
                subset = df[df["internet_access"] == ia]
                line = f"  Internet={ia}: {len(subset):,} hs | Nguy co: {subset['is_at_risk'].mean()*100:.1f}%"
                if "overall_score" in df.columns:
                    line += f" | Diem TB: {subset['overall_score'].mean():.1f}"
                results.append(line)

    if "parent_edu" in intents:
        if "parent_education" in df.columns:
            results.append("\nPHAN TICH THEO HOC VAN PHU HUYNH:")
            for edu in df["parent_education"].unique():
                subset = df[df["parent_education"] == edu]
                line = f"  [{edu}]: {len(subset):,} hs | Nguy co: {subset['is_at_risk'].mean()*100:.1f}%"
                if "overall_score" in df.columns:
                    line += f" | Diem TB: {subset['overall_score'].mean():.1f}"
                results.append(line)

    if "travel" in intents:
        if "travel_time" in df.columns:
            results.append("\nPHAN TICH THEO THOI GIAN DI CHUYEN:")
            for tt in df["travel_time"].unique():
                subset = df[df["travel_time"] == tt]
                line = f"  [{tt}]: {len(subset):,} hs | Nguy co: {subset['is_at_risk'].mean()*100:.1f}%"
                if "overall_score" in df.columns:
                    line += f" | Diem TB: {subset['overall_score'].mean():.1f}"
                results.append(line)

    if "extra" in intents:
        if "extra_activities" in df.columns:
            results.append("\nPHAN TICH THEO HOAT DONG NGOAI KHOA:")
            for ea in sorted(df["extra_activities"].unique()):
                subset = df[df["extra_activities"] == ea]
                line = f"  Ngoai khoa={ea}: {len(subset):,} hs | Nguy co: {subset['is_at_risk'].mean()*100:.1f}%"
                if "overall_score" in df.columns:
                    line += f" | Diem TB: {subset['overall_score'].mean():.1f}"
                results.append(line)

    if "age" in intents:
        if "age" in df.columns:
            results.append(f"\nTHONG KE TUOI: TB={df['age'].mean():.1f} | Min={df['age'].min()} | Max={df['age'].max()}")
            age_risk = df.groupby("age")["is_at_risk"].agg(["mean", "count"])
            results.append("  Nguy co theo tuoi:")
            for age, row in age_risk.iterrows():
                if row["count"] > 10:
                    results.append(f"    Tuoi {int(age)}: {row['mean']*100:.1f}% nguy co ({int(row['count'])} hs)")

    if "advice" in intents:
        results.append("\nDU LIEU HO TRO KHUYEN NGHI:")
        if "study_hours" in df.columns:
            low_study = df[df["study_hours"] < 3]
            results.append(f"  Hoc sinh hoc <3h/ngay: {len(low_study):,} ({low_study['is_at_risk'].mean()*100:.1f}% nguy co)")
        if "attendance_percentage" in df.columns:
            low_att = df[df["attendance_percentage"] < 65]
            results.append(f"  Hoc sinh chuyen can <65%: {len(low_att):,} ({low_att['is_at_risk'].mean()*100:.1f}% nguy co)")
        if "study_method" in df.columns:
            method_risk = df.groupby("study_method")["is_at_risk"].mean() * 100
            results.append(f"  PP hoc hieu qua nhat: {method_risk.idxmin()} ({method_risk.min():.1f}% nguy co)")
            results.append(f"  PP hoc kem hieu qua: {method_risk.idxmax()} ({method_risk.max():.1f}% nguy co)")
        if "internet_access" in df.columns:
            no_inet = df[df["internet_access"] == "no"]
            if len(no_inet) > 0:
                results.append(f"  Hoc sinh khong co internet: {len(no_inet):,} ({no_inet['is_at_risk'].mean()*100:.1f}% nguy co)")

    # Fallback tong quan neu khong co gi
    if not results:
        fi = model_state["feature_importance"]
        results.append(f"TONG QUAN: {len(df):,} hoc sinh | Diem TB: {df['overall_score'].mean():.2f}" if "overall_score" in df.columns else f"TONG QUAN: {len(df):,} hoc sinh")
        results.append(f"Nguy co (E/F): {df['is_at_risk'].mean()*100:.1f}% | ML accuracy: {model_state['accuracy']*100:.2f}%")
        if "risk_level" in df.columns:
            results.append(f"Nguy co cao: {(df['risk_level']=='high').sum():,} | TB: {(df['risk_level']=='medium').sum():,} | An toan: {(df['risk_level']=='low').sum():,}")
        if fi:
            results.append(f"Top yeu to: {fi[0]['feature']}, {fi[1]['feature']}, {fi[2]['feature']}")

    return "\n".join(results)


def build_system_prompt(user_question: str = "") -> str:
    """
    System prompt co cau truc ro rang:
    [VAI TRO] -> [QUY TAC] -> [DU LIEU NGU CANH] -> [FEW-SHOT EXAMPLES]
    """
    # === Phần 1: VAI TRÒ + RÀNG BUỘC RÕ RÀNG ===
    role_block = """\
## VAI TRO
Ban la chuyen gia phan tich giao duc tich hop trong he thong Student Performance AI.
Nhiem vu: phan tich du lieu hoc sinh, phat hien nguy co hoc yeu, tu van giai phap can thiep.
Ngon ngu: Tieng Viet (tru khi nguoi dung hoi tieng Anh).

## QUY TAC BAT BUOC
1. CHI dung so lieu tu phan [DU LIEU] ben duoi - KHONG duoc tu bịa dat hoac uoc luong.
2. TRA LOI DUNG TRONG TAM cau hoi - khong lan man sang chu de khac.
3. FORMAT: Dung bullet point khi liet ke >= 3 muc. Dung so lieu cu the, co don vi ro rang.
4. DO DAI: Ngan gon, suc tich (3-6 cau hoac 3-5 bullet points). Neu can giai thich sau thi mo rong them.
5. LOI KHUYEN: Neu nguoi dung hoi ve can thiep/giai phap, LUON ket thuc bang 1-2 khuyen nghi cu the dua tren so lieu.
6. Neu cau hoi khong lien quan den du lieu hoc sinh (vi du: tin tuc, cong thuc, lich su), tra loi binh thuong nhu mot tro ly thong minh.

## CAC LOAI CAU HOI VA CACH XU LY
- Hoi tong quan/so luong -> Neu cac KPI chinh: tong hs, % nguy co, diem TB, phan bo xep loai
- Hoi phan tich (theo nhom, theo yeu to) -> So sanh so lieu giua cac nhom, neu chenh lech ro
- Hoi ly giai / "tai sao" -> Giai thich dua tren du lieu + logic giao duc, khong suy dien qua muc
- Hoi khuyen nghi / giai phap -> Cu the, thuc te, co con so minh chung
"""

    # === Phần 2: NO DATA ===
    if not model_state["trained"] or model_state["df"] is None:
        no_data_block = "\n## DU LIEU\nChua co du lieu hoc sinh. Hay upload file CSV de bat dau phan tich.\n"
        few_shot = """\n## VI DU TRA LOI (khi chua co du lieu)
Nguoi dung: "Co bao nhieu hoc sinh nguy co cao?"
Tro ly: "He thong chua co du lieu. Ban vui long upload file CSV o tab 'Upload' de toi co the phan tich ngay."\n"""
        return role_block + no_data_block + few_shot

    # === Phần 3: DỮ LIỆU NGỮ CẢNH (chọn lọc theo câu hỏi) ===
    df = model_state["df"]
    fi = model_state["feature_importance"]
    acc = model_state["accuracy"]

    # Snapshot co ban - luon co mat
    high_risk = int((df["risk_level"] == "high").sum()) if "risk_level" in df.columns else 0
    med_risk  = int((df["risk_level"] == "medium").sum()) if "risk_level" in df.columns else 0
    low_risk  = int((df["risk_level"] == "low").sum()) if "risk_level" in df.columns else 0
    at_risk_pct = round(float(df["is_at_risk"].mean() * 100), 2)
    avg_score = round(float(df["overall_score"].mean()), 2) if "overall_score" in df.columns else "N/A"
    fi_top3 = ", ".join([f"{x['feature']}({x['importance']:.2f})" for x in fi[:3]]) if fi else "chua co"

    snapshot = f"""\n## DU LIEU TONG QUAN (snapshot)
- Tong hoc sinh: {len(df):,}
- Nguy co cao/TB/An toan: {high_risk:,} / {med_risk:,} / {low_risk:,}
- % nguy co hoc yeu (xep loai E/F): {at_risk_pct}%
- Diem trung binh: {avg_score}/100
- ML accuracy: {round(acc*100, 2)}% | Top yeu to: {fi_top3}
"""

    # Du lieu chi tiet theo intent - chi lay phan lien quan
    specific_data = query_data_for_question(user_question)
    detail_block = ""
    if specific_data:
        detail_block = f"\n## DU LIEU CHI TIET (lien quan den cau hoi nay)\n{specific_data}\n"

    # === Phần 4: FEW-SHOT EXAMPLES ===
    few_shot = """\n## VI DU TRA LOI CHUAN (format mau)

Nguoi dung: "Tong quan tinh hinh hoc sinh?"
Tro ly:
Tong quan {len_df} hoc sinh:
- **Nguy co cao**: {high_risk} hs ({high_pct:.1f}%) - can can thiep ngay
- **Nguy co TB**: {med_risk} hs ({med_pct:.1f}%) - can theo doi
- **An toan**: {low_risk} hs ({low_pct:.1f}%)
- Diem TB: {avg_score}/100 | ML accuracy: {acc_pct:.1f}%

Nguoi dung: "Phuong phap hoc nao hieu qua nhat?"
Tro ly:
Dua tren du lieu {len_df} hoc sinh:
- **Hieu qua nhat**: [method co % nguy co thap nhat] voi X% nguy co
- **Kem hieu qua nhat**: [method co % nguy co cao nhat] voi Y% nguy co
→ Khuyen nghi: Huong dan hoc sinh chuyen sang [method tot nhat] va tang cuong gio tu hoc len >= 4h/ngay.

Nguoi dung: "Lam the nao de giam nguy co cho hoc sinh?"
Tro ly:
3 giai phap uu tien dua tren du lieu:
1. **Tang chuyen can** - hoc sinh co chuyen can <65% co nguy co [X]%, nen dat muc tieu >80%
2. **Tang gio tu hoc** - nhom hoc <3h/ngay co nguy co [Y]%, nen hoc >= 4h
3. **Ho tro internet** - {no_inet} hoc sinh khong co internet co nguy co cao hon [Z]%
""".format(
        len_df=f"{len(df):,}",
        high_risk=f"{high_risk:,}",
        high_pct=high_risk/len(df)*100,
        med_risk=f"{med_risk:,}",
        med_pct=med_risk/len(df)*100,
        low_risk=f"{low_risk:,}",
        low_pct=low_risk/len(df)*100,
        avg_score=avg_score,
        acc_pct=acc*100,
        no_inet=int((df["internet_access"] == "no").sum()) if "internet_access" in df.columns else "?",
    )

    return role_block + snapshot + detail_block + few_shot


@app.get("/api/chat/models")
async def get_ollama_models():
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            res = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            data = res.json()
            models = [m["name"] for m in data.get("models", [])]
            return {"available": True, "models": models}
    except Exception as e:
        return {"available": False, "models": [], "error": str(e)}


@app.post("/api/chat")
async def chat(req: ChatRequest):
    last_user_msg = ""
    for m in reversed(req.messages):
        if m.role == "user":
            last_user_msg = m.content
            break

    system_prompt = build_system_prompt(last_user_msg)
    messages = [{"role": "system", "content": system_prompt}]
    for m in req.messages:
        messages.append({"role": m.role, "content": m.content})

    payload = {
        "model": req.model,
        "messages": messages,
        "stream": False,
        "options": {
            "temperature": 0.3,
            "num_ctx": 8192,
        }
    }

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            res = await client.post(f"{OLLAMA_BASE_URL}/api/chat", json=payload)
            if res.status_code != 200:
                raise HTTPException(status_code=502, detail=f"Ollama error: {res.text}")
            data = res.json()
            reply = data.get("message", {}).get("content", "Xin loi, toi khong the tra loi luc nay.")
            return {
                "role": "assistant",
                "content": reply,
                "model": req.model,
            }
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail="Khong the ket noi Ollama. Hay dam bao Ollama dang chay tai http://localhost:11434 (chay lenh: ollama serve)"
        )
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Ollama phan hoi qua cham. Thu lai sau.")


@app.post("/api/chat/stream")
async def chat_stream(req: ChatRequest):
    last_user_msg = ""
    for m in reversed(req.messages):
        if m.role == "user":
            last_user_msg = m.content
            break

    system_prompt = build_system_prompt(last_user_msg)
    messages = [{"role": "system", "content": system_prompt}]
    for m in req.messages:
        messages.append({"role": m.role, "content": m.content})

    payload = {
        "model": req.model,
        "messages": messages,
        "stream": True,
        "options": {"temperature": 0.3, "num_ctx": 8192}
    }

    async def stream_generator():
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream("POST", f"{OLLAMA_BASE_URL}/api/chat", json=payload) as res:
                    async for line in res.aiter_lines():
                        if line.strip():
                            try:
                                chunk = json.loads(line)
                                token = chunk.get("message", {}).get("content", "")
                                done = chunk.get("done", False)
                                yield f"data: {json.dumps({'token': token, 'done': done})}\n\n"
                                if done:
                                    break
                            except Exception:
                                continue
        except httpx.ConnectError:
            yield f"data: {json.dumps({'token': '', 'done': True, 'error': 'Khong the ket noi Ollama. Hay chay: ollama serve'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'token': '', 'done': True, 'error': str(e)})}\n\n"

    return StreamingResponse(stream_generator(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.get("/api/health")
def health():
    return {"status": "ok", "trained": model_state["trained"]}
