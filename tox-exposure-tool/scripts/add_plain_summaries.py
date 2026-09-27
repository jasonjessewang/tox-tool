"""Adds `summary_plain` -- the same summary in plain language -- to every substance in data/hazard_database.json.

The app's "Simple" detail level shows this instead of `summary`. The existing summaries read at a college level (median
Flesch-Kincaid grade about 15.6); these aim for grade 9 or below, in short sentences, without dropping the qualifier that matters
(how much, how often, how strong the evidence is). Nothing here adds a claim that `summary` does not already make: each one is a
rewording, and the test in the app (src/data/plainSummaries.test.ts) holds them to a reading level, a length and a calm vocabulary.

Kept as a script, like add_technical_notes.py, so the wording is reviewable and re-runnable. Editorial content: sources/sync_db.py
never touches it.
"""
import json
from pathlib import Path

PATH = Path(__file__).parent.parent / "data" / "hazard_database.json"

PLAIN = {
    "parabens": "Preservatives that keep cosmetics from spoiling. In lab studies they act a little like the hormone estrogen. Regulators say the amounts normally used are not a concern, but some people choose to limit them.",
    "phthalates": "Chemicals that make plastic flexible and help scent last. They can hide behind the word 'fragrance' on a label. Research links some of them to effects on hormones, and several groups rate them a higher concern than parabens.",
    "sodium_lauryl_sulfate": "Foaming cleansers found in shampoo and soap. They mostly irritate the skin or eyes and can dry the skin, especially with frequent use or on sensitive skin. They are not mainly a whole-body concern. SLES can carry traces of 1,4-dioxane from how it is made.",
    "formaldehyde_releasers": "Preservatives that slowly give off tiny amounts of formaldehyde to stop germs growing. At high, workplace-level exposure, formaldehyde is known to cause cancer. In people who have become sensitive to them, these preservatives can cause a skin rash.",
    "artificial_food_dyes": "Man-made colors used in cereal, pastries and drinks. Some studies link certain dyes to hyperactivity in sensitive children. Rules differ by country: the EU puts warning labels on some, and in 2025 the US FDA withdrew its approval of Red Dye 3 in food.",
    "added_sugar": "Sugar is not a poison. What matters is how much and how often. A large 2023 review in the BMJ linked a lot of sugar, especially from sweet drinks, to poorer heart and metabolic health, though most of the evidence was low quality. Its authors suggest keeping added sugar under about 25 grams a day.",
    "acrylamide": "Forms naturally in starchy foods when they are toasted, fried or baked at high heat and turn brown. It is a probable cancer-causing substance, based on animal studies at high doses. The amounts people eat are much lower.",
    "bpa": "Used in some hard plastics and in the lining of some cans. It acts on hormones, and it can move into food and drink, especially when heated.",
    "titanium_dioxide": "A whitener added to some candy, creamers and frosting. In 2021 European food-safety experts withdrew their finding that it is safe, because they could not rule out DNA damage from its very tiny particles. The EU banned it in food in 2022. The US FDA still allows it.",
    "sodium_nitrite": "Used to cure bacon, sausage and deli meat. When heated to high temperatures, especially with protein, it can form nitrosamines, which are probable cancer-causing substances. The cancer agency IARC puts processed meat in Group 1, which describes how strong the evidence is, not how big the effect is. Nitrite is one proposed reason.",
    "bha_bht": "Man-made antioxidants that stop fats going rancid in cereal, snack bars and baked goods. The US National Toxicology Program lists BHA as 'reasonably anticipated to be a human carcinogen' (likely to cause cancer in people), based on animal data. For BHT the evidence is more mixed.",
    "pfas_packaging": "'Forever chemicals' that make packaging resist grease and water: fast-food wrappers, some microwave popcorn bags, takeout boxes and some non-stick pans. They last a very long time in the body and the environment, and research links them to a range of health effects. The US FDA and several states are phasing out PFAS in food packaging, including newer 'short-chain' types like GenX.",
    "mold_indoor": "Mold can grow indoors after water damage, damp air or poor airflow. It can cause breathing problems and allergic reactions. In some people it is blamed for a wider mix of symptoms, linked to substances some molds make (mycotoxins). Heating and cooling systems are common places for it to hide.",
    "hvac_filter_age": "A clogged or overdue air filter sends dust and tiny particles around the home, and can let germs and mold grow. That makes indoor air worse.",
    "voc_off_gassing": "New paint, furniture and carpet, and some cleaning and air-freshening products, give off gases called VOCs. They add to indoor air pollution. In some people they cause headaches or an irritated nose and throat.",
    "low_humidity_dry_air": "Very dry indoor air, common with heating or air conditioning, can dry out the lining of your nose and throat. That makes it easier for irritants and germs in the air to get past your natural defenses.",
    "high_humidity": "Air that stays humid, over about 60%, helps dust mites and mold grow. That adds to what you breathe in.",
    "siloxanes": "Silicone-based ingredients that make hair and skin products feel smooth and silky. The EU lists D4 as a 'substance of very high concern' because it may affect hormones and lasts in the environment, and it restricts it. D5 is more debated. Dimethicone itself, the long-chain form, is thought to be a lower concern than the ring-shaped D4 and D5.",
    "aluminum_antiperspirant": "Aluminum salts block sweat glands in antiperspirants. People often raise a link to breast cancer, but the larger body of research has not supported it so far, and studies continue. Skin irritation is the better-established concern, especially on freshly shaved skin.",
    "talc": "A mineral used as a powder in some cosmetics and body powders. The old worry was contamination with asbestos, a known cancer-causing substance, found in some of the same deposits. Studies on whether talc without asbestos can cause cancer, for example with genital use, have had mixed results.",
    "retinyl_palmitate": "A form of vitamin A added to some sunscreens and moisturizers. A US National Toxicology Program study in mice found skin tumors appeared faster when it was combined with strong UV light. This has not been confirmed in people, and regulators have not restricted it, but it is why some sunscreen guides suggest checking for it in daily-wear products.",
    "triclosan": "An antibacterial ingredient once common in liquid hand soap. In 2016-2017 the US FDA banned it, with 18 other antibacterial ingredients, from over-the-counter wash products. There was not enough evidence that it works better than plain soap, and there were questions about hormone effects and antibiotic resistance. It can still turn up in some toothpaste and cosmetics.",
    "radon": "A natural radioactive gas that seeps up from soil and rock into homes, especially basements. After smoking, it is the second leading cause of lung cancer in the US, according to the EPA and the Surgeon General. You cannot see or smell it, so the only way to know is to test.",
    "lead_exposure": "Homes built before 1978 in the US may have lead paint, and some older water pipes still contain lead. No safe blood lead level has been found, especially for children's developing brains. Adults are affected too at high exposure.",
    "pm25_particulate": "Tiny particles in the air, 2.5 microns wide or smaller, from traffic, wildfire smoke, cooking and industry. They reach deep into the lungs and the bloodstream, and are linked to heart and lung effects. The EPA tightened its yearly PM2.5 standard in 2024. You can log a reading from a local monitor, the AirNow app or your own sensor under Journey, then Air.",
    "chlorination_byproducts": "Chlorine that disinfects tap water can react with natural material in the water and form byproducts called THMs. The EPA regulates them, and US tap water is generally kept below the limit, though some systems have gone over at times. Long-term high exposure has been studied for a possible small link to bladder cancer.",
    "nitrogen_dioxide_gas_stove": "Gas and propane stoves give off nitrogen dioxide and other gases from burning, especially without ventilation. In homes with a gas stove and no range hood use, indoor levels can go above outdoor air standards. It is linked to airway irritation and, in children, a higher chance of asthma.",
    "candle_incense_pm": "Burning candles and incense releases fine particles. Heavily scented candles can also release some of the same VOC gases as air fresheners. Now and then is a small contribution. Daily heavy use in a small, closed room adds up much like other indoor sources of fine particles.",
    "microplastics_bottled_water": "Bottled water, and food reheated in plastic, can shed tiny plastic particles, especially with heat or when thin single-use bottles are reused. What these particles do to health at everyday amounts is still being studied. The concern here is a precaution, not a proven harm.",
    "dry_cleaning_perc": "Perchloroethylene, or PERC, is the most common dry-cleaning solvent. It can give off fumes from freshly cleaned clothes kept in a closed closet or worn soon after pickup. The better-established concern is for dry-cleaning workers. Residue on clothes at home is a much smaller, precautionary-level exposure.",
    "lawn_pesticide_tracked_in": "Lawn and garden chemicals do not stay outside. Studies of house dust and carpet keep finding them, carried in on shoes and pet paws. Indoors they last much longer, because there is no sunlight or rain. It is an easily overlooked source, because the spraying happens outside.",
    "household_dust_reservoir": "House dust is more than dirt. It builds up flame retardants from furniture and electronics, lead from old paint, pesticides, and phthalates that have settled out of the air or worn off products. Regular dusting and cleaning is one of the few steps that lowers exposure to several unrelated chemical groups at once.",
    "nonstick_cookware_ptfe": "Nonstick coatings (PTFE) are stable at normal cooking temperatures. An empty pan heated above about 500°F (260°C) can give off fumes that harm pet birds and can cause a short flu-like illness in people. Scratched or worn coatings are the other main concern.",
    "fragranced_laundry_products": "Scented detergent, fabric softener and dryer sheets release VOC gases while you wash and dry. Much of it is vented outside from the dryer, but some lingers on fabric and in the laundry room. The scent also stays on clothes and bedding that touch your skin for hours.",
    "bisphenol_analogs": "BPS, BPF and BPAF are close chemical relatives of BPA. They are often swapped in so a product can say 'BPA-free', for the same uses: can linings, plastics and receipt paper. Studies that compare them directly with BPA find similar effects on hormones, not an improvement. Toxicologists call this pattern 'regrettable substitution'.",
    "phenoxyethanol": "A preservative often used in 'paraben-free' cosmetics. It works well and, at the amounts normally used in cosmetics, is considered a lower concern than some other preservatives. But it is its own chemical with its own limits, not a neutral stand-in. The advice for parabens applies here too: vary your products instead of relying on one for years.",
}

