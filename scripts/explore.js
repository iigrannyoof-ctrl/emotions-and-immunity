(() => {
  "use strict";

  const categories = ["Minimal", "Mild", "Moderate", "Moderately severe", "Severe"];
  const colors = ["#897be0", "#6e91e5", "#5572c8", "#4855a5", "#413a78"];
  const $ = (id) => document.getElementById(id);
  let observations = [];

  function number(value) {
    return new Intl.NumberFormat("en-US").format(value);
  }

  function median(values) {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function filteredRows() {
    const age = $("age-filter").value;
    const sex = $("sex-filter").value;
    const severity = $("severity-filter").value;
    return observations.filter((row) =>
      (age === "all" || row.age_group === age) &&
      (sex === "all" || row.sex === sex) &&
      (severity === "all" || row.phq9_category === severity)
    );
  }

  function groupRows(rows) {
    return categories.map((category) => {
      const members = rows.filter((row) => row.phq9_category === category);
      const elevated = members.filter((row) => row.elevated_hscrp).length;
      return {
        category,
        n: members.length,
        elevated,
        pct: members.length ? (100 * elevated) / members.length : null,
        median: median(members.map((row) => row.hs_crp_mg_l))
      };
    }).filter((group) => group.n > 0);
  }

  function updateSummary(rows, groups) {
    const elevated = rows.filter((row) => row.elevated_hscrp).length;
    const center = median(rows.map((row) => row.hs_crp_mg_l));
    $("filtered-n").textContent = number(rows.length);
    $("filtered-elevated").textContent = rows.length ? `${(100 * elevated / rows.length).toFixed(1)}%` : "—";
    $("filtered-median").textContent = center === null ? "—" : `${center.toFixed(2)} mg/L`;

    const body = $("group-statistics");
    body.replaceChildren();
    if (!groups.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 4;
      td.textContent = "No participants match these filters.";
      tr.append(td);
      body.append(tr);
      return;
    }
    for (const group of groups) {
      const tr = document.createElement("tr");
      const cells = [
        group.category,
        number(group.n),
        `${group.pct.toFixed(1)}% (${number(group.elevated)})`,
        `${group.median.toFixed(2)}`
      ];
      for (const value of cells) {
        const td = document.createElement("td");
        td.textContent = value;
        tr.append(td);
      }
      body.append(tr);
    }
  }

  function drawChart(rows, groups) {
    const chart = $("interactive-chart");
    if (!chart || typeof Plotly === "undefined") return;
    const view = document.querySelector('input[name="chart-view"]:checked').value;
    const empty = rows.length === 0;
    const traces = view === "scatter"
      ? [{
          type: "scatter",
          mode: "markers",
          x: rows.map((row, index) => row.phq9_score + (((index * 37) % 101) / 100 - 0.5) * 0.24),
          y: rows.map((row) => row.hs_crp_mg_l),
          text: rows.map((row) =>
            `PHQ-9 score: ${row.phq9_score}<br>hs-CRP: ${row.hs_crp_mg_l.toFixed(2)} mg/L` +
            `<br>Age: ${row.age}<br>Sex: ${row.sex}<br>Group: ${row.phq9_category}`
          ),
          hovertemplate: "%{text}<extra></extra>",
          marker: { color: "#897be0", opacity: 0.42, size: 6 },
          name: "Participants"
        }]
      : [{
          type: "bar",
          x: groups.map((group) => group.category),
          y: groups.map((group) => group.pct),
          text: groups.map((group) => `${group.pct.toFixed(1)}%<br>n = ${number(group.n)}`),
          textposition: "outside",
          customdata: groups.map((group) => [group.n, group.elevated, group.median]),
          hovertemplate: "%{x}<br>% above 3 mg/L: %{y:.1f}%<br>Participants: %{customdata[0]}<br>Above threshold: %{customdata[1]}<br>Median hs-CRP: %{customdata[2]:.2f} mg/L<extra></extra>",
          marker: { color: groups.map((group) => colors[categories.indexOf(group.category)]) },
          name: "Above 3 mg/L"
        }];

    const layout = {
      autosize: true,
      margin: { l: 70, r: 24, b: 88, t: 28 },
      paper_bgcolor: "rgba(255,255,255,0)",
      plot_bgcolor: "rgba(255,255,255,0)",
      font: { family: "system-ui, sans-serif", color: "#403b60" },
      hoverlabel: { bgcolor: "white", bordercolor: "#897be0" },
      xaxis: {
        title: view === "scatter" ? "PHQ-9 depressive symptom score (0–27)" : "PHQ-9 symptom-severity group",
        range: view === "scatter" ? [-0.7, 27.7] : undefined,
        dtick: view === "scatter" ? 3 : undefined,
        gridcolor: "#e8e4f2",
        zeroline: false
      },
      yaxis: view === "scatter"
        ? { title: "hs-CRP concentration (mg/L, log10 scale)", type: "log", gridcolor: "#e8e4f2" }
        : { title: "Participants with hs-CRP > 3 mg/L (%)", range: [0, 100], ticksuffix: "%", gridcolor: "#e8e4f2" },
      showlegend: false,
      annotations: empty ? [{
        text: "No participants match these filters.",
        showarrow: false,
        x: 0.5,
        y: 0.5,
        xref: "paper",
        yref: "paper",
        font: { size: 16, color: "#5c5878" }
      }] : []
    };
    Plotly.react(chart, traces, layout, { responsive: true, displaylogo: false });
  }

  function update() {
    const rows = filteredRows();
    const groups = groupRows(rows);
    updateSummary(rows, groups);
    drawChart(rows, groups);
  }

  async function initialize() {
    if (!$("age-filter") || !$("interactive-chart") || typeof Plotly === "undefined") return;
    const status = $("explore-status");
    try {
      const response = await fetch("data/processed/explore_data.json");
      if (!response.ok) throw new Error(`Data request failed (HTTP ${response.status})`);
      observations = await response.json();
      if (!Array.isArray(observations) || observations.length < 1000) {
        throw new Error("The participant export is missing or contains fewer than 1,000 records.");
      }
      for (const id of ["age-filter", "sex-filter", "severity-filter"]) $(id).addEventListener("change", update);
      document.querySelectorAll('input[name="chart-view"]').forEach((input) => input.addEventListener("change", update));
      $("reset-filters").addEventListener("click", () => {
        $("age-filter").value = "all";
        $("sex-filter").value = "all";
        $("severity-filter").value = "all";
        document.querySelector('input[name="chart-view"][value="scatter"]').checked = true;
        update();
      });
      status.textContent = `Loaded ${number(observations.length)} real, complete adult participants from NHANES 2017–2018.`;
      status.classList.add("status-ready");
      update();
    } catch (error) {
      status.textContent = `Could not load the NHANES participant data: ${error.message}`;
      status.classList.add("status-error");
    }
  }

  window.addEventListener("load", initialize, { once: true });
})();
