required_packages <- c("haven", "dplyr", "readr", "jsonlite")

check_data_packages <- function() {
  missing <- required_packages[!vapply(required_packages, requireNamespace, logical(1), quietly = TRUE)]
  if (length(missing)) {
    stop(
      "Missing R package(s): ", paste(missing, collapse = ", "),
      ". Install them with install.packages(c(",
      paste(sprintf('"%s"', missing), collapse = ", "), ")).",
      call. = FALSE
    )
  }
}

prepare_nhanes_data <- function(
  raw_dir = file.path("data", "raw"),
  processed_dir = file.path("data", "processed")
) {
  check_data_packages()
  dir.create(raw_dir, recursive = TRUE, showWarnings = FALSE)
  dir.create(processed_dir, recursive = TRUE, showWarnings = FALSE)

  files <- c(
    DEMO_J = "https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/DEMO_J.XPT",
    DPQ_J = "https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/DPQ_J.XPT",
    HSCRP_J = "https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/HSCRP_J.XPT"
  )

  for (name in names(files)) {
    destination <- file.path(raw_dir, paste0(name, ".XPT"))
    if (!file.exists(destination) || file.info(destination)$size == 0) {
      message("Downloading official CDC file: ", basename(destination))
      status <- tryCatch(
        utils::download.file(files[[name]], destination, mode = "wb", quiet = FALSE),
        error = function(e) {
          unlink(destination)
          stop("Could not download ", files[[name]], ": ", conditionMessage(e), call. = FALSE)
        }
      )
      if (!identical(status, 0L) || !file.exists(destination) || file.info(destination)$size == 0) {
        unlink(destination)
        stop("CDC download did not produce a valid file: ", files[[name]], call. = FALSE)
      }
    }
  }

  demo <- haven::read_xpt(file.path(raw_dir, "DEMO_J.XPT"))
  dpq <- haven::read_xpt(file.path(raw_dir, "DPQ_J.XPT"))
  hscrp <- haven::read_xpt(file.path(raw_dir, "HSCRP_J.XPT"))

  required_demo <- c("SEQN", "RIDAGEYR", "RIAGENDR")
  phq_items <- sprintf("DPQ%03d", seq(10, 90, 10))
  required_hscrp <- c("SEQN", "LBXHSCRP")
  for (check in list(
    DEMO_J = list(data = demo, columns = required_demo),
    DPQ_J = list(data = dpq, columns = c("SEQN", phq_items)),
    HSCRP_J = list(data = hscrp, columns = required_hscrp)
  )) {
    missing <- setdiff(check$columns, names(check$data))
    if (length(missing)) {
      stop("Expected column(s) missing from CDC XPT data: ", paste(missing, collapse = ", "), call. = FALSE)
    }
  }

  for (item in list(DEMO_J = demo, DPQ_J = dpq, HSCRP_J = hscrp)) {
    if (anyDuplicated(item$SEQN)) {
      stop("Duplicate SEQN values found in an original CDC file; refusing an ambiguous join.", call. = FALSE)
    }
  }

  joined <- demo |>
    dplyr::select(dplyr::all_of(required_demo)) |>
    dplyr::inner_join(
      dpq |> dplyr::select(SEQN, dplyr::all_of(phq_items)),
      by = "SEQN",
      relationship = "one-to-one"
    ) |>
    dplyr::inner_join(
      hscrp |> dplyr::select(dplyr::all_of(required_hscrp)),
      by = "SEQN",
      relationship = "one-to-one"
    )

  joined <- joined |>
    dplyr::filter(
      RIDAGEYR >= 20,
      RIAGENDR %in% c(1, 2),
      dplyr::if_all(dplyr::all_of(phq_items), ~ !is.na(.x) & .x %in% 0:3),
      !is.na(LBXHSCRP),
      is.finite(LBXHSCRP)
    ) |>
    dplyr::mutate(
      phq9_score = rowSums(dplyr::across(dplyr::all_of(phq_items))),
      phq9_category = cut(
        phq9_score,
        breaks = c(-1, 4, 9, 14, 19, 27),
        labels = c("Minimal", "Mild", "Moderate", "Moderately severe", "Severe"),
        ordered_result = TRUE
      ),
      sex = dplyr::recode(as.character(RIAGENDR), `1` = "Male", `2` = "Female"),
      age_group = cut(
        RIDAGEYR,
        breaks = c(19, 39, 59, Inf),
        labels = c("20–39", "40–59", "60+"),
        ordered_result = TRUE
      ),
      elevated_hscrp = LBXHSCRP > 3
    ) |>
    dplyr::transmute(
      age = as.integer(RIDAGEYR),
      age_group = as.character(age_group),
      sex,
      phq9_score = as.integer(phq9_score),
      phq9_category = as.character(phq9_category),
      hs_crp_mg_l = as.numeric(LBXHSCRP),
      elevated_hscrp
    ) |>
    dplyr::arrange(age, phq9_score)

  n <- nrow(joined)
  if (n < 1000) {
    stop(
      "Only ", n, " complete adult participants remain after the specified CDC joins and exclusions; ",
      "at least 1,000 are required. No data were fabricated.",
      call. = FALSE
    )
  }

  readr::write_csv(joined, file.path(processed_dir, "nhanes_adult_clean.csv"))
  export <- joined |>
    dplyr::transmute(
      age,
      age_group,
      sex,
      phq9_score,
      phq9_category,
      hs_crp_mg_l,
      elevated_hscrp
    )
  jsonlite::write_json(
    export,
    file.path(processed_dir, "explore_data.json"),
    dataframe = "rows",
    auto_unbox = TRUE,
    na = "null",
    digits = NA,
    pretty = FALSE
  )

  message("Saved ", n, " complete adult participants from NHANES 2017–2018.")
  message("Cleaned data: ", file.path(processed_dir, "nhanes_adult_clean.csv"))
  message("Static exploration data: ", file.path(processed_dir, "explore_data.json"))
  invisible(joined)
}

read_clean_data <- function(path = file.path("data", "processed", "nhanes_adult_clean.csv")) {
  if (!file.exists(path)) {
    stop(
      "Cleaned NHANES data not found at ", path,
      ". Run Rscript scripts/prepare_data.R first.",
      call. = FALSE
    )
  }
  readr::read_csv(path, show_col_types = FALSE, col_types = readr::cols(
    age = readr::col_integer(),
    age_group = readr::col_character(),
    sex = readr::col_character(),
    phq9_score = readr::col_integer(),
    phq9_category = readr::col_character(),
    hs_crp_mg_l = readr::col_double(),
    elevated_hscrp = readr::col_logical()
  ))
}

if (sys.nframe() == 0L) {
  prepare_nhanes_data()
}
