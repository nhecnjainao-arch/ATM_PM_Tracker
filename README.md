ATM PREVENTIVE MAINTENANCE TRACKER
====================================

Engineer Name:
Nhec NJ Inao

Engineer Code:
SA101R80

FEATURES
--------
1. Daily PM tracking
2. Weekly PM tracking
3. Monthly PM tracking
4. Yearly PM tracking
5. Paste email and automatically encode fields
6. Engineer name/code automatically filled
7. Calendar/date parsing
8. Local SQLite database
9. Excel import
10. Text-based PDF import
11. Duplicate protection
12. ATM ID search
13. Date filtering
14. CSV export
15. Weekly and monthly summaries

EMAIL FORMAT
------------
ATM ID:
LOCATION:
SERVICE REQUEST NUMBER (SRN):
WORK ORDER NUMBER (WON):
DATE COMPLETD:
REMARKS:

INSTALLATION
------------
1. Install Python 3.
2. Open Command Prompt in this folder.
3. Run:
   pip install -r requirements.txt
4. Run:
   streamlit run app.py

OR
Double-click run.bat

PDF NOTE
--------
Text-based PDFs are supported.
Scanned/image-only PDFs require OCR and are not automatically readable in this version.
