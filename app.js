import streamlit as st
import sqlite3, re
from datetime import date, datetime
import pandas as pd

DB = "pm_records.db"
ENGINEER = "Nhec NJ Inao"
ENGINEER_CODE = "SA101R80"

def get_conn():
    c = sqlite3.connect(DB)
    c.execute("""
    CREATE TABLE IF NOT EXISTS pm_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        atm_id TEXT,
        location TEXT,
        srn TEXT,
        won TEXT,
        date_completed TEXT,
        remarks TEXT,
        engineer_name TEXT,
        engineer_code TEXT,
        source TEXT,
        created_at TEXT,
        UNIQUE(atm_id, srn, won, date_completed)
    )""")
    c.commit()
    return c

def clean(v):
    return re.sub(r"\s+", " ", str(v or "")).strip()

def extract(text, aliases):
    for label in aliases:
        m = re.search(r"(?im)^\s*" + re.escape(label) + r"\s*:\s*(.*?)\s*$", text)
        if m:
            return clean(m.group(1))
    return ""

def parse_date(value):
    value = clean(value)
    if not value:
        return date.today().isoformat()
    for dayfirst in (True, False):
        try:
            return pd.to_datetime(value, dayfirst=dayfirst).date().isoformat()
        except Exception:
            pass
    return date.today().isoformat()

def parse_email(text, source="Email Paste"):
    return {
        "atm_id": extract(text, ["ATM ID", "ATMID"]),
        "location": extract(text, ["LOCATION"]),
        "srn": extract(text, ["SERVICE REQUEST NUMBER (SRN)", "SERVICE REQUEST NUMBER", "SRN"]),
        "won": extract(text, ["WORK ORDER NUMBER (WON)", "WORK ORDER NUMBER", "WON"]),
        "date_completed": parse_date(extract(text, ["DATE COMPLETD", "DATE COMPLETED", "DATE"])),
        "remarks": extract(text, ["REMARKS", "REMARK"]),
        "engineer_name": ENGINEER,
        "engineer_code": ENGINEER_CODE,
        "source": source,
        "created_at": datetime.now().isoformat(timespec="seconds")
    }