# Two "What you can do" tips used shorthand that only a specialist would know. They are reworded in place: tips are keyed by
# substance and position, so the text can change without disturbing anyone's "keeping this" or "done" decisions.
TIP_FIXES = [
    ("parabens", 0, "minimizing EDC exposure", "limiting hormone-disrupting chemicals (EDCs)"),
    ("chlorination_byproducts", 0, "for your system's THM levels", "for your system's THM (trihalomethane) levels"),
]

# The long summary of PM2.5 pointed at "Environment > Air Quality", a place the app no longer has; the Air log is under Your Journey.
FIXES = {
    "pm25_particulate": ("under Environment → Air Quality to have it scored", "under Journey › Air to have it scored"),
}


def main():
    with open(PATH) as f:
        db = json.load(f)

    ids = [s["id"] for s in db["substances"]]
    missing = [i for i in ids if i not in PLAIN]
    extra = [i for i in PLAIN if i not in ids]
    assert not missing, f"No plain summary written for: {missing}"
    assert not extra, f"Plain summary for a substance that does not exist: {extra}"

    for s in db["substances"]:
        s["summary_plain"] = PLAIN[s["id"]]
        if s["id"] in FIXES:
            old, new = FIXES[s["id"]]
            assert s["summary"].count(old) == 1 or new in s["summary"], f"{s['id']}: expected text not found"
            s["summary"] = s["summary"].replace(old, new)

    by_id = {s["id"]: s for s in db["substances"]}
    for sid, i, old, new in TIP_FIXES:
        tip = by_id[sid]["mitigation_tips"][i]
        assert old in tip or new in tip, f"{sid} tip {i}: expected text not found"
        by_id[sid]["mitigation_tips"][i] = tip.replace(old, new)

    with open(PATH, "w") as f:
        json.dump(db, f, indent=2)
        f.write("\n")

    print(f"Added summary_plain to {len(db['substances'])} substances.")


if __name__ == "__main__":
    main()
