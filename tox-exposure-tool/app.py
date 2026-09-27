import datetime as dt

from flask import Flask, render_template, request, redirect, url_for, flash

import db
from engine.scoring import score_logs, load_hazard_db, load_concepts, NOVA_LABELS, PRACTICE_LABELS
from engine import achievements
from sources import openfoodfacts_client

app = Flask(__name__)
app.secret_key = "dev-only-not-secret"  # local single-user tool; replace if ever exposed beyond localhost

db.init_db()

BIOMARKER_PRESETS = [
    "Resting heart rate (bpm)", "HRV (ms)", "Sleep score", "Grip strength (kg)",
    "30s sit-to-stand (reps)", "VO2max (ml/kg/min)", "Body fat % (DEXA/InBody)",
    "Fasting glucose (mg/dL)", "HbA1c (%)", "hs-CRP (mg/L)", "Other",
]


def today_str():
    return dt.date.today().isoformat()


@app.route("/")
def index():
    recent = db.get_recent_logs(limit=8)
    all_unlocked, newly_unlocked = achievements.evaluate_and_unlock()
    for a in newly_unlocked:
        flash(f"Achievement unlocked: {a['icon']} {a['name']} — {a['description']}", "success")
    return render_template(
        "index.html", recent=recent, today=today_str(), streak=achievements.compute_streak(),
        unlocked_count=len(all_unlocked), total_achievements=len(achievements.CATALOG),
    )


@app.route("/log/food", methods=["GET", "POST"])
def log_food():
    if request.method == "POST":
        level = request.form.get("processing_level") or None
        db.insert_food_log(
            log_date=request.form.get("log_date") or today_str(),
            meal=request.form.get("meal", "breakfast"),
            food_item=request.form["food_item"].strip(),
            processing_level=int(level) if level else None,
            notes=request.form.get("notes", "").strip(),
        )
        flash("Food entry logged.", "success")
        return redirect(url_for("log_food"))
    recent = db.get_recent_logs(limit=10)["food"]
    return render_template("log_food.html", today=today_str(), recent=recent, nova_labels=NOVA_LABELS)


@app.route("/log/food/scan", methods=["GET", "POST"])
def log_food_scan():
    """Barcode lookup via Open Food Facts — pre-fills a confirmation form rather than
    inserting directly, so the user reviews what was found before it's logged."""
    if request.method == "POST":
        barcode = request.form.get("barcode", "").strip()
        result = openfoodfacts_client.lookup_barcode(barcode) if barcode else None
        if not result:
            flash(f"No product found for barcode '{barcode}' in Open Food Facts — try manual entry instead.", "error")
            return redirect(url_for("log_food_scan"))
        return render_template(
            "log_food_scan_confirm.html",
            today=today_str(),
            product=result,
            barcode=barcode,
        )
    return render_template("log_food_scan.html")


@app.route("/log/product", methods=["GET", "POST"])
def log_product():
    if request.method == "POST":
        db.insert_product_log(
            log_date=request.form.get("log_date") or today_str(),
            product_type=request.form["product_type"].strip(),
            product_name=request.form["product_name"].strip(),
            ingredients_text=request.form.get("ingredients_text", "").strip(),
            notes=request.form.get("notes", "").strip(),
        )
        flash("Product entry logged.", "success")
        return redirect(url_for("log_product"))
    recent = db.get_recent_logs(limit=10)["products"]
    return render_template("log_product.html", today=today_str(), recent=recent)


@app.route("/log/environment", methods=["GET", "POST"])
def log_environment():
    if request.method == "POST":
        db.insert_environment_log(
            log_date=request.form.get("log_date") or today_str(),
            location=request.form["location"].strip(),
            condition_type=request.form["condition_type"].strip(),
            detail=request.form.get("detail", "").strip(),
            notes=request.form.get("notes", "").strip(),
        )
        flash("Environment entry logged.", "success")
        return redirect(url_for("log_environment"))
    recent = db.get_recent_logs(limit=10)["environment"]
    return render_template("log_environment.html", today=today_str(), recent=recent)