def save_record(r):
    c = get_conn()
    c.execute("""
    INSERT OR IGNORE INTO pm_records
    (atm_id, location, srn, won, date_completed, remarks,
     engineer_name, engineer_code, source, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        r["atm_id"], r["location"], r["srn"], r["won"],
        r["date_completed"], r["remarks"], r["engineer_name"],
        r["engineer_code"], r["source"], r["created_at"]
    ))
    c.commit()
    c.close()

def read_records():
    c = get_conn()
    df = pd.read_sql_query(
        "SELECT * FROM pm_records ORDER BY date_completed DESC, id DESC", c
    )
    c.close()
    return df

def excel_records(file):
    records = []
    xl = pd.ExcelFile(file)
    aliases = {
        "atm_id": ["ATM ID", "ATMID"],
        "location": ["LOCATION"],
        "srn": ["SERVICE REQUEST NUMBER (SRN)", "SERVICE REQUEST NUMBER", "SRN"],
        "won": ["WORK ORDER NUMBER (WON)", "WORK ORDER NUMBER", "WON"],
        "date_completed": ["DATE COMPLETD", "DATE COMPLETED", "DATE"],
        "remarks": ["REMARKS", "REMARK"]
    }
    for sheet in xl.sheet_names:
        df = pd.read_excel(file, sheet_name=sheet)
        df.columns = [clean(c).upper() for c in df.columns]

        def value(names, row):
            for n in names:
                if n in df.columns:
                    return clean(row[n])
            return ""

        for _, row in df.iterrows():
            records.append({
                "atm_id": value(aliases["atm_id"], row),
                "location": value(aliases["location"], row),
                "srn": value(aliases["srn"], row),
                "won": value(aliases["won"], row),
                "date_completed": parse_date(value(aliases["date_completed"], row)),
                "remarks": value(aliases["remarks"], row),
                "engineer_name": ENGINEER,
                "engineer_code": ENGINEER_CODE,
                "source": f"Excel: {file.name}/{sheet}",
                "created_at": datetime.now().isoformat(timespec="seconds")
            })
    return records

def pdf_records(file):
    import pdfplumber
    with pdfplumber.open(file) as pdf:
        text = "\n".join((p.extract_text() or "") for p in pdf.pages)

    blocks = re.split(r"(?im)(?=^\s*ATM ID\s*:)", text)
    return [
        parse_email(block, f"PDF: {file.name}")
        for block in blocks
        if "ATM ID" in block.upper()
    ]

get_conn().close()

st.set_page_config(page_title="ATM PM Tracker", layout="wide")

st.title("ATM Preventive Maintenance Tracker")
st.caption(f"Engineer: {ENGINEER} | Code: {ENGINEER_CODE}")

menu = st.sidebar.radio(
    "MENU",
    ["Dashboard", "Paste Email", "Upload Excel / PDF", "Records & Reports"]
)

if menu == "Dashboard":
    df = read_records()
    today = date.today()

    if df.empty:
        daily = weekly = monthly = yearly = 0
    else:
        dt = pd.to_datetime(df["date_completed"], errors="coerce")
        iso = dt.dt.isocalendar()
        daily = int((dt.dt.date == today).sum())
        weekly = int(((iso.year == today.isocalendar().year) &
                      (iso.week == today.isocalendar().week)).sum())
        monthly = int(((dt.dt.year == today.year) &
                       (dt.dt.month == today.month)).sum())
        yearly = int((dt.dt.year == today.year).sum())

    a, b, c, d = st.columns(4)
    a.metric("Today", daily)
    b.metric("This Week", weekly)
    c.metric("This Month", monthly)
    d.metric("This Year", yearly)

    st.subheader("Recent PM Records")
    st.dataframe(df.head(25), use_container_width=True, hide_index=True)

elif menu == "Paste Email":
    st.header("Paste PM Email → Encode → Save")

    text = st.text_area(
        "Paste the email here",
        height=280,
        placeholder="""ATM ID:
LOCATION:
SERVICE REQUEST NUMBER (SRN):
WORK ORDER NUMBER (WON):
DATE COMPLETD:
REMARKS:"""
    )

    if st.button("ENCODE & PREVIEW", type="primary"):
        if not text.strip():
            st.error("Please paste the PM email.")
        else:
            st.session_state["preview"] = parse_email(text)

    if "preview" in st.session_state:
        st.subheader("Encoded Record")
        st.dataframe(
            pd.DataFrame([st.session_state["preview"]]),
            use_container_width=True,
            hide_index=True
        )

        if st.button("CONFIRM & SAVE RECORD"):
            save_record(st.session_state["preview"])
            del st.session_state["preview"]
            st.success("PM record saved successfully.")

elif menu == "Upload Excel / PDF":
    st.header("Automatic Excel / PDF Import")

    files = st.file_uploader(
        "Upload Excel or PDF files",
        type=["xlsx", "xls", "pdf"],
        accept_multiple_files=True
    )

    if st.button("READ & ENCODE FILES", type="primary"):
        records = []

        for file in files or []:
            try:
                if file.name.lower().endswith(".pdf"):
                    records.extend(pdf_records(file))
                else:
                    records.extend(excel_records(file))
            except Exception as e:
                st.error(f"{file.name}: {e}")

        st.session_state["imports"] = records
        st.success(f"Encoded {len(records)} record(s).")

    if st.session_state.get("imports"):
        st.dataframe(
            pd.DataFrame(st.session_state["imports"]),
            use_container_width=True,
            hide_index=True
        )

        if st.button("CONFIRM & SAVE ALL"):
            for record in st.session_state["imports"]:
                save_record(record)
            st.session_state.pop("imports")
            st.success("All records saved successfully.")

elif menu == "Records & Reports":
    st.header("PM Records & Reports")

    df = read_records()

    if df.empty:
        st.info("No PM records available.")
    else:
        df["date_completed"] = pd.to_datetime(
            df["date_completed"], errors="coerce"
        )

        c1, c2, c3 = st.columns(3)
        start = c1.date_input("From", df["date_completed"].min().date())
        end = c2.date_input("To", df["date_completed"].max().date())
        search_atm = c3.text_input("Search ATM ID")

        filtered = df[
            (df["date_completed"].dt.date >= start) &
            (df["date_completed"].dt.date <= end)
        ].copy()

        if search_atm:
            filtered = filtered[
                filtered["atm_id"].astype(str).str.contains(
                    search_atm, case=False, na=False
                )
            ]

        st.dataframe(filtered, use_container_width=True, hide_index=True)

        st.download_button(
            "DOWNLOAD CSV",
            filtered.to_csv(index=False).encode("utf-8"),
            "ATM_PM_Records.csv",
            "text/csv"
        )

        st.subheader("Monthly PM Summary")
        monthly = (
            filtered.assign(Month=filtered["date_completed"].dt.strftime("%Y-%m"))
            .groupby("Month")
            .size()
            .reset_index(name="PM Count")
        )
        st.dataframe(monthly, use_container_width=True, hide_index=True)

        st.subheader("Weekly PM Summary")
        weekly = (
            filtered.assign(Week=filtered["date_completed"].dt.strftime("%G-W%V"))
            .groupby("Week")
            .size()
            .reset_index(name="PM Count")
        )
        st.dataframe(weekly, use_container_width=True, hide_index=True)
