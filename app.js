const form = document.querySelector("#project-form");
const figureList = document.querySelector("#figure-list");
const figureTemplate = document.querySelector("#figure-template");
const panelTemplate = document.querySelector("#panel-template");
const addButton = document.querySelector("#add-figure");
const submitButton = document.querySelector("#create-package");
const statusLine = document.querySelector("#status");
const supportInput = document.querySelector("#support-files");
const supportStatus = document.querySelector("#support-status");

const MAX_FILE_BYTES = 40 * 1024 * 1024;
const MAX_TOTAL_BYTES = 120 * 1024 * 1024;

function setStatus(message, error = false) {
  statusLine.textContent = message;
  statusLine.classList.toggle("error", error);
}

function updatePreview(card) {
  const file = card.querySelector(".figure-file").files[0];
  const image = card.querySelector(".figure-preview");
  const box = card.querySelector(".preview-box");
  if (box.dataset.url) URL.revokeObjectURL(box.dataset.url);
  image.removeAttribute("src");
  box.classList.remove("has-image");
  if (!file || !file.type.startsWith("image/") || file.type === "image/tiff") return;
  const url = URL.createObjectURL(file);
  box.dataset.url = url;
  image.src = url;
  box.classList.add("has-image");
}

function renumber() {
  const cards = [...figureList.querySelectorAll(".figure-card")];
  cards.forEach((card, index) => {
    card.dataset.figureNumber = String(index + 1);
    card.querySelector(".figure-label").textContent = `FIGURE ${index + 1}`;
    const file = card.querySelector(".figure-file").files[0];
    card.querySelector("h3").textContent = file?.name || "図を選択してください";
    card.querySelector(".remove").hidden = cards.length === 1;
    card.querySelector(".move-up").disabled = index === 0;
    card.querySelector(".move-down").disabled = index === cards.length - 1;
  });
}

function addPanel(card) {
  if (card.querySelectorAll(".panel-card").length >= 20) return;
  const fragment = panelTemplate.content.cloneNode(true);
  fragment.querySelector(".remove-panel").addEventListener("click", event => {
    event.target.closest(".panel-card").remove();
  });
  card.querySelector(".panel-list").appendChild(fragment);
}

function addFigure() {
  if (figureList.children.length >= 30) return;
  const fragment = figureTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".figure-card");
  const figureFile = card.querySelector(".figure-file");
  const rawInput = card.querySelector(".raw-data-files");

  figureFile.addEventListener("change", () => {
    updatePreview(card);
    renumber();
  });
  rawInput.addEventListener("change", () => {
    card.querySelector(".raw-data-status").textContent = rawInput.files.length
      ? `${rawInput.files.length}個の元データを選択済み`
      : "Excel / CSV / TSV / TXT / JSON / ZIP";
  });
  card.querySelector(".remove").addEventListener("click", () => {
    const box = card.querySelector(".preview-box");
    if (box.dataset.url) URL.revokeObjectURL(box.dataset.url);
    card.remove();
    renumber();
  });
  card.querySelector(".move-up").addEventListener("click", () => {
    const previous = card.previousElementSibling;
    if (previous) figureList.insertBefore(card, previous);
    renumber();
  });
  card.querySelector(".move-down").addEventListener("click", () => {
    const next = card.nextElementSibling;
    if (next) figureList.insertBefore(next, card);
    renumber();
  });
  card.querySelector(".add-panel").addEventListener("click", () => addPanel(card));
  figureList.appendChild(fragment);
  renumber();
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1]);
    reader.onerror = () => reject(new Error(`${file.name}を読み取れませんでした。`));
    reader.readAsDataURL(file);
  });
}

async function encodeFile(file) {
  if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name}は40 MBを超えています。`);
  return {
    filename: file.name,
    mime_type: file.type,
    base64: await fileToBase64(file),
  };
}

function collectFields(container, attribute) {
  return Object.fromEntries(
    [...container.querySelectorAll(`[${attribute}]`)].map(element => [
      element.getAttribute(attribute),
      element.value.trim(),
    ])
  );
}

function collectPanels(card) {
  return [...card.querySelectorAll(".panel-card")].map(panel => collectFields(panel, "data-panel"));
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

addButton.addEventListener("click", addFigure);
addFigure();

supportInput.addEventListener("change", () => {
  supportStatus.textContent = supportInput.files.length
    ? `${supportInput.files.length}個の補足ファイルを選択済み`
    : "PDF / Word / Excel / CSV / TSV / PowerPoint / ZIP";
});

form.addEventListener("submit", async event => {
  event.preventDefault();
  const values = new FormData(form);
  const keywords = String(values.get("keywords") || "").trim();
  const summary = String(values.get("summary") || "").trim();
  if (!keywords && !summary) return setStatus("キーワードまたは研究概要を入力してください。", true);

  const cards = [...figureList.querySelectorAll(".figure-card")];
  if (!cards.every(card => card.querySelector(".figure-file").files[0])) {
    return setStatus("すべてのFigure欄で図を選択してください。", true);
  }

  const allFiles = [
    ...cards.flatMap(card => [
      card.querySelector(".figure-file").files[0],
      ...card.querySelector(".raw-data-files").files,
    ]),
    ...supportInput.files,
  ];
  const totalBytes = allFiles.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > MAX_TOTAL_BYTES) {
    return setStatus("ファイル合計は120 MB以内にしてください。大きな元データは分割してください。", true);
  }

  submitButton.disabled = true;
  setStatus("図、条件、数値、元データを証拠台帳へまとめています…");
  try {
    const figures = [];
    for (const card of cards) {
      const encodedFigure = await encodeFile(card.querySelector(".figure-file").files[0]);
      const rawDataFiles = [];
      for (const file of card.querySelector(".raw-data-files").files) {
        rawDataFiles.push(await encodeFile(file));
      }
      figures.push({
        ...encodedFigure,
        title: card.querySelector(".figure-title").value.trim(),
        manuscript_role: card.querySelector(".figure-role").value.trim(),
        caption_draft: card.querySelector(".figure-caption").value.trim(),
        conditions: collectFields(card, "data-condition"),
        evidence: collectFields(card, "data-evidence"),
        panels: collectPanels(card),
        raw_data_files: rawDataFiles,
      });
    }

    const supportingFiles = [];
    for (const file of supportInput.files) supportingFiles.push(await encodeFile(file));

    const scalarNames = [
      "journal", "working_title", "author_information", "keywords", "summary",
      "material_preparation", "common_reaction_method", "analytical_instruments",
      "calculation_definitions", "statistics_method", "acknowledgements",
      "funding_information", "conflicts_of_interest", "data_availability",
    ];
    const payload = Object.fromEntries(scalarNames.map(name => [name, values.get(name)]));
    payload.figures = figures;
    payload.supporting_files = supportingFiles;

    const response = await fetch("/api/package", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      let message = `ZIPを作成できませんでした（HTTP ${response.status}）。`;
      try {
        const error = await response.json();
        message = error.error || message;
      } catch {
        message += " ファイル合計を確認してください。";
      }
      throw new Error(message);
    }
    const disposition = response.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="([^"]+)"/);
    downloadBlob(await response.blob(), match?.[1] || "RSC_Project_v2.zip");
    setStatus("証拠台帳付きZIPを保存しました。このZIPをChatGPTへアップロードしてください。");
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    submitButton.disabled = false;
  }
});

