export interface LiteratureItem {
  pmid: string;
  topic: string;
  title: string;
  journal: string;
  year: string;
}

// Real PubMed records retrieved via NCBI E-utilities, bundled as the offline fallback.
export const LITERATURE_FALLBACK: LiteratureItem[] = [
  {
    "pmid": "42381177",
    "topic": "Microplastics",
    "title": "Bridging environmental pollution and immune dysregulation: How microplastics disrupt gut homeostasis to promote allergic diseases.",
    "journal": "Virulence",
    "year": "2026"
  },
  {
    "pmid": "42385330",
    "topic": "PFAS",
    "title": "The transfer of per- and polyfluoroalkyl substances (PFAS) from mother to child: Comparison between maternal and cord blood in an Italian cohort.",
    "journal": "J Pharm Biomed Anal",
    "year": "2026"
  },
  {
    "pmid": "42388454",
    "topic": "PFAS",
    "title": "Per- and polyfluoroalkyl substances in commercially important marine species of fish and shellfish from Alaska and implications for human exposure.",
    "journal": "Toxicol Rep",
    "year": "2026"
  },
  {
    "pmid": "42462646",
    "topic": "Exposome",
    "title": "A novel targeted high-throughput workflow for serum chemical mixture profiling in population exposome-wide association studies.",
    "journal": "Talanta",
    "year": "2027"
  },
  {
    "pmid": "42658034",
    "topic": "Air pollution",
    "title": "Endothelial function in relation to low-level chronic residential air pollution in a general population: a cohort study.",
    "journal": "Blood Press",
    "year": "2026"
  },
  {
    "pmid": "42625676",
    "topic": "Air pollution",
    "title": "Household and occupational air pollution, and demographic drivers of COPD: a hospital-based cross-sectional study in a high-pollution urban setting.",
    "journal": "J Environ Health Sci Eng",
    "year": "2026"
  },
  {
    "pmid": "42497967",
    "topic": "Endocrine disruptors",
    "title": "Transcriptomic analysis identifies key genes and mechanisms involved in dibutyl phthalate-induced alteration in hepatic stellate cells.",
    "journal": "Toxicol In Vitro",
    "year": "2026"
  }
];
