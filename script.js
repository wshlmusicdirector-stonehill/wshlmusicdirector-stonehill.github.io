// ==========================================
// GOOGLE SHEETS CONFIGURATION
// ==========================================

const SPREADSHEET_ID = "1wn_fXlBOQ8x0TS9h_1XzJ1bYr4Xq_2_GHeo8cHkkhjE";

const API_KEY = "AIzaSyBZmGEyMt4siOZcgv0_z6MjlNWbBLxiq3c";

const SHEETS = {
  hardDrive: "Hard_Drive_Inventory",
  cd: "CD_Inventory"
};

const PAGE_SIZE = 25;


// ==========================================
// GLOBAL VARIABLES
// ==========================================

let inventory = [];

let currentPage = 1;
let totalPages = 1;

let sortBy = "title";
let sortDirection = "asc";


// ==========================================
// LOAD WEBSITE
// ==========================================

document.addEventListener("DOMContentLoaded", async function() {

  document.getElementById("searchButton").onclick = () => searchMusic(1);
  document.getElementById("clearButton").onclick = clearSearch;
  document.getElementById("storage").addEventListener("change", () => {
  searchMusic(1);
});

  document.getElementById("previousButton").onclick = () => changePage(-1);
  document.getElementById("nextButton").onclick = () => changePage(1);
  document.getElementById("goButton").onclick = jumpToPage;

  document.querySelectorAll(".sort-button").forEach(button => {
    button.onclick = () => sortResults(button.dataset.sort);
  });

  document.querySelectorAll("#searchInput, #artistFilter, #albumFilter, #genreFilter, #yearFilter")
    .forEach(input => {
      input.addEventListener("keydown", event => {
        if (event.key === "Enter") searchMusic(1);
      });
    });

  document.getElementById("pageInput").addEventListener("keydown", event => {
    if (event.key === "Enter") jumpToPage();
  });

  await loadInventory();

});


// ==========================================
// GOOGLE SHEETS API
// ==========================================

