"""One-time patch: adds concept_tags + technical_note (the 'go deeper' tier of the Learn
library) to every substance in data/hazard_database.json. Kept as a script rather than a
bare inline edit so the mapping is reviewable/re-runnable, same pattern as sources/sync_db.py."""
import json
from pathlib import Path

PATH = Path(__file__).parent.parent / "data" / "hazard_database.json"

NOTES = {
    "parabens": (
        ["hepatic_metabolism", "renal_clearance", "endocrine_disruption", "aggregate_exposure"],
        "Parabens are rapidly hydrolyzed by esterases in skin and liver to para-hydroxybenzoic "
        "acid, then conjugated and excreted in urine within hours — they do not meaningfully "
        "bioaccumulate. Their estrogen-receptor binding is several orders of magnitude weaker "
        "than estradiol; the more relevant concern is aggregate exposure across the many "
        "products a person uses in one day, not any single application."
    ),
    "phthalates": (
        ["hepatic_metabolism", "renal_clearance", "endocrine_disruption", "aggregate_exposure", "dose_response"],
        "Phthalates are rapidly metabolized (hepatic hydrolysis to monoester metabolites, then "
        "glucuronidation) and cleared renally with urinary half-lives of hours — which is why "
        "biomonitoring studies use spot urine samples: they reflect very recent exposure, not a "
        "stored body burden. Because clearance is fast, same-day aggregate exposure (fragrance "
        "across several products at once) matters more than any one product in isolation."
    ),
    "sodium_lauryl_sulfate": (
        ["dose_response"],
        "SLS's primary mechanism is local surfactant disruption of the skin/eye lipid barrier "
        "(protein denaturation at the contact site) rather than systemic absorption and "
        "metabolism — it's mechanistically a contact irritant, not a compound the liver/"
        "kidneys need to process in meaningful amounts at typical rinse-off use."
    ),
    "formaldehyde_releasers": (
        ["hepatic_metabolism", "dose_response"],
        "Released formaldehyde is rapidly oxidized by alcohol/aldehyde dehydrogenase (the same "
        "enzyme family that metabolizes ingested alcohol) to formate, then further processed or "
        "excreted — it does not accumulate. The consumer-product concern is primarily localized "
        "contact sensitization in already-sensitized skin, mechanistically distinct from the "
        "much higher-dose inhalation cancer data (occupational settings) behind its GHS "
        "carcinogen classification."
    ),
    "artificial_food_dyes": (
        ["aggregate_exposure", "dose_response"],
        "Most approved synthetic dyes are poorly absorbed from the gut and largely excreted "
        "unchanged in feces. The hyperactivity research concern is a proposed direct "
        "neurobehavioral effect in sensitive children — mechanistically different from most "
        "other entries here, which center on absorption/metabolism/accumulation."
    ),
    "added_sugar": (
        ["dose_response"],
        "This isn't a xenobiotic clearance question at all — glucose and fructose enter normal "
        "carbohydrate metabolism. The concern is purely dose and frequency (glycemic load, "
        "hepatic fructose handling at high chronic intake), which is part of why it carries the "
        "lowest concern level in this database despite being ubiquitous."
    ),
    "acrylamide": (
        ["hepatic_metabolism", "dose_response"],
        "Acrylamide is metabolized primarily via hepatic CYP2E1 to glycidamide, a more reactive "
        "epoxide considered the genotoxic species in animal studies; glycidamide is then "
        "detoxified via glutathione conjugation. Dietary exposure sits far below the doses used "
        "in the underlying animal carcinogenicity studies, which is the core reason regulators "
        "treat it as 'probable' rather than 'confirmed' at real-world food exposure levels."
    ),
    "bpa": (
        ["hepatic_metabolism", "renal_clearance", "endocrine_disruption", "dose_response"],
        "BPA undergoes rapid hepatic glucuronidation and is excreted in urine with a half-life "
        "of only a few hours in adults — like phthalates, consistent detection reflects ongoing "
        "low-level exposure rather than accumulation. Its estrogen-receptor activity is weak "
        "relative to estradiol; the more actively debated science concerns low-dose, "
        "non-monotonic effects rather than accumulation."
    ),
    "titanium_dioxide": (
        ["dose_response"],
        "The specific concern from EFSA's 2021 review is the nanoparticle-sized fraction of "
        "ingested particles, which behaves differently from bulk-phase TiO2 in cellular-uptake "
        "and genotoxicity assays — a particle-size question more than a classic absorption/"
        "metabolism question, which is why EFSA couldn't rule out concern even though bulk TiO2 "
        "itself is considered chemically inert."
    ),
    "sodium_nitrite": (
        ["dose_response", "hepatic_metabolism"],
        "The concern pathway is nitrite reacting with amines/amides from protein at high heat "
        "(or under acidic gastric conditions) to form N-nitroso compounds, which then require "
        "hepatic bioactivation (largely CYP-mediated) to become DNA-reactive. This is mechanistically "
        "why the vitamin-C mitigation tip works: ascorbate competes for the nitrosation reaction "
        "itself, blocking formation before metabolism is even relevant."
    ),
    "bha_bht": (
        ["hepatic_metabolism", "dose_response"],
        "Both are metabolized hepatically and excreted within about a day. BHA's 'reasonably "
        "anticipated' NTP carcinogen classification comes from forestomach tumors in rodent "
        "studies at high doses — rodents have a forestomach anatomical structure humans lack, "
        "which is part of why the human relevance of that specific finding is more debated than "
        "for some other entries here."
    ),
    "pfas_packaging": (
        ["bioaccumulation_half_life", "renal_clearance", "aggregate_exposure"],
        "This is the one entry where the usual 'liver/kidneys handle it in hours' story doesn't "
        "apply: PFAS's charged head group is actively reabsorbed by renal organic anion "
        "transporters instead of being excreted, giving serum half-lives measured in years "
        "rather than hours. That's mechanistically why 'forever chemical' isn't just a "
        "marketing phrase, and why aggregate lifetime exposure — not any single meal — is the "
        "relevant frame."
    ),
    "microplastics_bottled_water": (
        ["dose_response"],
        "The open toxicological question here is genuinely about fate, not just presence: what "
        "fraction of ingested microplastic particles cross the gut epithelium versus pass "
        "through unabsorbed is still an active research area — exactly why this entry carries "
        "the lowest concern level in the database despite the exposure route itself being "
        "well-documented."
    ),
    "dry_cleaning_perc": (
        ["hepatic_metabolism", "dose_response"],
        "PERC is metabolized via hepatic CYP2E1 (the same enzyme family as acrylamide and "
        "ethanol) to trichloroacetic acid, excreted renally over days; it's also partly exhaled "
        "unchanged since it's volatile — which is mechanistically why airing out a garment "
        "before wearing it measurably reduces the dose rather than being just a folk remedy."
    ),
    "lawn_pesticide_tracked_in": (
        ["aggregate_exposure", "dose_response"],
        "Different active ingredients (2,4-D, glyphosate, various pyrethroids) have very "
        "different clearance kinetics from each other, so this entry is really an aggregate "
        "exposure-*pathway* concern (tracked-in residue accumulating in carpet dust, then "
        "hand-to-mouth contact) rather than one compound's toxicokinetics — the shoes-off "
        "intervention addresses the pathway regardless of which specific product was used."
    ),
    "household_dust_reservoir": (
        ["aggregate_exposure", "bioaccumulation_half_life"],
        "Dust itself doesn't metabolize anything — it's a passive reservoir where several "
        "unrelated compound classes (flame retardants, lead, phthalates, pesticide residue) "
        "settle out of air and off product surfaces, then persist far longer indoors than they "
        "would outdoors (out of UV light and rain). That's why dust removal is one of the few "
        "single interventions touching multiple substance families in this database at once."
    ),
    "nonstick_cookware_ptfe": (
        ["dose_response"],
        "Intact PTFE is chemically and thermally stable at normal cooking temperatures — it "
        "isn't absorbed or metabolized. The fume-fever mechanism is acute inhalation of "
        "pyrolysis breakdown products released only above roughly 260°C (500°F), a threshold an "
        "empty pan on high heat reaches well before typical cooking temperatures with food or "
        "oil in the pan."
    ),
    "fragranced_laundry_products": (
        ["particle_deposition", "aggregate_exposure"],
        "This entry sits at the intersection of two pathways: inhaled VOCs off-gassing from the "
        "wash/dry cycle, and direct dermal contact from residue on fabric worn for hours — which "
        "is part of why it's tagged low concern individually but still contributes to a "
        "household's aggregate fragrance-chemical exposure alongside personal care products."
    ),
    "mold_indoor": (
        ["particle_deposition", "dose_response"],
        "For most people, symptoms are IgE-mediated allergic responses to inhaled spore/hyphal "
        "fragments (subject to the same size-dependent deposition physics as other airborne "
        "particles), not mycotoxin poisoning. True mycotoxicosis requires much higher, sustained "
        "exposure than typical household contact and is a distinct, much rarer clinical picture "
        "from the common allergic/irritant presentation."
    ),
    "hvac_filter_age": (
        ["particle_deposition"],
        "A filter's MERV rating describes what particle size it captures efficiently. An "
        "overdue filter doesn't just stop filtering well — the pressure drop across a clogged "
        "filter can reduce total airflow, which paradoxically cuts total air changes per hour "
        "along with filtration efficiency."
    ),
    "voc_off_gassing": (
        ["hepatic_metabolism", "dose_response"],
        "VOC off-gassing follows roughly first-order decay from a fresh material — highest "
        "emission immediately after installation/application, dropping over days to weeks. "
        "That's the physical reason 'ventilate for the first couple weeks' is the standard "
        "advice rather than an indefinite precaution."
    ),
    "low_humidity_dry_air": (
        ["dose_response"],
        "Low humidity doesn't introduce a new chemical exposure — the mechanism is desiccation "
        "of the nasal/respiratory mucociliary barrier, the body's primary first-line particle/"
        "pathogen clearance system. This entry is more 'reduced defense' than 'exposure' in the "
        "sense the rest of this database uses."
    ),
    "high_humidity": (
        ["particle_deposition", "dose_response"],
        "Above roughly 60% relative humidity, dust mite and mold growth rates increase sharply "
        "— this entry is really an upstream risk factor feeding the `mold_indoor` and "
        "dust-mite-allergen pathways rather than an exposure in its own right."
    ),
    "siloxanes": (
        ["bioaccumulation_half_life", "dose_response"],
        "D4/D5 are more persistent and bioaccumulative than most personal-care ingredients here "
        "(why the EU restricted D4 specifically) — lipophilic enough to partition into fatty "
        "tissue rather than being rapidly cleared, closer in that respect to PFAS's persistence "
        "story than to parabens' hours-long clearance, though via a different mechanism "
        "(passive partitioning, not transporter-mediated reabsorption)."
    ),
    "aluminum_antiperspirant": (
        ["renal_clearance", "dose_response"],
        "Only a small fraction of topically applied aluminum salts penetrates intact skin; "
        "what's absorbed is renally cleared like other aluminum compounds. Most people's larger "
        "absorbed dose is actually dietary (aluminum-containing food additives, cookware, "
        "antacids), part of why epidemiological evidence hasn't supported antiperspirant use "
        "specifically as a meaningful driver of health outcomes."
    ),
    "talc": (
        ["particle_deposition", "dose_response"],
        "The historical asbestos-contamination concern is a fiber-inhalation mechanism "
        "(asbestos fibers deposit and persist in lung/pleural tissue via the same small-particle "
        "physics as PM2.5, but are far more biopersistent). Asbestos-free talc's own risk "
        "profile — particularly for perineal use — involves a different, still-debated "
        "mechanism and has produced inconsistent epidemiological results."
    ),
    "retinyl_palmitate": (
        ["dose_response"],
        "The NTP finding was specifically a photocarcinogenesis interaction — accelerated tumor "
        "development under simultaneous intense UV exposure in mice — not a standalone toxicity "
        "finding. That's mechanistically why the concern is specific to UV-exposed daytime/"
        "sunscreen use rather than nighttime retinoid skincare, which has no UV co-exposure."
    ),
    "triclosan": (
        ["hepatic_metabolism", "dose_response"],
        "Triclosan is absorbed through skin/mucosa and hepatically glucuronidated/sulfated for "
        "renal and biliary excretion. The FDA's 2016/2017 action was driven less by a specific "
        "toxicity finding than by manufacturers failing to demonstrate it worked better than "
        "plain soap, combined with theoretical antibiotic-resistance-selection concerns from "
        "routine low-level exposure."
    ),
    "radon": (
        ["alpha_radiation", "dose_response"],
        "See the alpha-radiation concept above — radon's decay products deposit in the "
        "bronchial epithelium and emit short-range, high-energy alpha radiation there, which is "
        "mechanistically why inhalation (not ingestion, e.g. from well water) dominates its lung "
        "cancer risk, and why it's a fundamentally different hazard type than any chemical entry "
        "in this database."
    ),
    "lead_exposure": (
        ["bioaccumulation_half_life", "renal_clearance", "dose_response"],
        "Absorbed lead distributes between blood (half-life around 30 days), soft tissue, and "
        "bone, where it can persist for decades and slowly re-release into blood — especially "
        "during physiological states with active bone turnover like pregnancy, lactation, or "
        "osteoporosis. That's why past exposure can matter years later, and why 'no safe level' "
        "is the standard public-health framing rather than a dose threshold."
    ),
    "pm25_particulate": (
        ["particle_deposition", "aggregate_exposure"],
        "See the particle-deposition concept above — PM2.5's alveolar penetration is precisely "
        "why it's treated as higher-concern than PM10 despite PM10 being the more 'visible' "
        "pollutant; alveolar-deposited particles are also positioned to cross into systemic "
        "circulation more readily than particles cleared by the upper-airway mucociliary "
        "escalator."
    ),
    "chlorination_byproducts": (
        ["hepatic_metabolism", "dose_response", "aggregate_exposure"],
        "THMs form continuously in treated water as chlorine reacts with organic matter, so "
        "exposure is genuinely aggregate across drinking, cooking, and inhalation/dermal routes "
        "during showers (some THMs are volatile enough to off-gas from hot water) — not just an "
        "ingestion question, which is part of why an activated-carbon shower filter is sometimes "
        "recommended alongside a drinking-water filter."
    ),
    "nitrogen_dioxide_gas_stove": (
        ["particle_deposition", "dose_response"],
        "NO2 is a gas, not a particle, so it doesn't follow the same size-dependent deposition "
        "physics as PM2.5/PM10 — it's highly water-soluble and reacts primarily in the upper and "
        "central airways, the mechanism behind its respiratory-irritant and childhood-asthma "
        "associations, and why source control (a range hood) is more effective than any "
        "filtration approach aimed primarily at particles."
    ),
    "candle_incense_pm": (
        ["particle_deposition", "aggregate_exposure"],
        "Same size-dependent deposition physics as `pm25_particulate` (most candle/incense "
        "smoke particles fall in the fine/PM2.5 range), but from an intermittent indoor point "
        "source rather than ambient outdoor air — which is why ventilation during and shortly "
        "after use matters more here than it does for background outdoor PM2.5 you can't "
        "directly control."
    ),
}


def main():
    with open(PATH) as f:
        db = json.load(f)

    missing = [s["id"] for s in db["substances"] if s["id"] not in NOTES]
    assert not missing, f"No technical note mapped for: {missing}"

    concept_ids = {c["id"] for c in json.load(open(PATH.parent / "concepts.json"))["concepts"]}

    for s in db["substances"]:
        tags, note = NOTES[s["id"]]
        bad_tags = [t for t in tags if t not in concept_ids]
        assert not bad_tags, f"{s['id']} references unknown concept_tags: {bad_tags}"
        s["concept_tags"] = tags
        s["technical_note"] = note

    with open(PATH, "w") as f:
        json.dump(db, f, indent=2)
        f.write("\n")

    print(f"Patched concept_tags + technical_note on {len(db['substances'])} substances.")


if __name__ == "__main__":
    main()
