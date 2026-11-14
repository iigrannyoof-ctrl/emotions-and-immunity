# The Mind–Immunity Connection

A Quarto website exploring depressive symptoms and hs-CRP in NHANES 2017–2018 adults. All results are based on the original CDC files and are descriptive, unweighted, and observational.

> The existing GitHub repository is `r-devcontainer`, not `emotions-and-immunity`. This project does not change the Git remote. Rename the repository on GitHub if `emotions-and-immunity` is the desired repository name.

## Rebuild the data

Requires R and the `haven`, `dplyr`, `readr`, `jsonlite`, `ggplot2`, `plotly`, `tidyverse`, and `htmltools` packages. Install missing packages from CRAN, then run:

```sh
Rscript scripts/prepare_data.R
```

The script downloads and caches the three original CDC SAS transport files in `data/raw/`, joins them on `SEQN`, keeps complete adults aged 20 or older with valid PHQ-9 item codes, and writes:

- `data/processed/nhanes_adult_clean.csv` — the reproducible analysis dataset.
- `data/processed/explore_data.json` — the same real observations for browser-only filtering on static hosting.

It stops if fewer than 1,000 complete adults remain. It does not impute or create participant records.

## Render and preview

From the repository root:

```sh
quarto render
quarto preview --host 0.0.0.0 --port 4200 --no-browser
```

The rendered site is in `_site/`; the preview listens on port `4200`. To publish on GitHub Pages, push the source and processed data, then configure Pages to deploy the rendered `_site/` output (for example, with a GitHub Actions Quarto Pages workflow). Publication is not performed by rendering alone.

## Interpretation

PHQ-9 is a self-reported symptom screener, not a measure of all emotions or a diagnosis. hs-CRP is a nonspecific inflammation marker, not a measurement of immune strength or recovery speed. This site's charts show unweighted descriptive results from its complete-case sample; they are not survey-weighted adjusted estimates and do not support causal conclusions.