@app.route("/log/air-quality", methods=["GET", "POST"])
def log_air_quality():
    if request.method == "POST":
        db.insert_air_quality_log(
            log_date=request.form.get("log_date") or today_str(),
            location=request.form["location"].strip(),
            pollutant=request.form["pollutant"],
            value=float(request.form["value"]),
            source=request.form.get("source", "").strip(),
            notes=request.form.get("notes", "").strip(),
        )
        flash("Air quality reading logged.", "success")
        return redirect(url_for("log_air_quality"))
    recent = db.get_recent_logs(limit=10)["air_quality"]
    return render_template("log_air_quality.html", today=today_str(), recent=recent)


@app.route("/log/practice", methods=["GET", "POST"])
def log_practice():
    if request.method == "POST":
        duration = request.form.get("duration_minutes") or None
        db.insert_practice_log(
            log_date=request.form.get("log_date") or today_str(),
            practice_type=request.form["practice_type"],
            duration_minutes=int(duration) if duration else None,
            detail=request.form.get("detail", "").strip(),
            notes=request.form.get("notes", "").strip(),
        )
        flash("Practice logged — nice work.", "success")
        return redirect(url_for("log_practice"))
    recent = db.get_recent_logs(limit=10)["practices"]
    return render_template("log_practice.html", today=today_str(), recent=recent, practice_labels=PRACTICE_LABELS)


@app.route("/dashboard")
def dashboard():
    days = int(request.args.get("days", 7))
    end = dt.date.today()
    start = end - dt.timedelta(days=days - 1)
    logs = db.get_logs_for_range(start.isoformat(), end.isoformat())
    completed_keys = db.get_completed_action_keys(since_date=(end - dt.timedelta(days=13)).isoformat())
    report = score_logs(logs, completed_action_keys=completed_keys)

    all_unlocked, newly_unlocked = achievements.evaluate_and_unlock()
    for a in newly_unlocked:
        flash(f"Achievement unlocked: {a['icon']} {a['name']} — {a['description']}", "success")

    return render_template(
        "dashboard.html",
        report=report,
        start=start.isoformat(),
        end=end.isoformat(),
        days=days,
        streak=achievements.compute_streak(),
        unlocked_count=len(all_unlocked),
        total_achievements=len(achievements.CATALOG),
        recent_biomarkers=db.get_biomarker_logs(limit=5),
    )


@app.route("/achievements")
def achievements_page():
    catalog = achievements.get_catalog_with_status()
    unlocked_count = sum(1 for a in catalog if a["unlocked"])
    return render_template(
        "achievements.html",
        catalog=catalog,
        unlocked_count=unlocked_count,
        total_count=len(catalog),
        streak=achievements.compute_streak(),
    )


@app.route("/log/biomarker", methods=["GET", "POST"])
def log_biomarker():
    if request.method == "POST":
        metric = request.form.get("metric_other", "").strip() or request.form["metric"]
        db.insert_biomarker_log(
            log_date=request.form.get("log_date") or today_str(),
            metric=metric,
            value=float(request.form["value"]),
            unit=request.form.get("unit", "").strip(),
            source=request.form.get("source", "").strip(),
            notes=request.form.get("notes", "").strip(),
        )
        flash("Biomarker logged.", "success")
        return redirect(url_for("log_biomarker"))
    recent = db.get_biomarker_logs(limit=20)
    return render_template("log_biomarker.html", today=today_str(), recent=recent, presets=BIOMARKER_PRESETS)


@app.route("/action/complete", methods=["POST"])
def complete_action():
    tip_key = request.form["tip_key"]
    tip_text = request.form.get("tip_text", "")
    db.mark_action_completed(tip_key, tip_text, today_str())
    flash("Marked as done — nice work.", "success")
    return redirect(request.referrer or url_for("dashboard"))


@app.route("/learn")
def learn():
    substances = load_hazard_db()
    concepts = load_concepts()
    by_category = {"food": [], "personal_care": [], "environment": []}
    for s in substances:
        by_category.setdefault(s["category"], []).append(s)
    for cat in by_category:
        by_category[cat].sort(key=lambda s: -s["concern_level"])
    return render_template("learn.html", by_category=by_category, concepts=concepts)


@app.route("/delete/<category>/<int:log_id>", methods=["POST"])
def delete_entry(category, log_id):
    if category not in ("food", "products", "environment", "air_quality", "practices", "biomarkers"):
        flash("Unknown category.", "error")
        return redirect(url_for("index"))
    db.delete_log(category, log_id)
    flash("Entry deleted.", "success")
    return redirect(request.referrer or url_for("index"))


if __name__ == "__main__":
    app.run(debug=True, port=5050)