async function fetchSheet(sheetName) {

  const range = encodeURIComponent(`'${sheetName}'!A:ZZ`);

  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?key=${API_KEY}`;

  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Could not retrieve spreadsheet data.");
  }

  const data = await response.json();

  return data.values || [];

}


// ==========================================
// CONVERT SHEET DATA INTO RECORDS
// ==========================================

function convertSheetToRecords(rows, storageType) {

  if (!rows.length) return [];

  const headers = rows[0].map(header =>
    String(header).trim().toLowerCase()
  );

  function findColumn(names) {
    return headers.findIndex(header =>
      names.includes(header)
    );
  }

  const columns = {
    title: findColumn(["title", "track title", "song title"]),
    artist: findColumn(["artist", "track artist"]),
    album: findColumn(["album", "album title"]),
    genre: findColumn(["genre"]),
    year: findColumn(["year", "release year"]),
    length: findColumn(["length", "duration", "track length"]),
    fullPath: findColumn(["full path"])
  };

  if (columns.title === -1 || columns.artist === -1) {
    throw new Error(`Missing Title or Artist column in ${storageType} inventory.`);
  }

  return rows.slice(1).map(row => ({

    title: String(row[columns.title] || "").trim(),

    artist: String(row[columns.artist] || "").trim(),

    album: columns.album === -1 ? "" :
      String(row[columns.album] || "").trim(),

    genre: columns.genre === -1 ? "" :
      String(row[columns.genre] || "").trim(),

    year: columns.year === -1 ? "" :
      String(row[columns.year] || "").trim(),

    length: columns.length === -1 ? "" :
      String(row[columns.length] || "").trim(),

    fullPath: columns.fullPath === -1 ? "" :
      String(row[columns.fullPath] || "").trim(),

    storage: storageType

  })).filter(record =>
    record.title || record.artist || record.album
  );

}


// ==========================================
// LOAD INVENTORY
// ==========================================

async function loadInventory() {

  try {

    document.getElementById("status").textContent =
      "Loading music library...";

    // Retrieve both inventories
    const [hardDriveRows, cdRows] = await Promise.all([

      fetchSheet(SHEETS.hardDrive),

      fetchSheet(SHEETS.cd)

    ]);

    const hardDriveRecords =
      convertSheetToRecords(hardDriveRows, "Hard Drive");

    const cdRecords =
      convertSheetToRecords(cdRows, "CD");

    inventory = hardDriveRecords.concat(cdRecords);

    // Sort alphabetically by title
    inventory.sort((a, b) =>
      a.title.localeCompare(b.title, undefined, {
        numeric: true,
        sensitivity: "base"
      })
    );

    document.getElementById("status").textContent =
      "Music library loaded successfully.";

    // Display the initial results
    searchMusic(1);

  } catch (error) {

    document.getElementById("status").textContent =
      "Error loading library: " + error.message;

    console.error(error);

  }

}


// ==========================================
// SEARCH MUSIC
// ==========================================

function searchMusic(page) {

  if (!inventory.length) return;

  currentPage = page;

  const query = document.getElementById("searchInput").value.toLowerCase().trim();

  const artist = document.getElementById("artistFilter").value.toLowerCase().trim();

  const album = document.getElementById("albumFilter").value.toLowerCase().trim();

  const genre = document.getElementById("genreFilter").value.toLowerCase().trim();

  const year = document.getElementById("yearFilter").value.toLowerCase().trim();

  const storage = document.getElementById("storage").value.toLowerCase().trim();


  let results = inventory.filter(record => {

    if (query && !record.title.toLowerCase().includes(query)) return false;

    if (artist && !record.artist.toLowerCase().includes(artist)) return false;

    if (album && !record.album.toLowerCase().includes(album)) return false;

    if (genre && !record.genre.toLowerCase().includes(genre)) return false;

    if (year && !record.year.toLowerCase().includes(year)) return false;

    if (storage && record.storage.toLowerCase() !== storage) return false;

    return true;

  });


  // Sort results
  results.sort((a, b) => {

    return String(a[sortBy] || "").localeCompare(
      String(b[sortBy] || ""),
      undefined,
      {
        numeric: true,
        sensitivity: "base"
      }
    ) * (sortDirection === "asc" ? 1 : -1);

  });


  displayResults(results);

}


// ==========================================
// DISPLAY RESULTS
// ==========================================

function displayResults(results) {

  const body = document.getElementById("resultsBody");

  body.innerHTML = "";

  document.getElementById("resultCount").textContent =
    results.length.toLocaleString() + " records";


  totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));

  currentPage = Math.min(currentPage, totalPages);

  document.getElementById("pageInput").value = currentPage;

  document.getElementById("pageInput").max = totalPages;

  document.getElementById("totalPages").textContent = totalPages;

  document.getElementById("previousButton").disabled = currentPage <= 1;

  document.getElementById("nextButton").disabled = currentPage >= totalPages;


  // Update sorting indicators
  ["title", "artist", "album", "genre", "year", "length"].forEach(field => {

    document.getElementById("sort-" + field).textContent =
      field === sortBy
        ? (sortDirection === "asc" ? "↑" : "↓")
        : "↕";

  });


  if (!results.length) {

    document.getElementById("status").textContent =
      "No matching records found.";

    return;

  }


  const start = (currentPage - 1) * PAGE_SIZE;

  const pageResults = results.slice(start, start + PAGE_SIZE);


  pageResults.forEach(record => {

    const row = document.createElement("tr");

    [
      record.title,
      record.artist,
      record.album,
      record.genre,
      record.year,
      record.length
    ].forEach(value => {

      const cell = document.createElement("td");

      cell.textContent = value || "";

      row.appendChild(cell);

    });


    // Media column
    const mediaCell = document.createElement("td");

    if (record.storage === "CD") {

      mediaCell.textContent = "💿";

      mediaCell.title = "Available on CD";

      mediaCell.style.fontSize = "22px";

    } else if (record.fullPath) {

      const playButton = document.createElement("button");

      playButton.textContent = "▶";

      playButton.className = "play-button";

      playButton.title = "Play " + record.title;

      playButton.onclick = function() {

        const musicUrl =
          "musicplayer://play/?path=" +
          encodeURIComponent(record.fullPath);

        window.location.href = musicUrl;

      };

      mediaCell.appendChild(playButton);

    } else {

      mediaCell.textContent = "—";

    }

    row.appendChild(mediaCell);

    body.appendChild(row);

  });


  document.getElementById("status").textContent =
    `Showing ${pageResults.length} results.`;

}


// ==========================================
// PAGINATION
// ==========================================

function changePage(direction) {

  const newPage = currentPage + direction;

  if (newPage >= 1 && newPage <= totalPages) {

    currentPage = newPage;

    searchMusic(currentPage);

    document.querySelector(".results-header").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

  }

}


function jumpToPage() {

  const input = document.getElementById("pageInput");

  let page = parseInt(input.value, 10);

  if (isNaN(page)) {
    input.value = currentPage;
    return;
  }

  page = Math.max(1, Math.min(page, totalPages));

  currentPage = page;

  searchMusic(page);

  document.querySelector(".results-header").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });

}


// ==========================================
// CLEAR SEARCH
// ==========================================

function clearSearch() {

  document.getElementById("searchInput").value = "";

  document.getElementById("artistFilter").value = "";

  document.getElementById("albumFilter").value = "";

  document.getElementById("genreFilter").value = "";

  document.getElementById("yearFilter").value = "";

  document.getElementById("storage").value = "";

  currentPage = 1;

  searchMusic(1);

}


// ==========================================
// SORTING
// ==========================================

function sortResults(field) {

  if (sortBy === field) {

    sortDirection =
      sortDirection === "asc" ? "desc" : "asc";

  } else {

    sortBy = field;

    sortDirection = "asc";

  }

  searchMusic(1);

}